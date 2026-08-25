import { FileHelper } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { manifest as knotsManifest } from 'knots-blake2b-startos/startos/manifest'
import {
  chains as knotsChains,
  defaultChain as knotsDefaultChain,
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
  console.info(i18n('Starting Datum Gateway BLAKE2b'))

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
  // rather than configured here. bitcoind keeps each chain's data, including its
  // RPC cookie, in a subdirectory named for that chain, so this decides where to
  // look for the cookie. Reading it instead of duplicating it means the two
  // cannot drift: the node package regenerates that file on every start, and the
  // reactive read above restarts the gateway when it changes.
  //
  // This used to be hardcoded to `regtest`, which broke silently the moment the
  // node was switched to testnet4: the cookie was simply never found and the
  // gateway ran with no RPC credentials.
  const chain =
    knotsChains.find((c: string) =>
      knotsConf?.split('\n').some((l) => l.trim() === `${c}=1`),
    ) ?? knotsDefaultChain

  // bitcoind rewrites the cookie on every start, so treat a change as a reason
  // to restart the gateway. Absent means the node is down: let the dial fail and
  // the health check go red rather than fabricating credentials.
  const cookie = await FileHelper.string(
    `${rootfs}${knotsMountpoint}/${chain}/.cookie`,
  )
    .read(
      (c) => c,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  const store = await storeJson.read().const(effects)

  // Record it for the actions. They run outside this function, without the
  // node's volume mounted, so they cannot work the chain out for themselves and
  // would otherwise have to guess what a valid payout address looks like.
  if (store?.detectedChain !== chain) {
    await storeJson.merge(effects, { detectedChain: chain })
  }

  const headline = knotsConf
    ?.split('\n')
    .find((l) => l.startsWith('blake2b_headline='))
    ?.slice('blake2b_headline='.length)
    .trim()

  const env: Record<string, string> = {
    STRATUM_PORT: String(stratumPort),
    API_PORT: String(uiPort),
    DATA_DIR: dataDir,
    POOL_ADDRESS: store?.poolAddress ?? '',
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
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, stratumPort, {
              successMessage: i18n('The gateway is serving work'),
              errorMessage: i18n('The gateway is not serving work yet'),
            }),
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
              ? { result: 'success' as const, message: `${i18n('Miners connected')}: ${num}` }
              : { result: 'success' as const, message: i18n('Could not read the number of miners') }
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
              ? { result: 'success' as const, message: `${i18n('Estimated hashrate')}: ${num} Th/s` }
              : { result: 'success' as const, message: i18n('Could not read the hashrate') }
          },
        },
      })
  )
})
