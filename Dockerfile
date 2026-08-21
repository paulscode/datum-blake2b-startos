# DATUM Gateway with BLAKE2b header-v2 support.
#
# Built from our fork branch, not the upstream fork tip, because the h1
# complete-version fix (justinfilip/datum_gateway#3) is not merged yet. When it
# merges, point DATUM_REPO/DATUM_REF back at upstream and drop the note.
FROM debian:bookworm-slim AS build

ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=h1-complete-version

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
        libcurl4 libjansson4 libsodium23 libmicrohttpd12 wget \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -m -d /data -u 1000 datum

COPY --from=build /src/build/datum_gateway /usr/local/bin/datum_gateway
COPY --from=build /src/PINNED_COMMIT /etc/datum-pinned-commit
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME /data
EXPOSE 23334 7152
USER datum
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
