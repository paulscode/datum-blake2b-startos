import { storeJson } from '../../fileModels/store.json'
import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  vardiff_min: Value.number({
    name: i18n('Minimum Difficulty'),
    description: i18n(
      'Starting share difficulty. Vardiff adapts from here; a low value lets a slow hasher produce shares immediately on connect.',
    ),
    required: false,
    default: null,
    placeholder: '64',
    min: 1,
    integer: true,
  }),
  vardiff_target_shares_min: Value.number({
    name: i18n('Target Shares Per Minute'),
    description: i18n('Shares per minute vardiff aims each miner at.'),
    required: false,
    default: null,
    placeholder: '8',
    min: 1,
    integer: true,
  }),
  vardiff_quickdiff_count: Value.number({
    name: i18n('Quick Difficulty Count'),
    description: i18n(
      'Shares in a row above target before difficulty is raised early instead of waiting for the next window.',
    ),
    required: false,
    default: null,
    placeholder: '8',
    min: 1,
    integer: true,
  }),
  vardiff_quickdiff_delta: Value.number({
    name: i18n('Quick Difficulty Delta'),
    description: i18n('How much to raise difficulty by when that triggers.'),
    required: false,
    default: null,
    placeholder: '8',
    min: 1,
    integer: true,
  }),
  share_stale_seconds: Value.number({
    name: i18n('Share Stale Seconds'),
    description: i18n(
      'How old a share may be before it is rejected as stale.',
    ),
    required: false,
    default: null,
    placeholder: '120',
    min: 1,
    integer: true,
    units: 's',
  }),
  fingerprint_miners: Value.toggle({
    name: i18n('Fingerprint Miners'),
    description: i18n(
      'Identify mining hardware from how it behaves, so the dashboard can name it.',
    ),
    default: true,
  }),
  max_clients_per_thread: Value.number({
    name: i18n('Max Clients Per Thread'),
    description: i18n('Miners each stratum thread will accept.'),
    required: false,
    default: null,
    placeholder: '1000',
    min: 1,
    integer: true,
  }),
  max_threads: Value.number({
    name: i18n('Max Threads'),
    description: i18n('Stratum threads to run.'),
    required: false,
    default: null,
    placeholder: '8',
    min: 1,
    integer: true,
  }),
  max_clients: Value.number({
    name: i18n('Max Clients'),
    description: i18n('Miners accepted in total, across all threads.'),
    required: false,
    default: null,
    placeholder: '8000',
    min: 1,
    integer: true,
  }),
  trust_proxy: Value.number({
    name: i18n('Trust Proxy'),
    description: i18n(
      'Trust this many proxy hops when reading a miner’s address, for setups behind a reverse proxy.',
    ),
    required: false,
    default: null,
    placeholder: '0',
    min: 0,
    integer: true,
  }),
  idle_timeout_no_subscribe: Value.number({
    name: i18n('Idle Timeout: No Subscribe'),
    description: i18n(
      'Drop a connection that never subscribes, after this many seconds. 0 disables.',
    ),
    required: false,
    default: null,
    placeholder: '15',
    min: 0,
    integer: true,
    units: 's',
  }),
  idle_timeout_no_shares: Value.number({
    name: i18n('Idle Timeout: No Shares'),
    description: i18n(
      'Drop a subscribed miner that never sends a share, after this many seconds. 0 disables.',
    ),
    required: false,
    default: null,
    placeholder: '7200',
    min: 0,
    integer: true,
    units: 's',
  }),
  idle_timeout_max_last_work: Value.number({
    name: i18n('Idle Timeout: Max Last Work'),
    description: i18n(
      'Drop a miner that has sent nothing for this many seconds. 0 disables.',
    ),
    required: false,
    default: null,
    placeholder: '0',
    min: 0,
    integer: true,
    units: 's',
  }),
})

/**
 * The listen port is absent: it is this package's contract with the miner and
 * with the compatibility-capture port beside it, and changing it would leave
 * the stratum address shown in the UI pointing nowhere.
 *
 * `vardiff_min` lives at the top level of the store rather than under `config`,
 * because it predates this form and moving it would need a migration for no
 * gain. This form is its editor either way.
 */
export const stratumConfig = sdk.Action.withInput(
  'stratum-config',

  async () => ({
    name: i18n('Stratum'),
    description: i18n('How the gateway serves work to your mining hardware.'),
    warning: null,
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const group = await readGroup(effects, 'stratum')
    const vardiffMin = await storeJson.read((s) => s.vardiffMin).const(effects)
    return { ...group, vardiff_min: vardiffMin ?? null }
  },

  async ({ effects, input }) => {
    const { vardiff_min, ...rest } = input as any
    if (typeof vardiff_min === 'number') {
      await storeJson.merge(effects, { vardiffMin: vardiff_min })
    }
    await writeGroup(effects, 'stratum', rest)
  },
)
