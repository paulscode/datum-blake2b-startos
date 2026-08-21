# Datum Gateway BLAKE2b (regtest)

This turns your BLAKE2b node's block templates into work an existing
Sia-compatible BLAKE2b ASIC can mine, and hands it out over Stratum on your LAN.

**This is an experiment on a private test chain.** The coins it mines are worthless
by construction and there is no network to join. It exists so you can find out
whether your miner works with the proposed BLAKE2b proof of work.

## Before you start

You need **Bitcoin Knots BLAKE2b (regtest)** installed and running. Not the regular
Bitcoin service: that chain uses SHA256d, which a Sia miner cannot mine at all.

## Setup

### 1. Get a payout address

Every block you mine pays to an address you choose. To get one:

1. Open **Bitcoin Knots BLAKE2b (regtest)**.
2. Make sure it is **running**.
3. Go to **Actions** and run **Get Payout Address**.
4. Copy the address it shows you. It starts with `m`, `n` or `2`.

It is a regtest address, so it only means anything on this test chain. Nothing else
will accept it and nothing of value can be sent to it.

### 2. Tell the gateway where to pay

1. Come back to this service.
2. Go to **Actions** and run **Set Payout Address**.
3. Paste the address in and save.

The service will not start until you have done this. There is no default, because a
default would mean sending your block rewards to somebody else.

### 3. Start it, and find your Stratum address

Start the service, then open its **Interfaces** tab and copy the **Stratum**
address. It looks like:

```
stratum+tcp://your-server.local:23336
```

**Read it from that tab rather than copying the port from here.** StartOS assigns
the port and can pick a different one.

### 4. Point your miner at it

In your miner's own web interface, set the pool to that Stratum address.

**The worker name and password are not used.** You do not put your payout address
here. Some pools want `address.workername` as the username; this does not, because
it is not pooled mining. The payout comes entirely from the address you set in step
2, and DATUM's own documentation is explicit that Stratum usernames "have no effect
whatsoever" in non-pooled mode.

Put something readable like `hsbox` so you can tell miners apart on the dashboard,
and anything at all as the password.

Then watch the **Dashboard** interface on this service. Once the miner connects you
should see its hashrate and shares climbing.

## What "working" looks like

- The miner shows a connected pool and a hashrate.
- The Dashboard shows accepted shares going up.
- The node's block height goes up.

Because this is a private test chain with almost no difficulty, blocks come very
fast. That is expected and is not a sign that your miner is unusually good.

## If it does not work

**The miner connects but nothing happens.** Check that the node is running and past
its first block. The Dashboard shows whether the gateway is getting templates.

**The miner will not connect.** Check the Stratum address on the Interfaces tab
matches what you typed, including the port, and that your miner is on the same
network as the server.

**Shares are rejected.** Your miner may speak a different Stratum dialect than the
one this serves. That is worth reporting, with the miner's make, model and firmware
version.

## Which miners work

Verified: **Goldshell HS-Box** in Sia mode, on stock firmware, no changes.

Other Sia BLAKE2b miners are expected to work but have not been tested. If you try
one, reporting the result either way is useful.
