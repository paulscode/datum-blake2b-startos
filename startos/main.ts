import { FileHelper } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { manifest as knotsManifest } from 'knots-blake2b-startos/startos/manifest'
import {
  rpcHostId as knotsRpcHostId,
  rpcPort as knotsRpcPort,
} from 'knots-blake2b-startos/startos/utils'
import { sdk } from './sdk'
import { dataDir, knotsMountpoint, stratumPort, uiPort } from './utils'

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

  // bitcoind rewrites the cookie on every start, so treat a change as a reason
  // to restart the gateway. Absent means the node is down: let the dial fail and
  // the health check go red rather than fabricating credentials.
  //
  // One fixed path. The node package follows BLAKE2b on mainnet and nothing
  // else, and mainnet keeps its files at the root of the data directory. This
  // used to read the node's generated bitcoin.conf, work out its chain with the
  // node package's own `chainFromConf`, and derive the subdirectory a named
  // chain would put the cookie in. All of that is gone with the chain selector.
  const cookie = await FileHelper.string(`${rootfs}${knotsMountpoint}/.cookie`)
    .read(
      (c) => c,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  const store = await storeJson.read().const(effects)

  const env: Record<string, string> = {
    STRATUM_PORT: String(stratumPort),
    API_PORT: String(uiPort),
    DATA_DIR: dataDir,
    // No safe default. An address invented here would send the user's block
    // rewards somewhere they do not control, so empty means the critical task
    // in init/watchPayoutAddress asks for one and the service does not start.
    POOL_ADDRESS: store?.poolAddress ?? '',
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
      /**
       * The daemon is ready when its dashboard answers, which is what the
       * official Datum Gateway package keys on and is the right thing here too.
       *
       * It used to key on the stratum port, and that was wrong in a way that
       * only shows on a node still syncing. DATUM does not bind stratum at
       * startup: `datum_stratum_v1_socket_thread_init` blocks on its first
       * stratum job and only then starts the listener ("Waiting for our first
       * job before starting listening server..."), with no timeout. No template
       * means no job, and a node in initial sync has no template to give, so
       * that port stays shut for hours. Since every other check here declares
       * `requires: ['gateway']`, keying readiness off it meant none of them ran
       * during exactly the period a user most wants to see them.
       *
       * The dashboard, by contrast, is up as soon as the process is. Whether a
       * miner can connect is now reported by `stratum-interface` below, where it
       * belongs.
       */
      .addDaemon('gateway', {
        subcontainer,
        exec: { command: ['/usr/local/bin/entrypoint.sh'], env },
        ready: {
          display: i18n('Web Interface'),
          fn: () =>
            sdk.healthCheck.checkPortListening(effects, uiPort, {
              successMessage: i18n('The Datum Gateway dashboard is ready'),
              errorMessage: i18n('The Datum Gateway dashboard is not ready'),
            }),
        },
        requires: ['chown'],
      })
      /**
       * Whether a miner could connect right now.
       *
       * Named `stratum-interface` to match the official Datum package, because a
       * dependent names the checks it requires and StartOS treats an id that does
       * not exist exactly like one that is failing. Without this, anything written
       * against the official gateway could not require a check from this one.
       *
       * Visible, and labelled as the official package labels it. It used to be
       * hidden, because the daemon's own ready check probed this same port and
       * two rows for one condition is worse than one. The daemon now reports the
       * dashboard, so this is the only place the stratum port is reported and
       * there is nothing to duplicate.
       *
       * Reports `waiting` rather than `failure` while the port is closed, and
       * that distinction is the whole story of this check. `waiting` is the
       * documented state for "blocked on an external dependency", which is
       * exactly true: the gateway is fine and the node is not ready. Red for
       * hours would send someone looking for a fault in the gateway rather than
       * at their node's sync progress.
       */
      .addHealthCheck('stratum-interface', {
        requires: ['gateway'],
        ready: {
          display: i18n('Stratum Interface'),
          fn: async () => {
            const res = await sdk.healthCheck.checkPortListening(
              effects,
              stratumPort,
              {
                timeout: 1000,
                successMessage: i18n('Miners can connect'),
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
      })
      /**
       * The two figures the official Datum Gateway package puts on its service
       * page. A user coming from that package expects to see connected clients
       * and hashrate without opening the dashboard, and those are the numbers
       * that say whether mining is working.
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
      .addHealthCheck('stratum-clients-connected', {
        requires: ['gateway'],
        ready: {
          display: i18n('Number of Stratum Clients Connected'),
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
          display: i18n('Estimated Hashrate'),
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
