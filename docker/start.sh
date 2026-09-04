#!/usr/bin/env bash
# Start the BLAKE2b mining test stack, choosing ports that are actually free.
#
#   ./start.sh
#
# StartOS and Umbrel assign ports for you. Plain Docker does not, so a port that
# something else already has is a hard failure with a message that names the port
# and nothing else:
#
#   failed to bind host port 0.0.0.0:7152/tcp: address already in use
#
# Picking a replacement by hand means knowing what "in use" means, and then
# possibly doing it again for the next one: on the machine this was written for,
# 7152 and 7153 were both taken. So this finds free ports instead of asking.
#
# The choices are written to .env, which docker compose reads on its own. After
# the first run, plain `docker compose up -d` and `docker compose down` work and
# keep the same ports.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f docker-compose.yml ]; then
    echo "No docker-compose.yml here. Run this from the directory you downloaded it into." >&2
    exit 1
fi

# ---- the address to give a miner ---------------------------------------
# Has to be worked out here: a container only knows its own address on the
# Docker network, and most ASIC firmware cannot resolve a .local name, so a
# wrong guess fails silently and the miner only says the pool is not ready.
detect_ip() {
    ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' && return 0
    hostname -I 2>/dev/null | awk '{print $1}'
}

# ---- port selection ----------------------------------------------------
port_taken() {
    if command -v ss >/dev/null 2>&1; then
        ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
    else
        # No ss: see whether anything answers. Less thorough, since a socket
        # bound to one interface only may be missed, but better than nothing.
        (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0
        return 1
    fi
}

# Ports handed out earlier in this same run. Without this, two defaults that are
# both taken can be pushed onto the same replacement: two busy defaults once
# gave the same number twice, and the second container to start
# failed on a port the first had just taken. Nothing is listening on a chosen
# port yet, so the system check cannot see it.
CHOSEN=""

# Assigns to the named variable rather than echoing, because a command
# substitution runs in a subshell and the record of what was already handed out
# would not survive it. That is the same bug as above wearing a different hat.
pick_port() {          # pick_port VARNAME PREFERRED
    local __name=$1 p=$2
    while port_taken "$p" || [[ " $CHOSEN " == *" $p "* ]]; do
        p=$((p + 1))
    done
    CHOSEN="$CHOSEN $p"
    printf -v "$__name" '%s' "$p"
}

if [ -f .env ]; then
    echo "Using the ports already chosen in .env."
else
    echo "Looking for free ports..."
    HOST_IP="${HOST_IP:-$(detect_ip)}"
    pick_port STRATUM_PORT   "${STRATUM_PORT:-23336}"
    pick_port DASHBOARD_PORT "${DASHBOARD_PORT:-7152}"
    {
        echo "# Written by start.sh. Delete this file to have ports chosen again."
        echo "HOST_IP=$HOST_IP"
        echo "STRATUM_PORT=$STRATUM_PORT"
        echo "DASHBOARD_PORT=$DASHBOARD_PORT"
    } > .env
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

if [ -z "${HOST_IP:-}" ]; then
    echo "Could not work out this machine's address." >&2
    echo "Put it in .env by hand as HOST_IP=192.168.x.x and run this again." >&2
    exit 1
fi

docker compose up -d

cat <<EOF

Running.

  Point your miner at: stratum+tcp://${HOST_IP}:${STRATUM_PORT}
  Mining dashboard:    http://${HOST_IP}:${DASHBOARD_PORT}

The worker name and password are not used; put anything readable as the worker.

The node syncs the BLAKE2b chain before the gateway can serve work, so the
Stratum port stays shut for a while on a first run. That is expected.

To stop it, keeping the chain and the wallet:  docker compose down
To stop it and delete both:                    docker compose down -v
EOF
