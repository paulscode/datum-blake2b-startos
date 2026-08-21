#!/bin/bash
# Generate the gateway config from the environment, wait for the node, run.
#
# Solo mining only. Pooled BLAKE2b is not possible today: Ocean's pool server is
# closed-source and SHA256d-only (FINDINGS F7), so pool settings are deliberately
# not exposed.
set -euo pipefail

DATADIR=/data
CONF="$DATADIR/datum.json"

# RPC_URL/RPC_USER/RPC_PASSWORD come from the node's cookie via a read-only mount
# of its volume. They are deliberately absent when the node is not installed or not
# running: StartOS says never fabricate a dependency address, so we start anyway,
# fail to fetch templates, and let the health check show it.
if [ -z "${POOL_ADDRESS:-}" ]; then
    # Belt and braces. The critical task from watchPayoutAddress should stop the
    # service reaching this point, so if we are here something bypassed it.
    echo "FATAL: no payout address set. Block rewards would have nowhere to go," >&2
    echo "       and inventing one would send your coins to a stranger. Run the" >&2
    echo "       'Set Payout Address' action, then start the service." >&2
    exit 1
fi

RPC_URL="${RPC_URL:-}"
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
		"admin_password": "",
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

echo "datum-blake2b: pinned commit $(cat /etc/datum-pinned-commit)"
echo "datum-blake2b: node=${RPC_URL} stratum=${STRATUM_PORT} coinbase_tag='${COINBASE_TAG}'"

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
