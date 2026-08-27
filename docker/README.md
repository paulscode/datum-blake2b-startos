# Running it on plain Docker

For a Linux machine with Docker, and no StartOS or Umbrel.

This runs the same images as those packages, wired the way the Umbrel app wires
them: the gateway asks your node for a payout address by itself, and a page shows
the address to point your miner at. There is nothing to configure.

**This is a private test chain, not Bitcoin.** It starts empty, has no peers, and
the coins it mines are worthless by construction and cannot be sent anywhere.
BLAKE2b is a proposed change to Bitcoin's proof of work that has not been adopted.
The point is to find out whether your ASIC can mine it.

## Start it

```bash
mkdir blake2b-mining && cd blake2b-mining
curl -fsSLO https://raw.githubusercontent.com/paulscode/datum-blake2b-startos/main/docker/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/paulscode/datum-blake2b-startos/main/docker/start.sh
chmod +x start.sh
./start.sh
```

It prints the page to open and the address to point your miner at. Nothing else
to configure.

`start.sh` exists because of one thing this has that StartOS and Umbrel do not:
nobody assigns ports for you. If something on the machine already has one, Docker
fails outright with a message that names the port and nothing else:

```
failed to bind host port 0.0.0.0:7152/tcp: address already in use
```

Picking a replacement by hand means knowing what that means, and then possibly
doing it again for the next one. The script finds free ports instead, writes them
to `.env`, and tells you what it chose. After the first run, plain
`docker compose up -d` and `docker compose down` work and keep the same ports.

To have them chosen again, delete `.env` and run `./start.sh` again.

### Or without the script

```bash
HOST_IP=$(ip -4 route get 1.1.1.1 | grep -oP 'src \K\S+') docker compose up -d
```

`HOST_IP` is the address your miner will be told to connect to. It has to be
passed in: a container can only see its own address on the Docker network, and
most ASIC firmware has no mDNS resolver, so a `.local` name fails silently and the
miner just reports that the pool is not ready.

If you get `address already in use`, move that port and try again:

```bash
HOST_IP=... DASHBOARD_PORT=8152 docker compose up -d
```

The variable to set for each port is in the table below.

## Choosing a chain

The page has a **Network** card at the top with two choices:

- **Private test chain (regtest)**, the default. Starts empty, blocks are instant,
  nothing is shared with anyone.
- **Public BLAKE2b test network (testnet4)**, shared with other testers. A real
  chain, so the first sync takes a while.

Pick one and press **Save and restart**. The node and the gateway notice and come
back on the new chain by themselves; give them a minute and reload.

**Switching keeps both.** Each chain has its own blocks, wallet and payout
address, so switching back returns you to where you left off. Nothing is deleted.

The same card takes a payout address. Leave it blank and your node is asked for
one, which is the normal case. It is remembered per chain, because the wallets are
separate: an address made on one chain belongs to a wallet the other never opens.

The headline and the peer list are not settings. Both are decided by the chain,
and testnet4 in particular requires an exact headline and a starting set of peers
its own DNS seeds cannot supply, so the node sets them itself.

## Point your miner at it

Set the pool in your miner's own web interface to the address the page shows:

```
stratum+tcp://YOUR-SERVER-IP:23336
```

The worker name and password are not used. Put anything readable as the worker so
you can tell miners apart. You do **not** put a payout address there: some pools
want `address.worker`, this does not, because it is not pooled mining.

Then watch the dashboard. Blocks come very fast, because the test chain has almost
no difficulty. That is expected.

## Ports

| | Default | Override with |
|---|---|---|
| The page to open | 7153 | `PAGE_PORT` |
| Stratum | 23336 | `STRATUM_PORT` |
| Compatibility capture | 23337 | `CAPTURE_PORT` |
| Mining dashboard | 7152 | `DASHBOARD_PORT` |

Nothing assigns ports for you here the way StartOS and Umbrel do, so a clash with
something already on the machine is a failed start rather than a warning. Move
whichever one clashes:

```bash
HOST_IP=... PAGE_PORT=8153 DASHBOARD_PORT=8152 docker compose up -d
```

Only the published side moves. The page reads these same variables, so a miner is
always told the right number.

The node's RPC and P2P ports are deliberately not published. RPC authenticates
with a cookie the node writes itself, and this chain has no peers to find.

## Reporting a miner nobody has tried

Verified so far, both on stock firmware: a **Goldshell HS-Box** in Sia mode, and a
**Bitmain Antminer A3** on CGminer 4.9.0. Other Sia BLAKE2b miners are expected to
work but have not been tried.

**GPUs do not work yet.** `ccminer -a sia` computes the right hash but speaks the
other "Sia stratum" dialect, the one the Sia pools use, with 4-byte time and nonce
fields and a ready-made merkle root. This gateway serves the dialect the ASICs
speak. Tested on an RTX 3090 and a Quadro RTX 8000: it rejects the work and never
starts hashing.

If yours is not one of those, point it at the **capture** port (23337 by default)
instead of the normal one for a minute or two. It mines exactly as normal; the only
difference is that the conversation is written down. Then fill in the form on the
page and copy what it gives you.

Share it in the Bitcoin section of the forum,
<https://paulscode.com/c/bitcoin/8>, which needs a free account to post in, or open
an issue at <https://github.com/paulscode/datum-blake2b-startos/issues>.

Nothing is sent anywhere on its own. You see exactly what you are sharing, and
worker names are hashed and passwords dropped before anything reaches disk.

To test a second miner, run `docker compose restart` first. That starts a fresh
capture, so two miners do not get blended into one report.

## Checking on it

```bash
docker compose logs -f gateway          # what the gateway is doing
docker compose exec node bitcoin-cli -datadir=/data -regtest getblockcount
docker compose exec node bitcoin-cli -datadir=/data -regtest -rpcwallet=mining getbalances
```

Freshly mined coins need 100 more blocks before they count as spendable, so a new
miner's balance sits under `immature`. That is normal.

## Stopping it

```bash
docker compose down             # stop, keep the chain
docker compose down -v          # stop and delete the chain and wallet
```

There is nothing of value in either, so `-v` is the right one if you are finished.
