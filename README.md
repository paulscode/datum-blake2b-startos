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

## Credentials

None are stored. The node writes an RPC cookie into its datadir and this package
reads it through a read-only mount of the node's volume, which is how the official
Datum package authenticates against the official Bitcoin package. It also reads the
node's `blake2b_headline` from the same mount, because the block at the activation
height must carry it in its coinbase or the node rejects it `bad-headline`.

When the node is not resolvable, no `rpcurl` is written at all rather than a dead
placeholder address, so the failure is visible instead of masked.

## Configuration

`store.json` on the main volume:

| Key | Default | Notes |
|---|---|---|
| `poolAddress` | empty | where block rewards go. **The service refuses to start until this is set**, because inventing an address would send the user's coins to a stranger |
| `vardiffMin` | 64 | starting share difficulty; vardiff adapts from here |

There is no UI for this yet. It currently has to be written into `store.json` by
hand, which is the main gap before a non-technical user can use this package.

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

Not verified: a real ASIC against this package (proven only against the host and
plain-Docker stacks), and there is no action for setting the payout address.
