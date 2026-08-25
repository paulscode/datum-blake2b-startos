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
if [ -z "${RPC_USER:-}" ] && [ -n "${COOKIE_PATH:-}" ]; then
    for _ in $(seq 1 60); do
        [ -s "$COOKIE_PATH" ] && break
        sleep 2
    done
    if [ -s "$COOKIE_PATH" ]; then
        _cookie="$(cat "$COOKIE_PATH")"
        RPC_USER="${_cookie%%:*}"
        RPC_PASSWORD="${_cookie#*:}"
        echo "datum-blake2b: authenticating with the node's cookie"
    else
        echo "datum-blake2b: no cookie at $COOKIE_PATH; starting without RPC credentials" >&2
    fi
fi

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
POOL_ADDRESS_FILE="$DATADIR/payout_address"
if [ -z "${POOL_ADDRESS:-}" ] && [ -s "$POOL_ADDRESS_FILE" ]; then
    POOL_ADDRESS="$(cat "$POOL_ADDRESS_FILE")"
fi
if [ -z "${POOL_ADDRESS:-}" ] && [ "${AUTO_PAYOUT_FROM_NODE:-0}" = "1" ] \
        && [ -n "$RPC_URL" ] && [ -n "${RPC_USER:-}" ]; then
    echo "datum-blake2b: no payout address set, asking the node for one"
    _rpc() {
        wget -q -O - --header='Content-Type: application/json' \
            --http-user="$RPC_USER" --http-password="$RPC_PASSWORD" \
            --post-data="{\"jsonrpc\":\"1.0\",\"id\":\"init\",\"method\":\"$1\",\"params\":$2}" \
            "$RPC_URL" 2>/dev/null || true
    }
    # Which address type to ask for. regtest cannot use bech32 here, because
    # DATUM's parser does not know the bcrt prefix; every other chain can and
    # should. Asked of the node rather than configured, since this path is the
    # Umbrel and plain-Docker one where nothing has told us the chain.
    _chain="$(_rpc getblockchaininfo '[]' \
        | sed -n 's/.*"chain":"\([^"]*\)".*/\1/p')"
    if [ "${_chain:-regtest}" = "regtest" ]; then
        _addrtype=legacy
    else
        _addrtype=bech32
    fi
    echo "datum-blake2b: chain=${_chain:-unknown}, asking for a $_addrtype address"

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

exec datum_gateway -c "$CONF" "$@"
