#!/bin/bash
# Generate the gateway config from the environment, wait for the node, run.
#
# Solo mining only. Pooled BLAKE2b is not possible today: Ocean's pool server is
# closed-source and SHA256d-only (FINDINGS F7), so pool settings are deliberately
# not exposed.
set -euo pipefail

DATADIR=/data
CONF="$DATADIR/datum.json"

RPC_URL="${RPC_URL:-}"

# RPC_URL/RPC_USER/RPC_PASSWORD come from the node's cookie via a read-only mount
# of its volume. They are deliberately absent when the node is not installed or not
# running: StartOS says never fabricate a dependency address, so we start anyway,
# fail to fetch templates, and let the health check show it.
#
# StartOS reads the cookie in the service definition and passes the two halves in
# as environment. Plain Docker has nothing that can do that, so read the cookie
# here when COOKIE_PATH names one and no credentials were supplied. Same file,
# same source of truth either way, and no RPC secret is generated, stored or
# shared.
#
# This used to search a set of candidate paths, because the node could be on any
# of three chains and each kept its cookie in a different directory. The gateway
# restarts faster than the node does, so on a chain switch it would find the
# previous chain's cookie still sitting there, authenticate against nothing, and
# then look perfectly healthy while every RPC call came back 401 and no template
# ever arrived. Observed, not imagined. The node follows mainnet only now, whose
# cookie is at the root of the data directory, so there is one path and the
# stale-cookie failure it was working around cannot occur.
rpc_with() {   # rpc_with USER PASS METHOD PARAMS
    wget -q -O - --header='Content-Type: application/json' \
        --http-user="$1" --http-password="$2" \
        --post-data="{\"jsonrpc\":\"1.0\",\"id\":\"init\",\"method\":\"$3\",\"params\":$4}" \
        "$RPC_URL" 2>/dev/null || true
}

COOKIE_PATH="${COOKIE_PATH:-${KNOTS_MOUNT:-/knots}/.cookie}"
if [ -z "${RPC_USER:-}" ] && [ -n "$RPC_URL" ]; then
    for _ in $(seq 1 60); do
        if [ -s "$COOKIE_PATH" ]; then
            _u="$(cut -d: -f1 "$COOKIE_PATH")"; _p="$(cut -d: -f2- "$COOKIE_PATH")"
            # Finding the cookie is not the same as having working credentials.
            # bitcoind rewrites it on every start, so a file that exists may still
            # be the previous run's. Prove it before keeping it.
            if [ -n "$(rpc_with "$_u" "$_p" getblockchaininfo '[]' \
                    | sed -n 's/.*"chain":"\([^"]*\)".*/\1/p')" ]; then
                RPC_USER="$_u"; RPC_PASSWORD="$_p"
                echo "datum-blake2b: authenticated with $COOKIE_PATH"
                break
            fi
        fi
        sleep 2
    done
    [ -n "${RPC_USER:-}" ] || echo "datum-blake2b: $COOKIE_PATH did not authenticate; starting without RPC credentials" >&2
fi

_rpc() {
    [ -n "$RPC_URL" ] && [ -n "${RPC_USER:-}" ] || return 1
    rpc_with "$RPC_USER" "$RPC_PASSWORD" "$1" "$2"
}

# Where the block rewards go. StartOS asks for this with an action and refuses to
# start without an answer. Plain Docker has no equivalent, and prompting is the
# whole reason that flow exists, so there ask the node for an address instead and
# keep the first one it gives. It is the user's own node and their own wallet, so
# this is not inventing an address, only saving them a step.
#
# bech32, and named explicitly rather than left to the wallet's default: DATUM's
# parser understands bech32 only for the bc and tb prefixes (datum_utils.c), so
# naming the type is what guarantees an address it can actually pay to. This used
# to choose legacy on regtest, where bcrt1 matched neither branch of that parser.
POOL_ADDRESS_FILE="$DATADIR/payout_address"

if [ -z "${POOL_ADDRESS:-}" ] && [ -s "$POOL_ADDRESS_FILE" ]; then
    POOL_ADDRESS="$(cat "$POOL_ADDRESS_FILE")"
fi
if [ -z "${POOL_ADDRESS:-}" ] && [ "${AUTO_PAYOUT_FROM_NODE:-0}" = "1" ] \
        && [ -n "$RPC_URL" ] && [ -n "${RPC_USER:-}" ]; then
    echo "datum-blake2b: no payout address set, asking the node for one"
    for _ in $(seq 1 30); do
        # Whichever of these two applies is the one that works; the other fails
        # harmlessly. Trying both avoids having to ask first.
        _rpc loadwallet   '["mining"]' >/dev/null
        _rpc createwallet '["mining"]' >/dev/null
        _addr="$(_rpc getnewaddress '["","bech32"]' \
            | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')"
        [ -n "$_addr" ] && break
        sleep 2
    done
    if [ -n "${_addr:-}" ]; then
        POOL_ADDRESS="$_addr"
        printf %s "$POOL_ADDRESS" > "$POOL_ADDRESS_FILE"
        echo "datum-blake2b: payout address $POOL_ADDRESS"
    else
        echo "datum-blake2b: the node did not give an address; is it running?" >&2
    fi
fi

if [ -z "${POOL_ADDRESS:-}" ]; then
    # Belt and braces. On StartOS the critical task from watchPayoutAddress should
    # stop the service reaching this point, so if we are here something bypassed it.
    echo "FATAL: no payout address set. Block rewards would have nowhere to go," >&2
    echo "       and inventing one would send your coins to a stranger. Set one" >&2
    echo "       ('Set Payout Address' on StartOS) and start the service again." >&2
    exit 1
fi

STRATUM_PORT="${STRATUM_PORT:-23334}"
API_PORT="${API_PORT:-7152}"
VARDIFF_MIN="${VARDIFF_MIN:-1024}"

# The label this gateway puts in the coinbase of blocks it builds. Free text, and
# entirely the operator's to choose: the Mining config action sets it, and DATUM's
# own default applies when they have not.
#
# There used to be a great deal more here. The block at the BLAKE2b activation
# height must carry the chain's headline somewhere in its coinbase scriptSig or
# the node rejects it with bad-headline, DATUM does not inject
# `coinbaseaux.blake2b_headline`, and upstream closed the PR that would have made
# it do so. So this file asked the node where activation was and how far it had
# got, and while that block was still ahead it appended the headline to whatever
# tag the operator had chosen, refusing to start if the two together exceeded
# DATUM's 60-byte budget rather than truncating and silently losing a block.
#
# All of it was for exactly one block per chain. On mainnet that block is 961640,
# mined on 2026-08-30, and a gateway only ever builds on the tip. A node syncing
# past 961640 downloads it; it does not mine it. So the case this handled cannot
# arise on the only chain this package now serves.
COINBASE_TAG="${COINBASE_TAG:-BLAKE2b Gateway}"

# The dashboard's admin pages are gated on this. Blank is DATUM's own way of
# disabling them, so an empty value here is a real setting rather than a missing
# one. JSON-escape it: it is generated alphanumeric, but a user may set their own
# and a stray quote would produce a config file the gateway cannot parse, which
# looks like a crash rather than a typo.
ADMIN_PASSWORD_JSON=$(printf '%s' "${ADMIN_PASSWORD:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')

# modify_conf stays false on purpose, and this is the one place this package
# deliberately differs by platform.
#
# This file is regenerated from the environment on every start, so anything the
# dashboard wrote into it would be silently discarded on the next restart.
# Letting the UI edit a file that is about to be overwritten is worse than not
# offering it. Both upstream StartOS packages, OCEAN's and Retropex's, leave it
# false for the same reason: there, the settings live in the platform's own forms
# and the config file is an output.
#
# The official Umbrel app sets it true, because it has no settings forms and the
# dashboard is the only place to change anything. Our Umbrel app matches it by
# not using this script at all: it runs datum_gateway directly against a config
# file its pre-start hook patches, which is exactly what the official app does.
# See the Umbrel app's docker-compose.yml.

cat > "$CONF" <<JSON
{
	"bitcoind": {
		"rpcuser": "${RPC_USER}",
		"rpcpassword": "${RPC_PASSWORD}",
		"rpcurl": "${RPC_URL}",
		"work_update_seconds": ${WORK_UPDATE_SECONDS:-5},
		"notify_fallback": true
	},
	"stratum": {
		"listen_port": ${STRATUM_PORT},
		"vardiff_min": ${VARDIFF_MIN},
		"fingerprint_miners": ${FINGERPRINT_MINERS:-true}
	},
	"mining": {
		"pool_address": "${POOL_ADDRESS}",
		"coinbase_tag_primary": "${COINBASE_TAG}",
		"coinbase_tag_secondary": "",
		"pow_algorithm": "${POW_ALGORITHM:-auto}"
	},
	"api": {
		"admin_password": "${ADMIN_PASSWORD_JSON}",
		"listen_port": ${API_PORT},
		"modify_conf": false
	},
	"logger": {
		"log_to_console": true,
		"log_to_file": false,
		"log_level_console": ${LOG_LEVEL:-1}
	},
	"datum": {
		"pool_host": "",
		"pooled_mining_only": false
	}
}
JSON

# Merge the operator's settings over the config generated above.
#
# DATUM_SETTINGS is a JSON object shaped like datum.json, holding only what the
# user has actually set. StartOS fills it from the config actions; on plain
# Docker it is absent and this is a no-op, which is why the settings live in one
# variable rather than forty. The Umbrel app does not run this script at all.
#
# Merged rather than substituted: the generated config carries the things this
# package owns (ports, credentials, the submit directory, the coinbase tag that
# has to match the node's headline), and a user setting must not be able to
# displace those. Only keys DATUM itself groups are merged, one level deep.
if [ -n "${DATUM_SETTINGS:-}" ] && [ "${DATUM_SETTINGS}" != "{}" ]; then
    python3 - "$CONF" <<'PY' || { echo "FATAL: could not apply settings" >&2; exit 1; }
import json, os, sys

path = sys.argv[1]
with open(path) as f:
    conf = json.load(f)

try:
    overrides = json.loads(os.environ.get("DATUM_SETTINGS") or "{}")
except json.JSONDecodeError as e:
    sys.exit(f"DATUM_SETTINGS is not valid JSON: {e}")

# Keys this package owns. A user cannot reach them through the config actions,
# but the check is here rather than only there: this file is also the plain-Docker
# path, and an operator setting DATUM_SETTINGS by hand should not be able to
# unwire the package without being told.
#
# `mining.coinbase_tag_primary` was in this list and should not have been, which
# made the Mining action's Primary Coinbase Tag a form field that did nothing.
# Nothing passes COINBASE_TAG in from StartOS, so the value went into
# DATUM_SETTINGS, was matched here, and was dropped with a note on stderr that
# nobody reads. It is a label on your own blocks, not something this package
# needs to own. Removed along with `save_submitblocks_dir`, whose directory only
# ever existed to feed the compatibility report.
RESERVED = {
    "bitcoind": {"rpcuser", "rpcpassword", "rpcurl", "rpccookiefile"},
    "stratum": {"listen_port", "listen_addr"},
    "mining": {"pool_address", "pow_algorithm"},
    "api": {"listen_port", "listen_addr", "admin_password", "modify_conf"},
    "logger": {"log_to_console", "log_to_stderr"},
}

# Only DATUM's own groups. An unknown one would otherwise be created in the
# config file, where the gateway ignores it and the operator gets no hint that
# their setting went nowhere.
GROUPS = set(RESERVED) | {"datum"}

applied = []
for group, values in overrides.items():
    if not isinstance(values, dict):
        continue
    if group not in GROUPS:
        print(f"datum-blake2b: ignoring unknown group {group}", file=sys.stderr)
        continue
    # Only into a group the generated config already has, so a typo cannot
    # invent a section.
    section = conf.setdefault(group, {})
    for key, value in values.items():
        if value is None:
            continue
        if key in RESERVED.get(group, ()):
            print(f"datum-blake2b: ignoring {group}.{key}, this package sets it",
                  file=sys.stderr)
            continue
        section[key] = value
        applied.append(f"{group}.{key}")

with open(path, "w") as f:
    json.dump(conf, f, indent=1)
if applied:
    print("datum-blake2b: applied settings " + ", ".join(sorted(applied)))
PY
fi

echo "datum-blake2b: pinned commit $(cat /etc/datum-pinned-commit)"
echo "datum-blake2b: node=${RPC_URL} stratum=${STRATUM_PORT} coinbase_tag='${COINBASE_TAG}'"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
    echo "datum-blake2b: dashboard admin pages enabled (user 'admin')"
else
    echo "datum-blake2b: dashboard admin pages disabled (no password set)"
fi

# The gateway exits if the node is not there at startup, so wait for it.
for i in $(seq 1 "${RPC_WAIT_SECONDS:-120}"); do
    if wget -q -T 2 -O /dev/null --post-data='{"method":"getbestblockhash","params":[],"id":1}' \
            --header='Content-Type: application/json' \
            --http-user="$RPC_USER" --http-password="$RPC_PASSWORD" "$RPC_URL" 2>/dev/null; then
        echo "datum-blake2b: node is up after ${i}s"
        break
    fi
    [ "$i" = "${RPC_WAIT_SECONDS:-120}" ] && { echo "FATAL: node never became reachable" >&2; exit 1; }
    sleep 1
done

# Not `exec`. A process running as PID 1 does not get the default action for a
# signal it has no handler for, so the kernel discards it. bitcoind installs a
# SIGTERM handler and would have been fine; datum_gateway does not, and a stop
# request went unanswered until the ten-second grace period ran out and it was
# killed. So the shell stays PID 1, the service is its child, and signalling the
# child works the way signalling anything else works.
datum_gateway -c "$CONF" "$@" &
APP_PID=$!

# Forward what `docker stop` and StartOS send, so staying PID 1 does not turn a
# normal shutdown into a ten-second wait and a kill.
trap 'kill -TERM "$APP_PID" 2>/dev/null || true' TERM INT

# There is no settings watcher any more. It existed so that the page this image
# used to serve could write a shared settings.json holding the chain and the
# payout address, which this container watched and restarted on. The chain is not
# a setting, and on both platforms this image runs on the payout address has a
# real settings form: a StartOS action, or the gateway's own dashboard on Umbrel.
#
# Exits when the service does, whether that is a crash or a stop. Either way the
# restart policy decides what happens next.
#
# The loop is the point, and one `wait` is not enough. A trapped signal makes
# `wait` return immediately with a status above 128, *without* reaping the child:
# the trap above has only asked the service to stop, and it is still running. If
# the script ended there, PID 1 would exit while the service was still shutting
# down, and the container would take it with it. For bitcoind that means the
# chainstate is never flushed, so a stop during a long sync throws the sync away
# and it starts over from the last flush, which during an initial sync is
# nothing. Measured: stopping at height 84900 mid-IBD came back at height 327.
#
# So wait again until the child is genuinely gone, and exit with its status
# rather than the signal's.
# `|| rc=$?` rather than a bare `wait`, and that is the whole fix. `set -e` is on
# (line 6), and an interrupted `wait` returns 128+signum, so a bare `wait` ends
# the script the instant the signal arrives, before anything can read its status.
# That is what used to happen: the trap asked the service to stop, `set -e` then
# killed PID 1 five milliseconds later, and the container took the service down
# mid-shutdown. A command on the left of `||` is exempt from `set -e`.
rc=0
wait "$APP_PID" || rc=$?
while [ "$rc" -gt 128 ] && kill -0 "$APP_PID" 2>/dev/null; do
    rc=0
    wait "$APP_PID" || rc=$?
done
exit "$rc"

