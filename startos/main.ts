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

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Datum Gateway BLAKE2b (regtest)'))

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
  const cookie = await FileHelper.string(
    `${rootfs}${knotsMountpoint}/regtest/.cookie`,
  )
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
    POOL_ADDRESS: store?.poolAddress ?? '',
    VARDIFF_MIN: String(store?.vardiffMin ?? 64),
  }

  // Absent means absent. Write nothing rather than a placeholder address that
  // cannot reach the node's container and only masks the real state.
  if (rpcAddr && cookie) {
    const [user, ...rest] = cookie.trim().split(':')
    env.RPC_URL = `http://${rpcAddr}`
    env.RPC_USER = user
    env.RPC_PASSWORD = rest.join(':')
  }

  return sdk.Daemons.of(effects).addDaemon('gateway', {
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
    requires: [],
  })
})
