import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  pool_host: Value.text({
    name: i18n('Pool Host'),
    description: i18n(
      'Hostname of a DATUM pool. Leave empty to mine solo, which is the only mode that works on this chain today.',
    ),
    required: false,
    default: null,
  }),
  pool_port: Value.number({
    name: i18n('Pool Port'),
    description: i18n('Port of that pool.'),
    required: false,
    default: null,
    placeholder: '28915',
    min: 1,
    max: 65535,
    integer: true,
  }),
  pool_pubkey: Value.text({
    name: i18n('Pool Public Key'),
    description: i18n('The pool’s public key, which authenticates it to you.'),
    required: false,
    default: null,
  }),
  pool_pass_workers: Value.toggle({
    name: i18n('Pass Worker Names'),
    description: i18n('Send each miner’s worker name to the pool.'),
    default: false,
  }),
  pool_pass_full_users: Value.toggle({
    name: i18n('Pass Full Usernames'),
    description: i18n('Send the whole username, not just the worker part.'),
    default: true,
  }),
  always_pay_self: Value.toggle({
    name: i18n('Always Pay Self'),
    description: i18n(
      'Pay block rewards to your own address rather than the pool’s.',
    ),
    default: true,
  }),
  pooled_mining_only: Value.toggle({
    name: i18n('Pooled Mining Only'),
    description: i18n(
      'Refuse to serve work when the pool is unreachable, instead of falling back to solo.',
    ),
    warning: i18n(
      'On this chain there is no pool to fall back from, so turning this on stops mining entirely.',
    ),
    default: false,
  }),
  protocol_global_timeout: Value.number({
    name: i18n('Protocol Timeout'),
    description: i18n('Seconds of silence before the pool is treated as gone.'),
    required: false,
    default: null,
    placeholder: '60',
    min: 1,
    integer: true,
    units: 's',
  }),
})

/**
 * Pooled mining does not work on this chain, and that is not a gap this package
 * can close.
 *
 * A DATUM pool validates shares against the chain's proof of work, so a BLAKE2b
 * share is unintelligible to a SHA256d pool. Ocean's pool server is
 * closed-source and SHA256d-only, and GridPool's testnet4 endpoint is ordinary
 * testnet4. Neither can serve this chain.
 *
 * The settings are offered anyway rather than hidden, because a user coming
 * from the official package will look for them, and because if a pool operator
 * ever runs the fork these are what would point at it. The warning says so
 * rather than letting someone discover it by mining into silence.
 */
export const datumConfig = sdk.Action.withInput(
  'datum-config',

  async () => ({
    name: i18n('DATUM Pool'),
    description: i18n('Settings for mining to a DATUM pool.'),
    warning: i18n(
      'No pool serves this chain today. A pool checks shares against the chain’s proof of work, and every DATUM pool is SHA256d, so it cannot check a BLAKE2b share. These settings are here for if that changes; leaving them empty means solo mining, which does work.',
    ),
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => readGroup(effects, 'datum'),

  async ({ effects, input }) => writeGroup(effects, 'datum', input),
)
