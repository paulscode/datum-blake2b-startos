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
# as environment. Umbrel has nothing that can do that, so read the cookie here
# when COOKIE_PATH names one and no credentials were supplied. Same file, same
# source of truth either way, and no RPC secret is generated, stored or shared.
# Finding the cookie is not the same as having working credentials, and the
# difference bites on a chain switch. Each chain keeps its own directory, so the
# previous chain's cookie is still sitting there afterwards. The gateway restarts
# faster than the node does, reads that stale file, and then every RPC call comes
# back 401 while the gateway looks perfectly healthy and simply never gets a
# template. Observed, not imagined.
#
# So candidates are tried rather than chosen, and a candidate counts only if the
# node answers with it. The same call returns the chain, so what is proven working
# and what names the payout cache cannot disagree.
cookie_candidates() {
    local base="${KNOTS_MOUNT:-/knots}"
    [ -n "${COOKIE_PATH:-}" ] && base="$(dirname "$(dirname "$COOKIE_PATH")")"
    local c
    for c in "${COOKIE_PATH:-}" "$base"/*/.cookie "$base"/.cookie; do
        [ -n "$c" ] && [ -s "$c" ] && echo "$c"
    done
}

rpc_with() {   # rpc_with USER PASS METHOD PARAMS
    wget -q -O - --header='Content-Type: application/json' \
        --http-user="$1" --http-password="$2" \
        --post-data="{\"jsonrpc\":\"1.0\",\"id\":\"init\",\"method\":\"$3\",\"params\":$4}" \
        "$RPC_URL" 2>/dev/null || true
}

NODE_CHAIN=""
if [ -z "${RPC_USER:-}" ] && [ -n "$RPC_URL" ]; then
    for _ in $(seq 1 60); do
        for _c in $(cookie_candidates); do
            _u="$(cut -d: -f1 "$_c")"; _p="$(cut -d: -f2- "$_c")"
            _chain="$(rpc_with "$_u" "$_p" getblockchaininfo '[]' \
                | sed -n 's/.*"chain":"\([^"]*\)".*/\1/p')"
            if [ -n "$_chain" ]; then
                RPC_USER="$_u"; RPC_PASSWORD="$_p"; NODE_CHAIN="$_chain"
                echo "datum-blake2b: authenticated with $_c (chain $NODE_CHAIN)"
                break 2
            fi
        done
        sleep 2
    done
    [ -n "${RPC_USER:-}" ] || echo "datum-blake2b: no cookie under ${KNOTS_MOUNT:-/knots} authenticated; starting without RPC credentials" >&2
fi

_rpc() {
    [ -n "$RPC_URL" ] && [ -n "${RPC_USER:-}" ] || return 1
    rpc_with "$RPC_USER" "$RPC_PASSWORD" "$1" "$2"
}

# StartOS passes credentials in directly, so the loop above never runs there and
# the chain still has to be asked for.
if [ -z "$NODE_CHAIN" ]; then
    NODE_CHAIN="$(_rpc getblockchaininfo '[]' \
        | sed -n 's/.*"chain":"\([^"]*\)".*/\1/p')"
fi
NODE_CHAIN="${NODE_CHAIN:-unknown}"

# Where the block rewards go. StartOS asks for this with an action and refuses to
# start without an answer. Umbrel has no equivalent, and prompting is the whole
# reason that flow exists, so there ask the node for an address instead and keep
# the first one it gives. It is the user's own node and their own wallet, so this
# is not inventing an address, only saving them a step.
#
# Address type follows the chain, for the same reason the node's Get Payout
# Address action does: DATUM's parser understands bech32 only for the bc and tb
# prefixes (datum_utils.c), so a regtest bcrt1 address is rejected downstream
# while testnet4's tb1 goes straight through. Legacy is the regtest workaround,
# not a preference, and it should not follow onto a chain that does not need it.
# The same settings file the node reads, when one is mounted. It is how the page
# this image serves reaches a running service on platforms with no settings form.
SETTINGS="${SETTINGS_FILE:-/config/settings.json}"
settings_get() {
    [ -s "$SETTINGS" ] || return 1
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$SETTINGS" | head -1
}
# A payout address set there wins over the cache, since it is the newer answer and
# somebody typed it on purpose. Per chain, for the reason below.
_set_addr="$(settings_get "payout_address_${NODE_CHAIN}" || true)"
if [ -z "${POOL_ADDRESS:-}" ] && [ -n "${_set_addr:-}" ]; then
    POOL_ADDRESS="$_set_addr"
    echo "datum-blake2b: payout address for ${NODE_CHAIN} from $SETTINGS"
fi

# Cached per chain. bitcoind keeps a separate wallet for each one, so an address
# derived on regtest belongs to a wallet testnet4 never opens. Worse, regtest and
# testnet share base58 prefixes, so a stale regtest address is accepted rather
# than rejected and the rewards pay to a key the running chain's wallet does not
# hold. Nothing reports that. See issue #1.
POOL_ADDRESS_FILE="$DATADIR/payout_address.${NODE_CHAIN}"
LEGACY_ADDRESS_FILE="$DATADIR/payout_address"

# One-time adoption of the pre-per-chain file. Chain switching did not exist when
# it was written, so whatever chain is running now is the one it was made on.
if [ ! -s "$POOL_ADDRESS_FILE" ] && [ -s "$LEGACY_ADDRESS_FILE" ] \
        && [ "$NODE_CHAIN" != "unknown" ]; then
    cp "$LEGACY_ADDRESS_FILE" "$POOL_ADDRESS_FILE"
    echo "datum-blake2b: adopted the existing payout address for ${NODE_CHAIN}"
fi

if [ -z "${POOL_ADDRESS:-}" ] && [ -s "$POOL_ADDRESS_FILE" ]; then
    POOL_ADDRESS="$(cat "$POOL_ADDRESS_FILE")"
fi
if [ -z "${POOL_ADDRESS:-}" ] && [ "${AUTO_PAYOUT_FROM_NODE:-0}" = "1" ] \
        && [ -n "$RPC_URL" ] && [ -n "${RPC_USER:-}" ]; then
    echo "datum-blake2b: no payout address set for ${NODE_CHAIN}, asking the node"
    # regtest cannot use bech32 here, because DATUM's parser does not know the
    # bcrt prefix; every other chain can and should.
    if [ "$NODE_CHAIN" = "regtest" ]; then
        _addrtype=legacy
    else
        _addrtype=bech32
    fi
    echo "datum-blake2b: chain=${NODE_CHAIN}, asking for a $_addrtype address"

    for _ in $(seq 1 30); do
        # Whichever of these two applies is the one that works; the other fails
        # harmlessly. Trying both avoids having to ask first.
        _rpc loadwallet   '["mining"]' >/dev/null
        _rpc createwallet '["mining"]' >/dev/null
        _addr="$(_rpc getnewaddress "[\"\",\"$_addrtype\"]" \
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

# The block at the BLAKE2b activation height must carry the headline somewhere in
# its coinbase scriptSig or the node rejects it with bad-headline (FINDINGS F3).
# DATUM does not inject coinbaseaux.blake2b_headline, and upstream closed the PR
# that would have made it do so, saying headlines are to be set manually. So we
# set it here, where the user never has to know about it.
COINBASE_TAG="${COINBASE_TAG:-${BLAKE2B_HEADLINE:-BLAKE2b Gateway}}"
if [ -n "${BLAKE2B_HEADLINE:-}" ] && [ ${#BLAKE2B_HEADLINE} -gt 80 ]; then
    echo "FATAL: BLAKE2B_HEADLINE is ${#BLAKE2B_HEADLINE} bytes; the coinbase tag" >&2
    echo "       budget is 86 bytes total and the headline would be truncated," >&2
    echo "       which silently breaks the activation block." >&2
    exit 1
fi

# One small JSON file per block the gateway submits, named by its hash. That is
# how a compatibility report can say whether blocks were accepted rather than only
# whether shares were: an accepted share is not a block, and the h1 version-bit bug
# was precisely the case where shares looked healthy and every block was rejected.
#
# Cleared on start, for the same reason the capture log is truncated on start: a
# report describes one session, and two miners tested in sequence must not blend.
SUBMITTED_DIR="$DATADIR/submitted"
rm -rf "$SUBMITTED_DIR"
mkdir -p "$SUBMITTED_DIR"

# The dashboard's admin pages are gated on this. Blank is DATUM's own way of
# disabling them, so an empty value here is a real setting rather than a missing
# one. JSON-escape it: it is generated alphanumeric, but a user may set their own
# and a stray quote would produce a config file the gateway cannot parse, which
# looks like a crash rather than a typo.
ADMIN_PASSWORD_JSON=$(printf '%s' "${ADMIN_PASSWORD:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')

# modify_conf stays false on purpose. This file is regenerated from the StartOS
# settings on every start, so anything the dashboard wrote into it would be
# silently discarded on the next restart. Letting the UI edit a file that is
# about to be overwritten is worse than not offering it.

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
		"pow_algorithm": "${POW_ALGORITHM:-auto}",
		"save_submitblocks_dir": "${SUBMITTED_DIR}"
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
# user has actually set. StartOS fills it from the config actions; on Umbrel and
# plain Docker it is absent and this is a no-op, which is why the settings live
# in one variable rather than forty.
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
# but the check is here rather than only there: this file is also the Umbrel and
# plain-Docker path, and an operator setting DATUM_SETTINGS by hand should not be
# able to unwire the package without being told.
RESERVED = {
    "bitcoind": {"rpcuser", "rpcpassword", "rpcurl", "rpccookiefile"},
    "stratum": {"listen_port", "listen_addr"},
    "mining": {"pool_address", "coinbase_tag_primary", "pow_algorithm",
               "save_submitblocks_dir"},
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

# Same watcher as the node, same reasoning: a settings change stops the service so
# the restart policy brings it back reading the new file, without anything here
# holding a Docker socket.

# Not `exec`. A process running as PID 1 does not get the default action for a
# signal it has no handler for, so the kernel discards it. bitcoind installs a
# SIGTERM handler and would have been fine; datum_gateway does not, and a settings
# change printed "restarting to apply" while the service carried on running. So
# the shell stays PID 1, the service is its child, and signalling the child works
# the way signalling anything else works.
datum_gateway -c "$CONF" "$@" &
APP_PID=$!

# Forward what `docker stop` and StartOS send, so staying PID 1 does not turn a
# normal shutdown into a ten-second wait and a kill.
trap 'kill -TERM "$APP_PID" 2>/dev/null || true' TERM INT

# Started unconditionally, and it hashes "absent" as a state of its own. Guarding
# on the file existing meant a settings file created *after* boot was never
# noticed, which is exactly what happens the first time somebody uses the page:
# there is nothing to watch until they press save, and by then the watcher would
# never have been started.
(
    _hash() { [ -s "$SETTINGS" ] && sha256sum "$SETTINGS" | cut -d' ' -f1 || echo none; }
    _seen="$(_hash)"
    while sleep 5; do
        _now="$(_hash)"
        if [ "$_now" != "$_seen" ]; then
            echo "datum-blake2b: settings changed, restarting to apply"
            kill -TERM "$APP_PID" 2>/dev/null || true
            exit 0
        fi
    done
) &

# Exits when the service does, whether that is a crash, a stop, or the watcher
# above deciding the settings changed. Either way the restart policy decides what
# happens next.
wait "$APP_PID"

