# Updating the upstream version

DATUM Gateway is **built from source, from a fork, pinned by commit**. There is no
`dockerTag` in the manifest and no release tarball: the pin is the `DATUM_REF` ARG in
[Dockerfile](Dockerfile).

```dockerfile
ARG DATUM_REPO=https://github.com/paulscode/datum_gateway.git
ARG DATUM_REF=beb946154dde86b69d9afd008974198ddd08bc4c
```

**A commit, not a branch or a tag.** A branch name is a moving target, and this is the one
input that decides whether the work handed to an ASIC matches consensus. The commit is
written to `/src/PINNED_COMMIT` during the build, so the running image always states what
it actually built.

## Two upstreams, not one

`paulscode/datum_gateway` is a fork of [`OCEAN-xyz/datum_gateway`](https://github.com/OCEAN-xyz/datum_gateway),
and both matter.

**Is the fork behind OCEAN?** Compare the pin against OCEAN's default branch. `ahead_by`
counts what OCEAN has that the pin does not:

```sh
gh api repos/OCEAN-xyz/datum_gateway/compare/<DATUM_REF>...master \
  --jq '"ahead_by=\(.ahead_by) behind_by=\(.behind_by)"'
```

At the 2026-09-04 pin this reads `ahead_by=0 behind_by=16`: OCEAN has nothing the fork
lacks, and the fork carries sixteen commits of its own. `behind_by` going up is the fork
gaining work; `ahead_by` going up is OCEAN releasing something to merge.

**What are the fork's own commits, and are they upstreamed?** Open PRs against OCEAN are
the ones that can retire:

```sh
gh pr list -R OCEAN-xyz/datum_gateway --author paulscode --state all
```

A carried change that OCEAN merges should be dropped from the fork on the next rebase
rather than left to conflict.

## Applying the bump

1. Push the new work to `paulscode/datum_gateway` first. The build fetches the ref from
   GitHub with `--depth 1`, so an unpushed local commit fails the build rather than
   silently building something else.
2. Update `DATUM_REF` in `Dockerfile` to the full 40-character SHA.
3. **Do the same in [`datum-sha256-startos`](https://github.com/paulscode/datum-sha256-startos).**
   Both packages build the same gateway from the same commit and differ only in the node
   they pair with. Letting the two pins drift means two gateways behaving differently for
   no reason anyone will remember.
4. Rebuild and re-run `--test`, which checks the gateway against Knots' own published
   header-v2 vectors rather than against itself. That comparison is the one that catches
   the gateway and the node disagreeing.

## What is not tracked here

`mining.pow_algorithm` stays `auto`, so the gateway takes its proof of work from the node.
Nothing about the chain is pinned in this file, and a BLAKE2b activation height changing
upstream is a node concern, not a gateway one.
