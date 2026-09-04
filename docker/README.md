# Running it on plain Docker

For a Linux machine with Docker, and no StartOS or Umbrel.

This runs the same images as those packages: a Bitcoin Knots node following the
BLAKE2b chain, and a DATUM Gateway serving Sia-style BLAKE2b work to your ASIC.
The gateway asks the node for a payout address by itself, so there is nothing to
configure before starting.

**This mines a real chain.** Bitcoin's mainnet split on 30 August 2026, and from
block 961640 one of the two chains uses BLAKE2b for proof of work instead of
SHA256d. A block you find pays its whole subsidy to an address in the node's own
wallet, which lives in a Docker volume. Back it up, or set `POOL_ADDRESS` to an
address from a wallet you already back up. `docker compose down -v` deletes that
volume.

## Start it

```bash
mkdir blake2b-mining && cd blake2b-mining
curl -fsSLO https://raw.githubusercontent.com/paulscode/datum-blake2b-startos/main/docker/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/paulscode/datum-blake2b-startos/main/docker/start.sh
chmod +x start.sh
./start.sh
```

It prints the address to point your miner at and the dashboard to watch. Nothing
else to configure.

`start.sh` exists because of one thing this has that StartOS and Umbrel do not:
nobody assigns ports for you. If something on the machine already has one, Docker
fails outright with a message that names the port and nothing else. `start.sh`
finds free ones, writes them to `.env`, and after the first run plain
`docker compose up -d` and `docker compose down` keep the same choices.

## Pointing a miner at it

Set the pool in your miner's own web interface:

```
stratum+tcp://192.168.1.50:23336
```

**Use the machine's IP address, not a `.local` name.** Most ASIC firmware has no
mDNS resolver, so a `.local` address fails silently and the miner just reports
that the pool is not ready.

The worker name and password are not used. This is solo mining, so the payout
comes entirely from the configured address; put something readable as the worker
so you can tell miners apart on the dashboard.

**The Stratum port stays shut until the node has synced.** DATUM does not open it
until it has a block template, and a node still downloading the chain has none to
give. On a first run that is a while. The node is pruned to 5 GB by default, which
is enough to mine: a gateway needs the tip, not history.

## Ports

| | default | variable |
|---|---|---|
| Stratum, for your miner | 23336 | `STRATUM_PORT` |
| The gateway's dashboard | 7152 | `DASHBOARD_PORT` |

23336 rather than the official Datum app's 23334, so both can run on one machine.

```bash
STRATUM_PORT=8336 DASHBOARD_PORT=8152 docker compose up -d
```

Only the published side moves; the ports inside the containers are fixed.

The dashboard has nothing in front of it, so treat it as visible to anything on
your network. Its admin pages, which list connected miners, are off unless you set
`ADMIN_PASSWORD` on the gateway service.

## Looking at the node

```bash
docker compose exec node bitcoin-cli -datadir=/data -chain=main getblockchaininfo
docker compose exec node bitcoin-cli -datadir=/data -chain=main -rpcwallet=mining getbalances
```

`-chain=main` rather than no flag: mainnet is bitcoind's default and there is no
`-mainnet` option, but naming it explicitly beats relying on the absence of one.

Freshly mined coins need 100 more blocks before they can be spent, so a working
miner's balance sits in `immature` for about a day. That is normal.

## Which miners work

See the service instructions in
[`../instructions.md`](../instructions.md#which-miners-work). Five models across
three manufacturers so far, all on stock firmware.
