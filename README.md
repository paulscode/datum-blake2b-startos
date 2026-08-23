# datum-blake2b

DATUM Gateway serving Sia-style BLAKE2b work, so an existing Sia-compatible ASIC can
mine the experimental BLAKE2b Bitcoin Knots chain. Packaged for StartOS 0.4.0.x.

**Regtest only**, and solo mining only: pooled BLAKE2b is not possible today because
the pool server is closed-source and SHA256d-only.

Maintained by Paul Lamb (<https://github.com/paulscode>). Not affiliated with Start9
or OCEAN.

## How this differs from the official `datum` package

| | official `datum` | this package |
|---|---|---|
| id | `datum` | `datum-blake2b` |
| stratum | 23334 | **23336** |
| dashboard | 7152 | 7153 |
| depends on | `bitcoind` | `knots-blake2b` |
| work | SHA256d | BLAKE2b header v2 |

Both install and run at once. **The dependency must be `knots-blake2b`**: depending
on `bitcoind` would bind this gateway to the user's mainnet node and generate
templates for the wrong chain, which a Sia miner cannot mine and the node would
reject.

## Why 23336 and not 23335

23335 is not honoured as a preferred external port on StartOS: the binding is
assigned a random ephemeral port instead, leaving the user with a stratum address
that does not match anything documented. The identically-shaped 18444 binding in the
node package does get its preference, nothing in DATUM's source uses 23335 (stratum
23334, API 7152, outbound pool 28915), and nothing was listening on it, so the cause
is unidentified. 23336 is honoured, verified on a fresh install.

**Read the address off the Interfaces tab regardless.** `preferredExternalPort` is a
request, not a reservation, so the assigned port can differ from this.

**And give miners the IP, not the `.local` name.** StartOS presents the hostname,
but ASIC firmware generally has no mDNS resolver, so the miner never connects and
reports only that the pool is not ready. Confirmed on a Goldshell HS-Box: identical
config failed on `worthy-maverick.local:23336` and connected immediately on
`192.168.5.14:23336`.

## Credentials

None are stored. The node writes an RPC cookie into its datadir and this package
reads it through a read-only mount of the node's volume, which is how the official
Datum package authenticates against the official Bitcoin package. It also reads the
node's `blake2b_headline` from the same mount, because the block at the activation
height must carry it in its coinbase or the node rejects it `bad-headline`.

When the node is not resolvable, no `rpcurl` is written at all rather than a dead
placeholder address, so the failure is visible instead of masked.

## The image also runs on Umbrel

The same image backs the Umbrel app in
[paulscode/umbrel-store](https://github.com/paulscode/umbrel-store)
(`paulscode-datum-blake2b`). Nothing about the gateway differs; what differs is
that Umbrel has no equivalent of a StartOS action, so two things the service
definition does here have to be done by the entrypoint there. Both are opt-in and
inert unless the environment asks for them, so the StartOS path is unchanged:

| Variable | Effect |
|---|---|
| `COOKIE_PATH` | Read the node's RPC cookie from this path when `RPC_USER` is unset, waiting up to two minutes for it to appear. On StartOS the service definition reads the cookie and passes the halves in as `RPC_USER`/`RPC_PASSWORD`, so this stays unset. |
| `AUTO_PAYOUT_FROM_NODE=1` | When no payout address is set, ask the node for one (`getnewaddress "" legacy`) and persist it to `/data/payout_address`. On StartOS the **Set Payout Address** action and its critical task cover this, so it stays unset. |

The Umbrel `report` container also gets `RPC_URL` and `COOKIE_PATH` and a read-only
mount of the node's datadir, so it can check block acceptance. On StartOS the
action mounts the same dependency volume and passes the same two values.

**Blocks in the report.** `mining.save_submitblocks_dir` points at `/data/submitted`,
so the gateway writes one small JSON file per submitted block, named by its hash.
The entrypoint clears that directory on start, the same way the capture log is
truncated, so a report covers one session. `report.py` reads the hashes and asks
the node `getblockheader` for each, counting only those with `confirmations >= 1`
as accepted.

Only the node can answer that question, and it is a different question from
accepted shares: shares are the gateway's opinion, a block in the chain is the
node's. The `h1` version-bit bug lived exactly in that gap, with healthy share
stats and every block rejected. When the node cannot be reached the report says
"acceptance not checked" and why, rather than reporting zero.

`capture/report_server.py` is the third piece: a one-page web front end that runs
`report.py` and shows the result in a copyable box. It is the Umbrel app's tile,
and is not used on StartOS, where the **Create Compatibility Report** action does
the same job with a real form. Both shell out to the same `report.py`, so the two
platforms produce identical reports.

Legacy addresses are not an arbitrary choice in either place: DATUM's address
parser understands the `bc` and `tb` bech32 prefixes only
([`datum_utils.c`](https://github.com/OCEAN-xyz/datum_gateway/blob/main/src/datum_utils.c)),
so a regtest `bcrt1` address is rejected downstream.

## Plain Docker

`docker/` carries a compose file and instructions for running the pair on a Linux
box with neither StartOS nor Umbrel, using the published images. It follows the
Umbrel wiring rather than the StartOS one, because that is the variant that needs
no prompting: the payout address comes from the node and the report is a page.

Two things differ from the Umbrel app. Host ports are overridable, since nothing
assigns them and a clash is a failed start rather than a warning. And `HOST_IP`
has to be passed on the command line, because there is no `exports.sh` to work it
out on the host.

## Configuration

`store.json` on the main volume:

| Key | Default | Notes |
|---|---|---|
| `poolAddress` | empty | where block rewards go. Set with the **Set Payout Address** action |
| `vardiffMin` | 64 | starting share difficulty; vardiff adapts from here |

`poolAddress` is prompted as a **critical task on install**, which blocks the service
from starting until it is set. There is no safe default: inventing an address would
send the user's block rewards somewhere they do not control.

### A note on input validation

The action validates the address **in its handler**, not only through the input
`patterns`. The pattern was observed not to be enforced on the
`start-cli package action run` path: a mainnet address passed straight through and
became the payout address, despite a correct anchored regex that rejects it. The
guide states patterns are checked on every path into an action, so this looks like a
discrepancy worth reporting upstream. Until then the handler check is the real gate,
and it is the one that matters here.

## Build

```
make ARCHES=x86            # install does NOT rebuild; always build first
make ARCHES=x86 install
```

Bump `startos/versions/current.ts` when testing a change: StartOS treats installing
an unchanged version as a no-op.

## Status

Builds, installs and runs on StartOS 0.4.0.1. **Verified end to end from another
machine on the LAN**: a CPU miner connected over stratum, was served BLAKE2b work,
and the node accepted the resulting blocks with no `high-hash` rejections.

**Verified with a real ASIC.** A stock Goldshell HS-Box (firmware 2.2.4, MCB_V5_4,
hardware 40.40.HA) in Sia mode connected, received BLAKE2b work, and mined blocks the
node accepted: **0 high-hash and 0 bad-headline rejections**, tip a 164-byte header
v2. No firmware changes.

## Reporting a device

Reports go to the Bitcoin section of the forum, <https://paulscode.com/c/bitcoin/8>,
which needs a free account to post in. A GitHub issue on this repo works equally well
for anyone who already has an account there, and has an issue form that prompts for
each field.

The forum is listed first deliberately: the audience for these packages is people
with a home server and a miner, not people who have used a bug tracker.

## Compatibility matrix

| Device | Firmware | Connects | Jobs | Shares accepted | Blocks | Firmware changes |
|---|---|---|---|---|---|---|
| Goldshell HS-Box (SC mode) | 2.2.4 / MCB_V5_4 | yes | yes | 41 of 41 | yes | none |
| Bitmain Antminer A3 | CGminer 4.9.0 | yes | yes | 158 of 161 | not reported | none |
| NVIDIA GPU, `ccminer-tpfuemp -a sia` | 2026.07.2, CUDA 11.8 | connects | **rejects them** | 0 | 0 | n/a |

"not reported" for the A3 because the report could not see blocks when it was
generated. It can now, so later reports state it.

## ccminer does not work, and the reason is structural

Tested directly, on an RTX 3090 and a Quadro RTX 8000, with
[tpfuemp/ccminer-tpfuemp](https://github.com/tpfuemp/ccminer-tpfuemp) at
`c80c73ff` built against CUDA 11.8. It advertises `sia  SIA (Blake2B)` and its
kernel is the right primitive: `blake2b_update(&ctx, input, 80)`, a BLAKE2b-256
over an 80-byte header, the same as profile 0.

It still cannot mine here. It never reaches the point of hashing:

```
[..] Stratum notify: invalid parameters
[..] Stratum authentication failed
[..] ...retry after 30 seconds
```

The gate is in ccminer's generic `stratum_notify` (`util.cpp`):

```c
if (... || strlen(nbits) != 8 || strlen(stime) != 8) {
    applog(LOG_ERR, "Stratum notify: invalid parameters");
```

Our `ntime` is 16 hex characters, 8 bytes, which is the Sia convention every ASIC
tested here uses. ccminer's sia path requires 8 hex, 4 bytes, the Bitcoin
convention. That check is not sia-specific; it is the shared parser.

**Widening `ntime` would not be enough**, and this part is read from ccminer's
source rather than measured, because it never got far enough to measure. Its
Sia stratum is a different dialect throughout:

| | this gateway (and the ASICs) | ccminer `-a sia` |
|---|---|---|
| `ntime` on the wire | 8 bytes | 4 bytes |
| `nonce` in submit | 8 bytes | 4 bytes |
| `extranonce2` | 8 bytes | 2 bytes |
| the 32-byte root | `BLAKE2b(0x00000000 ‖ coinb1 ‖ xn1 ‖ xn2)` | `coinbase[0..31]` taken literally |
| header layout | `prevhash ‖ nonce(8) ‖ ntime(8) ‖ root(32)` | `prevhash ‖ nonce(8) ‖ ntime(4) ‖ nbits(4) ‖ root(32)` |

It is built for the siamining/nanopool style of Sia pool, which hands the miner a
finished merkle root and a Bitcoin-shaped time field. Ours hands out a coinbase
prefix to hash, as the ASICs expect. Both are called "Sia stratum" and they are
not the same protocol.

So a GPU miner for this chain is a real piece of work rather than a matter of
finding the right flag: either patch ccminer's sia path to the ASIC dialect, or
port `lab/harness/siaminer.py`, which already speaks it correctly on CPU.

Dialect, from a capture:

```
user agent       : intminer
subscribe        : 2 params, [ua, session-id]   resumes sessions on reconnect
extranonce1      : 4 bytes    extranonce2_size: 8
submit           : 5 params, widths 5,16,16,16,16   (Sia 8-byte ntime/nonce)
difficulty       : honoured, vardiff tracked 64 -> 1024 -> 512
non-standard     : none
```

**Worth knowing for pool operators:** this device opens a bare TCP connection roughly
every 3.1 seconds that never sends `mining.subscribe`, alongside one long-lived
session that does all the mining. In one 177 s capture that was 58 connections but
only 2 stratum sessions. Anything that rate-limits, bans, or bills per connection
will see roughly 20 no-op connections per minute per miner.

The A3 result is a user report from the forum, not something run here, and it is the
more interesting of the two because nothing about it is shared with the HS-Box: a
different vendor, and stock CGminer rather than vendor firmware. The dialect came out
identical in every field that matters.

```
user agent       : cgminer/4.9.0
subscribe        : 1 param, [ua]                 no session resumption
extranonce1      : 4 bytes    extranonce2_size: 8
submit           : 5 params, widths 34,16,16,16,16   (Sia 8-byte ntime/nonce)
difficulty       : honoured, vardiff tracked 64 -> 1024 -> 512
non-standard     : none
one TCP connection, one stratum session, 7474 s
```

Two differences from the HS-Box, neither a compatibility problem. It subscribes with
one parameter and never offers a session id, where the HS-Box sends two and resumes.
And it holds a single connection for the whole session rather than opening a bare one
every few seconds, so the rate-limiting note above is specific to the Goldshell, not
to Sia miners generally.

The 34-character worker name is worth a glance: that is the length of a legacy
address, and pool convention trains people to put `address.worker` in that field.
It is ignored here, as the instructions say, so it did no harm.

Three `stale-prevblk` out of 161 is the tip moving under a long session, not a
dialect issue. 486 jobs with 142 `clean_jobs` over two hours is a regtest chain
advancing quickly.

**What this report cannot show:** whether the node accepted a block. The capture sees
the stratum conversation only, and an accepted share is not a block. On regtest nearly
every accepted share clears the block target too, so blocks were very likely found,
but the report has no way to say so and neither should we.
