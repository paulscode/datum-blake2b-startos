# DATUM Gateway with BLAKE2b header-v2 support.
#
# Built from our fork, which is now upstream master plus one test-only commit.
#
# The h1 complete-version bug we carried a fix for is fixed upstream in 56c31f4,
# in datum_pow.c rather than at the call site where our patch put it, which is the
# better place: the commitment function is now correct for any caller. That patch
# is therefore gone from this build.
#
# What remains is the test correction. Upstream's "canonical profile-0 vector
# published with Knots' header-v2 implementation" is not the published vector: it
# passes m_flags 0x5c where Knots' block_header_v2.json has 0x1c, and expects
# values it computed for itself. 0x5c also sets 0x40, which Knots rejects as
# bad-flags-highbits. Dropping to upstream master alone would mean building
# against a gateway whose BLAKE2b vectors are checked only against themselves.
#
# Pinned by commit, not by branch. A branch name is a moving target and this is
# the one input that decides whether the work we hand an ASIC matches consensus.
FROM debian:bookworm-slim AS build

ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=39f9c3c82df72736f0ac9417ac388885ce32340e

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake pkgconf git ca-certificates \
        libcurl4-openssl-dev libjansson-dev libsodium-dev libmicrohttpd-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git init -q \
 && git remote add origin "$DATUM_REPO" \
 && git fetch -q --depth 1 origin "$DATUM_REF" \
 && git checkout -q FETCH_HEAD \
 && git rev-parse HEAD > /src/PINNED_COMMIT

RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
 && cmake --build build -j"$(nproc)" \
 && ./build/datum_gateway --test \
 && strip build/datum_gateway

# ----------------------------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libcurl4 libjansson4 libsodium23 libmicrohttpd12 wget python3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -m -d /data -u 1000 datum

COPY --from=build /src/build/datum_gateway /usr/local/bin/datum_gateway
COPY --from=build /src/PINNED_COMMIT /etc/datum-pinned-commit
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Compatibility capture: a recording proxy for the opt-in test port, the
# summariser that turns a capture into a report, and a one-page web front end for
# it used on platforms that have no equivalent of a StartOS action. Python is
# here only for these; the gateway itself does not use it.
COPY capture/stratumtap.py capture/report.py capture/report_server.py /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/stratumtap.py \
        /usr/local/bin/report.py /usr/local/bin/report_server.py

# A fingerprint of our own tooling, so a report identifies the build it came from.
# The pinned gateway commit alone does not: two images can share it while differing
# in everything we wrote, which is exactly what happened when a report arrived
# carrying block figures alongside a commit from a build that had no block
# reporting. Derived rather than passed in, so it cannot be forgotten at build time
# and is right on every platform.
RUN sha256sum /usr/local/bin/entrypoint.sh /usr/local/bin/report.py \
        /usr/local/bin/stratumtap.py /usr/local/bin/report_server.py \
    | sha256sum | cut -c1-12 > /etc/datum-tooling-id

VOLUME /data
EXPOSE 23334 7152
# Create the settings mountpoint owned by the runtime user. A named volume
# inherits the ownership of the image directory it covers, so doing this here
# is what makes a fresh volume writable without anything running as root.
RUN mkdir -p /config && chown datum:datum /config

USER datum
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
