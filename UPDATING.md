# Updating the upstream version

DATUM Gateway is **built from source, from a fork, pinned by commit**. There is no
`dockerTag` in the manifest and no release tarball: the pin is the `DATUM_REF` ARG in
[Dockerfile](Dockerfile).

```dockerfile
ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=301d5f28d8142d59fb7d2e726f3c99af023ac69d
```

**A commit, not a branch or a tag.** A branch name is a moving target, and this is the one
input that decides whether the work handed to an ASIC matches consensus. The commit is
written to `/src/PINNED_COMMIT` during the build, so the running image always states what
it actually built.

## The branch is layered, and each layer has an upstream

The pin is on `blake2b-full-payout-2`, built in this order:

1. **[CONVOYMining/datum_gateway](https://github.com/CONVOYMining/datum_gateway) `master`**,
   the base. Convoy's pool protocol (the DRS handshake, anti-withholding) lives here,
   and the BLAKE2b pools on this chain require it.
2. **The coinbase class**: 32,000 bytes / 1024 outputs, and only two classes (TINY and
   YUGE). iohzrd's sigop limit and 164-byte header weight fit, and our dupe index fix,
   are in Convoy's master now and no longer carried.
3. **Ours**: password difficulty (`d=`/`fd=`, opt-in via `stratum.password_difficulty`),
   empty-work subsidy from the template, Obelisk SC1 Gen 2, the advertised stratum
   endpoint, local share reject reasons, and the full-template coinbase test.
4. **Lazarus's late-coinbaser patch**
   ([AwokenLazarus/Bitcoin](https://github.com/AwokenLazarus/Bitcoin), `lazarus/patches`).

**What to check on a bump:**

```sh
cd <clone>   # remotes: origin = CONVOY, iohzrd, ours = paulscode
git fetch --all
git log --oneline <pin>..origin/master   # Convoy work we do not have
git log --oneline <pin>..iohzrd/master   # iohzrd work we do not have
gh pr list -R CONVOYMining/datum_gateway --author paulscode --state all
```

When Convoy merges something we carry (from iohzrd, Lazarus or us), drop our copy on the
next rebase rather than let it conflict. When rebasing, build and run `--test` on **every**
commit, not only the tip, and check by hand what auto-merged around the extranonce2 and
coinbase code: Convoy's submit refactor once auto-merged a fixed 16-character extranonce2
check that would have refused every Obelisk share, with no conflict to flag it.

## Applying the bump

1. Push the new work to `paulscode/datum_gateway` first. The build fetches the ref from
   GitHub with `--depth 1`, so an unpushed local commit fails the build rather than
   silently building something else.
2. Update `DATUM_REF` in `Dockerfile` to the full 40-character SHA.
3. **Not in [`datum-sha256-startos`](https://github.com/paulscode/datum-sha256-startos).**
   That package stays on our OCEAN-based fork (`ad57651`) on purpose: SHA256d miners do
   see the coinbase, so the size classes and fingerprinting matter there, and Convoy's
   BLAKE2b protocol does not.
4. Rebuild and re-run `--test`, which checks the gateway against Knots' own published
   header-v2 vectors rather than against itself. That comparison is the one that catches
   the gateway and the node disagreeing.

## What is not tracked here

Convoy's fork has no `mining.pow_algorithm`; it reads the proof of work from the node's GBT rules directly.
Nothing about the chain is pinned in this file, and a BLAKE2b activation height changing
upstream is a node concern, not a gateway one.
