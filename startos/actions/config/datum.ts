import {
  assertTimingsAgree,
  CONFIG_GROUP,
  i18n,
  readGroup,
  sdk,
  writeGroup,
} from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  pool_host: Value.text({
    name: i18n('Pool Host'),
    description: i18n(
      'Hostname of a DATUM pool. Convoy is the pool for this chain, at datum-beta1.mine.convoy.xyz on port 28915. Leave empty to mine solo.',
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
    description: i18n(
      'Leave this empty unless the pool publishes a key of its own. DATUM has one built in and uses it when this is unset, which is why a host and a port are usually all a pool asks for. A key given here must be 128 hex characters, being a signing key and an encryption key one after the other; any other length stops the gateway from starting.',
    ),
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
      'With no reachable pool, this stops mining rather than falling back to solo.',
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
 * Pooled mining works on this chain now, which it did not when this was written.
 *
 * A DATUM pool validates shares against the chain's proof of work, so a BLAKE2b
 * share is unintelligible to a SHA256d pool: Ocean's server is closed-source and
 * SHA256d-only, and GridPool's testnet4 endpoint is ordinary testnet4. On that
 * reasoning these settings shipped with a warning saying no pool served this
 * chain and solo was the only mode that worked.
 *
 * Convoy serves it, so that warning was telling people the opposite of the
 * truth and steering them away from a pool they could use. The text says what
 * the settings are for and leaves the choice where it belongs.
 *
 * The pool's public key is the one that bites: datum_pubkey_to_struct requires
 * exactly 128 hex characters, an ed25519 key and an x25519 key concatenated, and
 * anything else is fatal at startup rather than a validation error. Hence the
 * length in the description.
 */
export const datumConfig = sdk.Action.withInput(
  'datum-config',

  async () => ({
    name: i18n('DATUM Pool'),
    description: i18n('Settings for mining to a DATUM pool.'),
    warning: i18n(
      'Leave these empty to mine solo. To mine to a pool, fill them in with the details the pool publishes: a pool checks shares against the chain’s proof of work, so it has to be one that follows this chain rather than the one that kept SHA256d.',
    ),
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => readGroup(effects, 'datum'),

  async ({ effects, input }) => {
    await assertTimingsAgree(effects, 'datum', input)
    return writeGroup(effects, 'datum', input)
  },
)
