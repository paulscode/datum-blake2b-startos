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
#
# e998e38 added the dupe table index fix and the local share reject reasons,
# both sent upstream as OCEAN #237 and Convoy #18.
#
# blake2b-full-payout (the pin below) is the same work moved onto Convoy's
# current master, plus iohzrd's coinbase fixes, because every build up to
# 1.0.0:52 paid at most about 17 miners per block. The gateway still gave each
# miner the coinbase class its firmware was known to accept, and fell back to
# the 750-byte Antminer class for hardware it did not recognise, which is every
# BLAKE2b ASIC. That class holds about 17 pool outputs; the rest of a pool's
# split went unpaid in the block and the pool had to make it good later. The
# size limits only ever existed for SHA256d firmware that rebuilds the coinbase
# itself. A BLAKE2b miner is sent a 39-byte commitment and never sees the
# coinbase, so they protect nothing on this chain.
#
#   - Convoy master (ac9b70c) already serves every miner the largest class
#     (16 KB), but sizes it to the template with the 80-byte header's weight,
#     so a coinbase grown to fill a nearly full template overshoots the weight
#     limit by about 300 units: an invalid block. Latent at the node's default
#     block size; real for anyone who raises Max Block Weight near the maximum.
#   - iohzrd's 40cf813, 7491a50 and c031568 count the 164-byte header and the
#     coinbase's 124 static bytes, enforce the template's sigop limit, and raise
#     the class to 32,000 bytes and 1024 outputs, enough for Lazarus's ~440-miner
#     window with room to spare.
#   - Our commits on top, unchanged in purpose: password difficulty, empty-work
#     subsidy, Obelisk SC1 Gen 2, the advertised stratum endpoint, the dupe fix
#     and reject reasons. Dropped: our config POST fix (Convoy's 60dbf47 does
#     the same) and the NiceHash difficulty floor (Convoy removed fingerprinting).
#     Convoy's refactor added a fixed 16-character extranonce2 check that would
#     have refused every share from a 4-byte extranonce2 miner; it is removed in
#     the Obelisk commit, where the per-connection check already covers it.
#   - Lazarus Pool's late-coinbaser patch (79595ce): while pooled, never serve
#     a full template whose coinbase pays only the pool, which happened for a
#     moment after every new block and whenever the pool's split was late.
#
# VERIFIED: every commit builds and passes --test on its own. cd36191 adds a
# test that builds the real coinbase against templates up to full and measures
# the block; it fails on the old arithmetic (up to 312 units over) and passes
# here. An empty template carries 911 of 1024 outputs. Real BLAKE2b shares,
# with 8- and 4-byte extranonce2, were mined through it on Knots regtest and the
# node took every block. Against Lazarus from a synced mainnet BLAKE2b node, the
# handshake completed, the pool listed the gateway on the DATUM fee path, and
# its split arrived (108 outputs, about 3.5 KB, well inside the class). The count
# written into the coinbase is not visible from outside, because the miner only
# ever sees a commitment; the test above is what measures it.
FROM debian:bookworm-slim AS build

ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=79595cede73bd9021a6e9fc111736e5f504f9b9f

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
