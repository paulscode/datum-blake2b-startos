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
  )
})
