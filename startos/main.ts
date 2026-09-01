import { FileHelper } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { manifest as knotsManifest } from 'knots-blake2b-startos/startos/manifest'
import {
  chainDataSubdir,
  chainFromConf,
  rpcHostId as knotsRpcHostId,
  rpcPort as knotsRpcPort,
} from 'knots-blake2b-startos/startos/utils'
import { sdk } from './sdk'
import {
  captureLog,
  capturePort,
  dataDir,
  knotsMountpoint,
  stratumPort,
  uiPort,
} from './utils'

// The node's stable contract. Its *internal* port and host id are what may be
// relied on; its external port is assigned at runtime and must never be assumed.
const KNOTS_PKG = 'knots-blake2b'

/**
 * Pull one figure off the gateway's status page.
 *
 * `wget` rather than `curl`: the runtime image carries wget and not curl, unlike
 * the official package's. Returns an empty string on any failure, which the
 * callers treat as "not available" rather than "unhealthy".
 */
async function scrape(
  sub: { exec: (cmd: string[]) => Promise<{ stdout: unknown }> },
  port: number,
  label: string,
  strip: string,
): Promise<string> {
  try {
    const { stdout } = await sub.exec([
      'sh',
      '-c',
      `wget -q -T 3 -O - 127.0.0.1:${port} | grep -A1 '${label}' | tail -n 1 | sed 's/${strip}//g'`,
    ])
    return String(stdout).trim()
  } catch {
    return ''
  }
}

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Datum Gateway (BLAKE2b) Companion'))

  // Resolve the node over the LXC bridge from its binding's own address list.
  // Not `net.assignedPort`, which silently resolves null the day the dependency
  // changes how it binds. `.const()` rather than `.once()` so this heals if the
  // node is installed after us.
  const rpcAddr = await sdk.host
    .getBridgeAddress(effects, {
      packageId: KNOTS_PKG,
      hostId: knotsRpcHostId,
      internalPort: knotsRpcPort,
      ssl: false,
    })
    .const()

  const subcontainer = await sdk.SubContainer.eager(
    effects,
    { imageId: 'datum' },
    sdk.Mounts.of()
      .mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: dataDir,
        readonly: false,
      })
      // Read-only view of the node's datadir, purely to read its RPC cookie.
      // This is how the official Datum package authenticates against the
      // official Bitcoin package, and it means neither side has to generate,
      // store or hand around an RPC secret.
      .mountDependency<typeof knotsManifest>({
        dependencyId: KNOTS_PKG,
        volumeId: 'main',
        subpath: null,
        mountpoint: knotsMountpoint,
        readonly: true,
      }),
    'datum-sub',
  )

  const rootfs = await subcontainer.rootfs

  // The block at the activation height must carry the node's headline somewhere
  // in its coinbase or it is rejected `bad-headline`. DATUM does not inject
  // `coinbaseaux.blake2b_headline` and upstream closed the PR that would have
  // made it, so the headline has to reach the coinbase as a tag. Read it from the
  // node's own config through the mount we already have, rather than duplicating
  // it as a second setting that could silently drift out of agreement.
  const knotsConf = await FileHelper.string(
    `${rootfs}${knotsMountpoint}/bitcoin.conf`,
  )
    .read(
      (c) => c,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  // Which chain the node is on, taken from the node's own generated config
  // rather than configured here. bitcoind keeps a non-mainnet chain's data,
  // including its RPC cookie, in a subdirectory named for that chain, and
  // mainnet's at the root, so this decides where to look for the cookie. Reading it instead of duplicating it means the two
  // cannot drift: the node package regenerates that file on every start, and the
  // reactive read above restarts the gateway when it changes.
  //
  // This used to be hardcoded to `regtest`, which broke silently the moment the
  // node was switched to another chain: the cookie was simply never found
  // and the gateway ran with no RPC credentials.
  //
  // The rule is not "find a `<chain>=1` line": mainnet has no such line,
  // because it is bitcoind's default and no `mainnet=1` option exists. A
  // search for a positive marker therefore concludes regtest on a mainnet
  // node and lands in exactly the failure this comment is about.
  // `chainFromConf` in the node package owns that rule so the two cannot
  // drift.
  const chain = chainFromConf(knotsConf)

  // bitcoind rewrites the cookie on every start, so treat a change as a reason
  // to restart the gateway. Absent means the node is down: let the dial fail and
  // the health check go red rather than fabricating credentials.
  // Mainnet keeps its files at the root of the data directory; every other
  // chain gets a subdirectory named for it. `chainDataSubdir` is empty for
  // mainnet, so this collapses to `<mount>/.cookie` there.
  const chainSubdir = chainDataSubdir(chain)
  const cookie = await FileHelper.string(
    chainSubdir
      ? `${rootfs}${knotsMountpoint}/${chainSubdir}/.cookie`
      : `${rootfs}${knotsMountpoint}/.cookie`,
  )
    .read(
      (c) => c,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  const store = await storeJson.read().const(effects)

  // The chain is deliberately NOT recorded here any more.
  //
  // It used to be merged into the store for Set Payout Address to read, and that was wrong twice.
  // It made the one action a user needs before the first start depend on a start having
  // happened, which on a fresh install is a deadlock: the critical task refuses to start the
  // service until an address is set. And it never worked at all, because `store` above is read
  // with `.const(effects)` and the SDK rejects a write to a file already read as a constant in
  // the same context. The merge threw "write after const" and took the whole start down.
  //
  // The action now reads the node's own config instead, which is this same source and cannot go
  // stale. See nodeChain.ts.

  const headline = knotsConf
    ?.split('\n')
    .find((l) => l.startsWith('blake2b_headline='))
    ?.slice('blake2b_headline='.length)
    .trim()

  const env: Record<string, string> = {
    STRATUM_PORT: String(stratumPort),
    API_PORT: String(uiPort),
    DATA_DIR: dataDir,
    // Per chain. A single field survived a chain switch and kept paying to the
    // previous chain's wallet, silently, because DATUM's address parser does
    // not care which network an address came from. No entry for this chain
    // means no address, which the critical task then asks for.
    POOL_ADDRESS: store?.poolAddresses?.[chain] ?? '',
    // Absent means absent: with no headline the entrypoint falls back to its own
    // tag, which is correct for every block except the activation block.
    ...(headline ? { BLAKE2B_HEADLINE: headline } : {}),
    VARDIFF_MIN: String(store?.vardiffMin ?? 64),
    ADMIN_PASSWORD: store?.adminPassword ?? '',
    // Everything the config actions set, as one JSON object that the entrypoint
    // merges over the config it generates. One variable rather than forty keeps
    // the Umbrel path (which has no actions and sets none of this) unchanged,
    // and means adding a setting touches the store shape and a form, not four
    // places. Unset keys are absent rather than null, so DATUM's own defaults
    // apply instead of ours.
    DATUM_SETTINGS: JSON.stringify(store?.config ?? {}),
  }

  // Absent means absent. Write nothing rather than a placeholder address that
  // cannot reach the node's container and only masks the real state.
  if (rpcAddr && cookie) {
    const [user, ...rest] = cookie.trim().split(':')
    env.RPC_URL = `http://${rpcAddr}`
    env.RPC_USER = user
    env.RPC_PASSWORD = rest.join(':')
  }

  return (
    sdk.Daemons.of(effects)
      // StartOS mounts volumes root-owned every start and the image runs as the
      // unprivileged `datum` user, so without this the gateway cannot write its
      // own config. Same fix as the node package; missing it here cost a
      // crash-loop on /data/datum.json: Permission denied.
      .addOneshot('chown', {
        subcontainer,
        exec: {
          command: ['chown', '-R', 'datum:datum', dataDir],
          user: 'root',
        },
        requires: [],
      })
      .addDaemon('gateway', {
        subcontainer,
        exec: { command: ['/usr/local/bin/entrypoint.sh'], env },
        ready: {
          display: i18n('Stratum'),
          // Reports `waiting`, not `failure`, while the port is closed, and the
          // distinction is the whole story of this check.
          //
          // DATUM does not bind stratum at startup. `datum_stratum_v1_socket_thread_init`
          // blocks on its first stratum job and only then starts the listener
          // ("Waiting for our first job before starting listening server..."), with
          // no timeout. No template means no job, and a node in initial sync has no
          // template to give, so on a fresh node this port stays shut for hours.
          //
          // `waiting` is the documented state for "blocked on an external
          // dependency", which is exactly true here: the gateway is fine and the
          // node is not ready. Red for hours would send someone looking for a fault
          // in the gateway rather than at their node's sync progress. Only
          // `success` gates a dependent, so the `capture` daemon still waits either
          // way and nothing about startup ordering changes.
          fn: async () => {
            const res = await sdk.healthCheck.checkPortListening(
              effects,
              stratumPort,
              {
                successMessage: i18n('The gateway is serving work'),
                errorMessage: i18n('The gateway is not serving work yet'),
              },
            )
            if (res.result === 'success') return res
            return {
              result: 'waiting' as const,
              message: i18n(
                'Waiting for the node. The stratum port opens once this gateway has its first block template, which needs a node that has finished syncing.',
              ),
            }
          },
        },
        requires: ['chown'],
      })
      // Recording proxy for the opt-in compatibility-test port. Forwards to the
      // gateway untouched; a miner on the normal port never touches it. Capped
      // so an unattended capture cannot fill the volume.
      .addDaemon('capture', {
        subcontainer,
        exec: {
          command: [
            'python3',
            '/usr/local/bin/stratumtap.py',
            '--listen',
            `0.0.0.0:${capturePort}`,
            '--upstream',
            `127.0.0.1:${stratumPort}`,
            '--log',
            captureLog,
            '--max-bytes',
            String(8 * 1024 * 1024),
          ],
        },
        ready: {
          display: i18n('Compatibility capture'),
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, capturePort, {
              successMessage: i18n('Ready to record a miner'),
              errorMessage: i18n('Not recording yet'),
            }),
        },
        requires: ['gateway'],
      })
      /**
       * Dashboard reachability, and the two figures the official Datum Gateway
       * package puts on its service page. A user coming from that package
       * expects to see connected clients and hashrate without opening the
       * dashboard, and those are the numbers that say whether mining is working.
       *
       * Scraped from the gateway's own status page rather than an API, because
       * DATUM exposes no unauthenticated JSON for them. The page itself needs no
       * password; only /clients, /threads and /config do.
       *
       * A scrape that comes back empty reports success with a note rather than
       * failure: the number not being available is not the service being
       * unhealthy, and a red mark for a missing statistic would train users to
       * ignore the health checks.
       */
      .addHealthCheck('dashboard', {
        requires: ['gateway'],
        ready: {
          display: i18n('Dashboard'),
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, uiPort, {
              successMessage: i18n('The dashboard is ready'),
              errorMessage: i18n('The dashboard is not ready'),
            }),
        },
      })
      /**
       * Whether a miner could connect right now.
       *
       * Named `stratum-interface` to match the official Datum package, because a
       * dependent names the checks it requires and StartOS treats an id that does
       * not exist exactly like one that is failing. Without this, anything written
       * against the official gateway could not require a check from this one.
       *
       * `display: null`, so it exists as a contract without appearing in the UI.
       * The `gateway` daemon's own ready check already probes this port and is
       * shown as "Stratum". Two visible rows for one condition is worse than one,
       * and they would inevitably drift: this one and that one would have to be
       * kept saying the same thing forever. The user reads "Stratum"; a dependent
       * requires this id; neither is duplicated.
       *
       * The port is what it reports, deliberately, rather than mirroring the
       * daemon's state. `requires: ['gateway']` already means this cannot run
       * before the daemon is ready, so in practice it answers the same question,
       * but a check that probes the thing it names is one less indirection to
       * reason about if the daemon's readiness ever means something else.
       */
      .addHealthCheck('stratum-interface', {
        requires: ['gateway'],
        ready: {
          display: null,
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, stratumPort, {
              timeout: 1000,
              successMessage: i18n('Miners can connect'),
              errorMessage: i18n(
                'Waiting for the node. The stratum port opens once this gateway has its first block template, which needs a node that has finished syncing.',
              ),
            }),
        },
      })
      .addHealthCheck('stratum-clients-connected', {
        requires: ['gateway'],
        ready: {
          display: i18n('Miners connected'),
          trigger: sdk.trigger.cooldownTrigger(10000),
          fn: async () => {
            const num = await scrape(
              subcontainer,
              uiPort,
              'Total Work Subscriptions',
              '[^0-9]',
            )
            return num
              ? {
                  result: 'success' as const,
                  message: `${i18n('Miners connected')}: ${num}`,
                }
              : {
                  result: 'success' as const,
                  message: i18n('Could not read the number of miners'),
                }
          },
        },
      })
      .addHealthCheck('estimated-hashrate', {
        requires: ['gateway'],
        ready: {
          display: i18n('Estimated hashrate'),
          trigger: sdk.trigger.cooldownTrigger(10000),
          fn: async () => {
            const num = await scrape(
              subcontainer,
              uiPort,
              'Estimated Hashrate:',
              '[^0-9.]',
            )
            return num
              ? {
                  result: 'success' as const,
                  message: `${i18n('Estimated hashrate')}: ${num} Th/s`,
                }
              : {
                  result: 'success' as const,
                  message: i18n('Could not read the hashrate'),
                }
          },
        },
      })
  )
})
