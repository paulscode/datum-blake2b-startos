# datum-blake2b

DATUM Gateway serving Sia-style BLAKE2b work, so an existing Sia-compatible ASIC can
mine the experimental BLAKE2b Bitcoin Knots chain. Packaged for StartOS 0.4.0.x.

**Follows whichever chain the node is on** (regtest or testnet4), and **solo mining
only**: pooled BLAKE2b is not possible today because the pool server is
closed-source and SHA256d-only.

The chain is not a setting here. It is read from the node's own generated
`bitcoin.conf` through the read-only mount this package already has, because
bitcoind keeps each chain's data, including its RPC cookie, in a subdirectory
named for that chain. Reading it rather than duplicating it means the two cannot
drift; the node regenerates that file on every start and the reactive read
restarts the gateway when it changes. This used to be hardcoded to `regtest`,
which broke silently the moment the node was switched to testnet4: the cookie was
never found and the gateway ran with no RPC credentials at all.

Pooled mining is worth restating because it comes up: no DATUM pool can serve this
chain, and that is not a matter of anyone adding an endpoint. A pool validates
shares against the chain's proof of work, so a BLAKE2b share is unintelligible to
a SHA256d pool. GridPool's `datum.test.gridpool.net:3009` is ordinary testnet4 and
cannot help.

## The dashboard's admin pages

DATUM gates its most useful pages on `admin_password`, and blank disables them.
Measured with no password set: `/clients`, `/threads` and `/config` all return
**401 with no way to authenticate**, leaving only the status page. `/clients` is
the one that matters, since it is the per-miner table: thread and client id,
remote host, worker name, vardiff, accepted and rejected share difficulty,
hashrate and user agent. Without it the dashboard cannot answer "is my miner
working".

So the package generates a password on install rather than prompting for one:
there is no answer only the user can give, and a blank value is a strictly worse
default. The **Dashboard Password** action shows it, changes it, or clears it to
turn the pages off again. The username is `admin`, which DATUM hardcodes.

DATUM stores the password as plaintext in its own config and authenticates with
HTTP digest (`MHD_digest_auth_check2`), so writing it into the config is the
intended path rather than a workaround. Confirmed by reading `datum_conf.c` and
`datum_api.c`: the usual hazard with credentials in config files is an app
expecting a salted hash, and this one does not.

`modify_conf` stays `false`. The config is regenerated from the StartOS settings
on every start, so anything the dashboard wrote into it would be discarded on the
next restart, and offering an edit box over a file about to be overwritten is
worse than not offering one.

Verified with a real login against the live testnet4 chain: no credentials 401,
correct digest 200 with the miner table, wrong password 401, and a connected CPU
miner appearing in `/clients` with its worker name, vardiff and share counts.

Maintained by Paul Lamb (<https://github.com/paulscode>). Not affiliated with Start9
or OCEAN.

## Parity with the official package

The settings, their groupings and their names follow
[`Start9Labs/datum-gateway-startos`](https://github.com/Start9Labs/datum-gateway-startos)
(MIT), so a user who knows that package finds the same things in the same places.
Six config actions under a **Config** group: Bitcoind, Stratum, Mining, API,
Logger, DATUM Pool. Plus the same two service-page figures, **Miners connected**
and **Estimated hashrate**, scraped from the gateway's own status page.

Deliberate differences, all of them because this package already owns the
setting or because the setting cannot work here:

| Official has | Here | Why |
|---|---|---|
| `pool_address` in the Mining form | its own **Set Payout Address** action | raised as a critical task on install, so mining cannot start with rewards going nowhere. One editor, not two |
| `coinbase_tag_primary` in the Mining form | read from the node's `blake2b_headline` | the activation block is rejected unless its coinbase carries that exact string, and DATUM does not inject `coinbaseaux.blake2b_headline`. Editing it would be editing a consensus value unmarked |
| `admin_password` via **Reset Password** | **Dashboard Password**, generated on install | same separation, but generated rather than prompted: unlike the payout address there is no answer only the user can give |
| listen ports, RPC credentials, `modify_conf` | not offered | this package's own wiring. A user who changed them would break the service with no way to tell that is what happened |
| a typed model of `datum_gateway_config.json` | settings in `store.json`, merged by `entrypoint.sh` | the image also has to run on Umbrel and plain Docker, which have no actions. One `DATUM_SETTINGS` variable carries the whole set; absent, DATUM's defaults apply |

The merge refuses to write the settings above even if something hands them in,
and refuses unknown groups, because `entrypoint.sh` is also the hand-run path.
Verified: `admin_password`, `listen_port` and `pool_address` passed in
`DATUM_SETTINGS` were all rejected while the package's real values survived.

Extra here, with no counterpart upstream: the opt-in compatibility-capture port
and its report, `pow_algorithm`, `save_submitblocks_dir`, and following the
node's chain.

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

## Chain selection without a settings form

StartOS has actions. Umbrel and plain Docker have nothing, so the page this image
already serves gained a **Network** card: a chain dropdown and a payout address,
and nothing else. Headline and peers are derived from the chain rather than
offered, because they are consensus and curation, not preferences.

The mechanism is a settings file both services read and watch:

```
/config/settings.json   {"chain": "...", "payout_address_<chain>": "..."}
```

The report container is the only writer, and writes via a temporary file and
rename, because the readers watch by hash and would restart for a half-written
one. `/config` is created in both Dockerfiles owned by the runtime user, which is
what makes a fresh named volume writable without anything running as root.

Three things this cost, all found by running it rather than reading it:

**A watcher guarded on the file existing never starts.** The first time anyone
uses the page there is no settings file, so a watcher that only runs when one is
present is never running when the file appears. It now treats absent as a state
and watches unconditionally.

**PID 1 discards signals it has no handler for.** With `exec`, the service is
PID 1, and `kill -TERM 1` did nothing to `datum_gateway`: it logged "restarting to
apply" and carried on. bitcoind installs a handler and did restart, which made the
bug look like a gateway problem rather than a signal one. The shell now stays
PID 1, runs the service as a child, forwards `TERM` and `INT`, and waits.

**Finding a cookie is not the same as having credentials.** Each chain keeps its
own directory, so after a switch the previous chain's cookie is still on disk. The
gateway restarts faster than the node and read the stale one, then every call came
back 401 while the service looked healthy and simply never got a template. It now
tries each candidate against `getblockchaininfo` and takes the first that answers,
which also yields the chain, so what authenticated and what names the payout cache
cannot disagree.

Verified end to end on a live stack: regtest to testnet4 and back from the page,
both services restarting themselves, per-chain addresses derived (`mvbAuPxS…` and
`tb1q7jq3…`) and both retained, zero 401s after the switch, mining working
afterwards, and `bcrt1`, mainnet and unknown-chain inputs all rejected without
touching the stored settings.

`bcrt1` is rejected on purpose despite being a valid regtest address: DATUM's
parser only understands the `bc` and `tb` bech32 prefixes, so accepting one would
crash-loop the gateway with "Could not generate output script for pool addr".

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
| `adminPassword` | generated on install | gates the dashboard's `/clients`, `/threads` and `/config` pages. Blank turns them off |
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
| Goldshell SC5 Pro | 2.2.0 / 30.50.SA | yes | yes | 272 of 299 | 199 of 298 | none |
| Goldshell SC Box II | 2.2.2 / 20.10.SA | yes | yes | 382 of 384 | **346 of 383** | none |
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
| the 32-byte root | `BLAKE2b(0x00 ‖ coinb1 ‖ xn1 ‖ xn2)` | `coinbase[0..31]` taken literally |
| header hashed | `prevhash ‖ nonce(8) ‖ ntime(8) ‖ root(32)` | `prevhash ‖ nonce(8) ‖ ntime(4) ‖ zero(4) ‖ root(32)` |

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

The SC Box II is the fourth device and the third Goldshell, and the only one so far
with a trustworthy block figure. Its first report was unusable and its second, on
1.0.0:18, is the confirmation that both the build fix and the attribution fixes
work in the field:

| | first report | second, on 1.0.0:18 |
|---|---|---|
| environment | gateway `ab3e922c` | gateway `e0437de6`, tooling `d28515094899` |
| shares | 166 of 190 | 382 of 384 |
| blocks | 985 submitted vs 563 shares | 383 submitted vs 384 shares |
| blocks / shares | 1.75, impossible | 1.00, the expected shape |

The environment line is now generated by a build that can actually produce it, and
the block count sits just under the share count instead of well above it. Both
were predicted, and both came out.

**The block count is gateway-wide; the capture is one port.** `save_submitblocks_dir`
records every block the gateway submits, for every client on 23336 and 23337 alike,
while the capture proxy only ever sees the miner on 23337. That report claims 985
blocks against 563 shares, and one miner cannot produce more blocks than it sent
shares. Something else was mining through the same gateway, most likely the same
device on the normal port for part of the session.

Reproduced here with two miners, one per port: 5 shares on the capture port and 12
blocks recorded, with the old wording crediting all 12 to "this miner". The report
now refuses that claim and says why. Per-miner attribution is not recoverable, since
a submitblock record is the block and says nothing about which client found it.

### Refused blocks and raced blocks are not the same thing

A block the report cannot place has two possible fates, and the report used to
call both of them "did not accept":

| | meaning |
|---|---|
| accepted | on the best chain |
| lost a race | the node has it, it is just not the chain. Benign, and expected here |
| **refused** | the node has never heard of it. It rejected the block outright |

Only the third is a compatibility signal, and it is the one the `h1` version-bit
bug produced: every block refused, every share healthy. Folding it in with racing
meant the report could not tell a miner racing itself from a miner producing
garbage, and the verdict now leads with a refusal when there is one rather than
reporting a healthy share count above it.

The SC5-Pro's second report predates the split, so its 99 unplaced blocks cannot
be attributed retrospectively. Racing is the likely explanation and the numbers
support it rather than prove it: it found a block every 4.8 s while jobs arrived
every 2.05 s, and its 27 stale shares against the SC Box II's 2 say it was working
from a stale tip far more often. Both symptoms have the same cause. Its next report
will say outright.

### Hardware errors: what the evidence actually says

The reporter's device shows `HW-Error` above `accepted` on this chain, and none of
it at f2pool. An earlier version of this section said the miner was counting
interrupted work as errors, because blocks here arrive every few seconds. **That
explanation does not survive the device's own debug page**, and is withdrawn.

The per-chip breakdown is not the shape a work problem makes:

```
36 chips, 7 with any error, 609 total
  worst single chip   422   69% of all errors
  top three chips     593   97%
```

Every chip receives the same work. A format or protocol mismatch, or jobs being
replaced mid-computation, would land on all 36 roughly evenly, at about 17 each.
Three chips carrying 97% is a hardware distribution. It also fits what the counter
means in cgminer-lineage firmware: a nonce the chip returned that fails the host's
re-hash, meaning the chip miscomputed. Work that is merely stale hashes correctly
and never reaches that counter.

So the likely reading is three marginal chips, provoked by conditions here that a
real pool does not create, rather than by anything wrong in the work:

| | here | a Sia pool |
|---|---|---|
| a new job | every 1.9 s (350 block-driven, 741 refreshes) | tens of seconds |
| share difficulty | 64 to 2048 | far higher |
| nonce returns per chip | constant | rare |

Both raise how often a marginal chip is reloaded and how often it returns
something, which is how many chances it gets to return something wrong.

**The f2pool comparison narrows less than it looks.** It changes the work format,
the difficulty, the job rate and the chain all at once, so it cannot separate "our
work is wrong" from "our conditions provoke marginal silicon". Two settings can
separate them on this chain, one variable at a time:

- **`work_update_seconds`**, default 5, settable 1 to 120. At 60 the 741 non-clean
  refreshes drop to roughly 35 while the 350 block-driven ones stay. A sharp fall
  in errors points at reload churn.
- **`vardiff_min`**. Raising it means fewer, harder shares, so fewer nonce returns
  and a slower chain. A fall points at return rate.

Testnet4 answers it too and is worth doing, but it changes every one of those at
once, so it confirms rather than isolates.

**What the ratio should look like.****What the ratio should look like.** On regtest `powLimit` is about 2^255, so the
block target is trivially easy while the share target at vardiff 64 to 4096 is far
harder. Any share a real miner gets accepted therefore also clears the block target,
and blocks should track shares almost exactly. The A3's 107 blocks against 107
shares is the expected shape. Our own `--probe` runs sit below 1.0 because they
submit arbitrary nonces that clear the block target and fail the share target. Above
1.0 means more than one miner.

The SC5 Pro is a second Goldshell, reported by a user over a 16.7 hour session, and
it settles the reconnect question. 209 TCP connections against 3 stratum sessions,
bare ones arriving every 3.1 s: the same figure and the same interval as the
HS-Box, on a different model. Both report `intminer` as their user agent, so this
is one firmware family behaving consistently, and the note aimed at pool operators
belongs to Goldshell rather than to Sia miners.

Two things in that report look like faults and are not.

**A 17-character job id on 2 of 190 submits.** That is ours. `datum_stratum.c`
builds a 14-hex job id and the wire form varies: a normal job is
`job_id(14) + cbselect(2)` = 16 characters, a `quickdiff` job is
`"Q" + job_id(14) + cbselect(2)` = 17. The `"N"` form is excluded for BLAKE2b. The
SC5 Pro's difficulty moved through five levels, the most of any device tested, so
quickdiff jobs were issued and it echoed two of them back correctly.

**A 12.6% `stale-prevblk` rate**, against roughly 1% on the other two devices. That
is the session, not the device. Over 60007 s it received a new job every 138 s, saw
a new block every 429 s, and found a share every 316 s at a vardiff that peaked at
16384. A share takes about as long to find as a block takes to arrive, so a good
fraction are superseded mid-search. Short sessions at low difficulty do not show
this; a 16 hour one does.

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

One difference from the HS-Box, and it is not a compatibility problem: the A3 holds
a single connection for the whole session, where the HS-Box opens a bare one every
few seconds. The rate-limiting note above is specific to the Goldshell, not to Sia
miners generally.

A second run from the same reporter offered a session id on subscribe (2 params,
widths 13,9) where the first sent one parameter. So session resumption is something
this device does sometimes, not something it never does. Worth remembering that a
single capture shows what a device did once, not what it always does.

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
