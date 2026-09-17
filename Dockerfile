# DATUM Gateway with BLAKE2b header-v2 support, built from Convoy's fork.
#
# Convoy runs the only DATUM pool that serves this chain, and their fork is the
# client for it. Ours could not talk to it: Convoy extended the protocol, and
# their handshake appends a "DRS\x01" resume-session block where stock Ocean has
# a TODO. Their server closes the connection on a hello without it, so a gateway
# built from our tree reached them, was hung up on, and with reward sharing on
# "prefer" fell back to solo without saying why.
#
# So the base moved rather than the patch. Both forks branched from the same
# Ocean commit (dbc3b14) and three of our four BLAKE2b commits were already in
# theirs, being shared upstream work. The fourth, the h1 complete-version fix, is
# their 56c31f4, done in datum_pow.c rather than at the call site.
#
# What is ours, and what this branch exists to carry, is the stratum password
# difficulty feature: `d=8192` and `fd=8192`. Convoy's tree has none of it, and
# people renting hashrate depend on it, so the two commits are cherry-picked on
# top. They applied clean.
#
# VERIFIED BEFORE ADOPTION, because this decides what an ASIC is paid for:
#   - their BLAKE2b vector, a full 164-byte v2 header, hashes identically in
#     drongo, an independent implementation checked against live mainnet 961640
#   - their whole test suite passes, including datum_pow_tests
#   - solo mining on a Knots BLAKE2b regtest node: real mined shares accepted,
#     blocks accepted, zero rejections
#   - the Convoy handshake completes ("DATUM Server MOTD: DATUM Apex")
#   - a Goldshell HS Box and an Innosilicon S11 mined against it for real, at
#     parity with the old build (1.99 vs 1.76 Th/s over identical 300s windows)
#
# One visible change: Convoy advertises bitcoin difficulty rather than pool
# difficulty, so mining.set_difficulty carries 1023.984375 where this used to
# send 1024. Both of those ASICs handle it.
#
# Pinned by commit, not by branch. A branch name is a moving target and this is
# the one input that decides whether the work we hand an ASIC matches consensus.
FROM debian:bookworm-slim AS build

ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=2f9f736518ae1f66dc94dfcf689139df3677e0ef

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

# -DDATUM_API_FOR_UMBREL compiles in `/umbrel-api`, a small unauthenticated JSON
# endpoint returning connected clients and estimated hashrate in the shape
# umbrelOS wants for a home-screen widget. Upstream gates it behind that flag and
# sets it in its own Umbrel CI build.
#
# Set unconditionally here, because one image serves both platforms and a
# StartOS-only build with the flag missing is how the widget silently 404s. It
# adds no exposure: those two figures are already on the status page, which needs
# no password, and are what this package's own health checks scrape from it.
#
# Found by asking the running gateway rather than by reading the source. The
# source at our pin has the route, so grepping for it says yes; the string is not
# even in the binary, because gcc inlines a short strcmp against a constant, so
# grepping the binary says no for the wrong reason. `curl /umbrel-api` on a
# running container answered 404, which is the only test that settles it.
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_C_FLAGS=-DDATUM_API_FOR_UMBREL \
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
RUN chmod +x /usr/local/bin/entrypoint.sh

# Three Python scripts used to be installed here: a recording proxy for an opt-in
# compatibility-test port, a summariser that turned a capture into a report, and a
# one-page web front end for it. All removed in 1.0.0:43, along with the
# `/etc/datum-tooling-id` fingerprint that existed so a report could identify the
# build it came from.
#
# python3 stays, and the comment that used to say it was here only for those
# scripts was wrong even then: entrypoint.sh uses it to merge DATUM_SETTINGS over
# the generated config, one level deep with a reserved-key check, which is more
# than this should be doing in shell.

VOLUME /data
EXPOSE 23334 7152

USER datum
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# The Umbrel app overrides both of these and runs datum_gateway directly against
# a persistent config file, which is what the official Umbrel Datum app does. See
# that app's docker-compose.yml.
