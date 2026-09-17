import { storeJson } from '../../fileModels/store.json'
import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

/** Matches the `.catch()` on `vardiffMin` in the store schema. */
const DEFAULT_VARDIFF_MIN = 64

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
  // Capped at 150 because DATUM refuses to start above it, with
  // "stratum.share_stale_seconds must not exceed 150 (suggest 120)" during
  // config parsing. Verified against the binary. Without the cap the form
  // accepts a value that leaves the container unable to boot.
  share_stale_seconds: Value.number({
    name: i18n('Share Stale Seconds'),
    description: i18n(
      'How old a share may be before it is rejected as stale. DATUM allows at most 150.',
    ),
    required: false,
    default: null,
    placeholder: '120',
    min: 1,
    max: 150,
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
  // The hasher extranonce is a fixed 12 bytes; this is only how they are split
  // between the session id and the part a miner varies. A select rather than a
  // number because the gateway refuses to start on any other value, and a form
  // that accepts one would be a form that stops the service booting.
  extranonce2_size: Value.select({
    name: i18n('Extranonce2 Size'),
    description: i18n(
      'How many bytes of the extranonce your mining hardware varies. Leave this at 8 unless you run firmware with a 32-bit extranonce2, such as the Obelisk SC1 Gen 2, which refuses work at 8.',
    ),
    warning: i18n(
      'This changes what every miner on this gateway is told when it connects, not just one of them. Change it only if all your hardware accepts the new value, and watch for accepted shares afterwards.',
    ),
    default: '8',
    values: {
      '8': i18n('8 bytes — every other miner'),
      '4': i18n('4 bytes — Obelisk SC1 Gen 2'),
    },
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
    return {
      ...group,
      vardiff_min: vardiffMin ?? null,
      // A select carries a string; the stored value and DATUM's config are both
      // numbers, and unset reads as the default rather than as blank.
      extranonce2_size: String(group.extranonce2_size ?? 8) as '8' | '4',
    }
  },

  async ({ effects, input }) => {
    const { vardiff_min, extranonce2_size, ...rest } = input as any
    // Cleared means back to the default, not "keep what was there". Unlike the
    // fields in the `stratum` group this one cannot be absent: its schema is a
    // plain number with a `.catch(64)`, so there is no unset state to return to.
    // Treating a cleared field as "keep" would make this the one field in the
    // form that cannot be undone.
    await storeJson.merge(effects, {
      vardiffMin:
        typeof vardiff_min === 'number' ? vardiff_min : DEFAULT_VARDIFF_MIN,
    })
    // Written only when it is not DATUM's own default, like every other optional
    // key here: a null is dropped by writeGroup and the key is simply absent.
    await writeGroup(effects, 'stratum', {
      ...rest,
      extranonce2_size: extranonce2_size === '4' ? 4 : null,
    })
  },
)
