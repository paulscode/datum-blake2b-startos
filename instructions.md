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

Start the service, then open its **Interfaces** tab and find the **Stratum**
address.

**Use your server's IP address, not its `.local` name.** The Interfaces tab will
show something like `stratum+tcp://your-server.local:23336`, but most ASIC firmware
cannot resolve `.local` names: they have no mDNS resolver, so the miner silently
never connects and its own screen just says the pool is not ready. Substitute the
IP:

```
stratum+tcp://192.168.1.50:23336
```

Your server's IP is on its **System** page. **Read the port from the Interfaces
tab** rather than copying it from here: StartOS assigns it and may pick a different
one.

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

**The miner will not connect**, or says the pool is not ready. Nine times out of
ten this is the `.local` name: replace it with the server's IP address. Most ASIC
firmware cannot resolve `.local`, and fails silently rather than saying so. Then
check the port matches the Interfaces tab, and that the miner is on the same
network as the server.

**Shares are rejected.** Your miner may speak a different Stratum dialect than the
one this serves. That is worth reporting, with the miner's make, model and firmware
version.

## Reporting a miner nobody has tried

If your miner is not listed below, a report helps the upstream projects make BLAKE2b
mining work on more hardware.

1. On the **Interfaces** tab, find **Stratum (compatibility test)**. It is a second
   address on a different port from the normal one.
2. Point your miner at it, using the server's IP address, and let it run for a minute
   or two. It mines exactly as normal; the only difference is that the conversation
   is written down.
3. Run the **Create Compatibility Report** action. Fill in make, model and firmware
   if you know them, and anything odd you noticed.

   The report says whether your node accepted the blocks your miner found, not
   just whether the gateway liked its shares. Those are different things, and the
   block one is what actually matters.
4. Copy what it gives you and share it in the Bitcoin section of the forum:
   <https://paulscode.com/c/bitcoin/8>

   Posting needs a free account, so sign up or log in first, then start a topic and
   paste the report in. Say which miner it was and that is enough.

If you already use GitHub, an issue on
<https://github.com/paulscode/datum-blake2b-startos/issues> does just as well and
has a form that prompts for each field. Either route reaches the same place, so use
whichever you find easier.

Nothing is sent anywhere on its own: you see exactly what you are sharing before you
share it, and worker names are hashed and passwords dropped before anything reaches
disk.

To test a second miner, restart this service first. That starts a fresh capture, so
two miners do not get blended into one report.

Switch back to the normal Stratum address when you are done.

## Which miners work

Two so far, from different manufacturers, both on stock firmware with no changes:

**Goldshell HS-Box** (firmware 2.2.4, MCB_V5_4) in Sia mode. Tested here. It
connects, receives BLAKE2b work, and the blocks it finds are accepted with no
rejections.

**Bitmain Antminer A3** (CGminer 4.9.0). Reported by a user. 158 of 161 shares
accepted over a two-hour session. The three that were not are the ordinary kind of
rejection you get when the chain moves on while a share is in flight, not a sign
of anything wrong.

**Goldshell SC5 Pro** (firmware 2.2.0). Reported by a user, over a 16 hour run.
166 of 190 shares accepted.

**Goldshell SC Box II** (firmware 2.2.2). Reported by a user. 382 of 384 shares
accepted, and the node accepted 346 of the 383 blocks it found.

The A3 is the most encouraging of the four, because it has nothing in common with
the three Goldshells: different manufacturer, and stock CGminer rather than the
vendor's own firmware. All four spoke to the gateway identically.

**Your miner may report a lot of hardware errors, and that is this test chain
rather than your miner.** Blocks here are found every few seconds, and every block
your miner finds throws away the work it had in progress. Your miner's own screen
counts that discarded work as errors. What matters is whether shares and blocks are
being accepted, which the report tells you.

**Some rejected shares are normal**, and the longer you run, the more you will see.
A share is found for a particular block; if a new block turns up while your miner
is still working, that share arrives too late and is rejected. On a test chain
where blocks come quickly this is common. The SC5 Pro report above had 24 of them
over 16 hours and was working perfectly throughout.

Other Sia BLAKE2b miners are expected to work but have not been tried. If you try
one, reporting the result either way is useful, including when it works.

## What about GPUs?

Not with the obvious candidate. `ccminer` has a `sia` algorithm that computes
exactly the right hash, and it was tested here on an RTX 3090 and a Quadro
RTX 8000. It never gets as far as hashing: it rejects the work this gateway sends
and retries in a loop.

The reason is that "Sia stratum" means two different things. The ASICs speak one
version, with 8-byte time and nonce fields and a coinbase the miner hashes itself.
ccminer speaks the version used by the Sia pools, with 4-byte fields and a
ready-made merkle root. This gateway serves the ASIC one, because ASICs are the
point.

So a GPU miner for this chain is possible but nobody has written one yet. It would
mean teaching an existing miner the other dialect, not finding the right setting.


## Seeing your miners

The dashboard's **Clients** page lists everything connected to the gateway: the
worker name, its share difficulty, how many shares it has had accepted and
rejected, and its hashrate. That is the page that answers "is my miner actually
working".

It asks for a username and password. The username is `admin`, and the password is
in the **Dashboard Password** action, which also lets you change it. A password is
created for you when the service is installed, so this works without any setup.

Clearing the password in that action turns those pages off again. The main status
page never asks for anything.
