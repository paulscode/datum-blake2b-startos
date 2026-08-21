import { i18n } from './i18n'
import { sdk } from './sdk'
import { capturePort, stratumPort, uiPort } from './utils'

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

  // Opt-in recording port, for reporting a new ASIC model. Same protocol as the
  // normal one; the only difference is that the conversation is written down.
  const captureMulti = sdk.MultiHost.of(effects, 'capture')
  const captureOrigin = await captureMulti.bindPort(capturePort, {
    protocol: null,
    addSsl: null,
    preferredExternalPort: capturePort,
    secure: { ssl: false },
  })
  const capture = sdk.createInterface(effects, {
    name: i18n('Stratum (compatibility test)'),
    id: 'capture',
    description: i18n(
      'Same mining, but the conversation is recorded so you can report how your miner behaves. Use the normal Stratum address otherwise.',
    ),
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
  const ui = sdk.createInterface(effects, {
    name: i18n('Dashboard'),
    id: 'ui',
    description: i18n('Gateway status and share counts'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  return [
    await stratumOrigin.export([stratum]),
    await captureOrigin.export([capture]),
    await uiOrigin.export([ui]),
  ]
})
