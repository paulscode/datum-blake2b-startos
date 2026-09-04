import { i18n } from './i18n'
import { sdk } from './sdk'
import { stratumPort, uiPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  // The ASIC-facing surface. This is the address the user pastes into their
  // miner's web UI, and the only reason this package exists.
  const stratumMulti = sdk.MultiHost.of(effects, 'stratum')
  const stratumOrigin = await stratumMulti.bindPort(stratumPort, {
    protocol: null,
    addSsl: null,
    preferredExternalPort: stratumPort,
    // `secure: { ssl: false }` declares a plaintext protocol deliberately, which
    // is what gets a LAN-reachable listener. `secure: null` allocates a port
    // reachable over lxcbr0 and nowhere else, so the miner could never see it.
    // Stratum v1 to a stock Sia ASIC is plain TCP; there is no TLS option here.
    secure: { ssl: false },
  })
  const stratum = sdk.createInterface(effects, {
    name: i18n('Stratum'),
    id: 'stratum',
    description: i18n('Point your BLAKE2b ASIC at this address'),
    type: 'p2p',
    masked: false,
    schemeOverride: { ssl: null, noSsl: 'stratum+tcp' },
    username: null,
    path: '',
    query: {},
  })

  const uiMulti = sdk.MultiHost.of(effects, 'ui')
  const uiOrigin = await uiMulti.bindPort(uiPort, {
    protocol: 'http',
    preferredExternalPort: uiPort,
  })
  // Named "Web UI" to match the official Datum Gateway package's interface,
  // because it is the same dashboard serving the same pages. Someone arriving
  // from that package should not have to work out that "Dashboard" is the thing
  // they already know.
  const ui = sdk.createInterface(effects, {
    name: i18n('Web UI'),
    id: 'ui',
    description: i18n('The web interface of Datum Gateway'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  return [await stratumOrigin.export([stratum]), await uiOrigin.export([ui])]
})
