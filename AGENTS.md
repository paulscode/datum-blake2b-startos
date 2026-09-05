# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

**Start every task at the recipe index** — `../start-technologies/projects/start-sdk/docs/src/recipes.md`
(or <https://docs.start9.com/packaging/recipes.html>). It maps an intent ("prompt the user to create
admin credentials", "expose a web UI") to the constructs, the reference pages, and a named production
package to copy. Find the recipe before you read this package's neighbours: a package you reach by
grepping may be non-conformant, and the recipe outranks it.

Freshly scaffolded? Work the
[New Package Checklist](../start-technologies/projects/start-sdk/docs/src/new-package-checklist.md)
(or <https://docs.start9.com/packaging/new-package-checklist.html>) from top to bottom. It is a
guide page, not a file in this repo — read it, don't copy it in.

Keep `README.md` (technical reference for an AI support or administering agent) and
`instructions.md` (end-user docs) in sync with your changes.

**Bugs and feature requests are GitHub issues on this repo** — file them as you find them.
Don't record work in the repo instead: no `TODO.md`, no `NOTES.md`, no `PLAN.md`. What you
verified, tried, and decided belongs in the commit message and the PR body.

## This repo

- **The gateway image is shared with `datum-sha256-startos`, and the chain is not baked into it.** Both packages build from the same `paulscode/datum_gateway` commit and both leave `mining.pow_algorithm` at `auto`, so the gateway takes SHA256d or BLAKE2b from whichever node it is pointed at. A change to `Dockerfile` or `entrypoint.sh` here almost certainly belongs in that package too; diff them before assuming otherwise.
- **`entrypoint.sh` regenerates `datum_gateway_config.json` from the environment on every start, so `api.modify_conf` is `false`.** Anything the dashboard's Config page wrote would be discarded on the next restart, and offering an edit that silently reverts is worse than not offering it. **This is the one place the package deliberately differs by platform:** the Umbrel app runs the gateway directly against a file its pre-start hook patches, precisely so `modify_conf` can be `true` and the dashboard can be the settings UI. Do not "fix" the difference in either direction.
- **`RESERVED` in `entrypoint.sh` is a safety rail, not a list of settings.** Keys in it are owned by the package and silently dropped from a user override, because letting a user set `bitcoind.rpcurl` or `mining.pow_algorithm` breaks the pairing in ways that read as a crash. Adding a config action means checking the key is not reserved first; `GROUPS` exists for the same reason, so an unknown group cannot be invented in the config file where the gateway would ignore it without complaint.
- **There is no default payout address and there must not be one.** A default means mining someone else's blocks to somebody else's wallet. `setPayoutAddress` validates in the handler as well as in the field `patterns`, because the pattern was observed not to be enforced on the `start-cli package action run` path, and `watchPayoutAddress` raises a `critical` task that blocks startup until one is set.
- **Address validation must not ask the node which chain it is on.** It used to, and that deadlocked a fresh install: the node records the chain when it starts, and the critical task stopped it from starting (issue #3). The gateway serves one chain now, so the prefixes are known statically and the form checks them itself while the service is stopped.