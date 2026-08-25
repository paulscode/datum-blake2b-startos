import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  coinbase_tag_secondary: Value.text({
    name: i18n('Secondary Coinbase Tag'),
    description: i18n(
      'Free text placed in the coinbase of blocks this gateway builds. Yours to label blocks with.',
    ),
    required: false,
    default: null,
    placeholder: 'DATUM User',
  }),
  coinbase_unique_id: Value.number({
    name: i18n('Coinbase Unique ID'),
    description: i18n(
      'A number from 1 to 65535, distinguishing two gateways that share the same coinbase tags.',
    ),
    required: false,
    default: null,
    placeholder: '4242',
    min: 1,
    max: 65535,
    integer: true,
  }),
})

/**
 * Two settings the official package's Mining form has are missing here, both
 * because this package already owns them.
 *
 * **The payout address** has its own action, Set Payout Address, which is
 * raised as a critical task on install so a user cannot start mining to
 * nowhere. Duplicating it as a form field would give the same value two
 * editors.
 *
 * **The primary coinbase tag** is the node's `blake2b_headline`, read from the
 * node's own config rather than typed here. The block at the activation height
 * is rejected unless its coinbase carries that exact string, and DATUM does not
 * inject `coinbaseaux.blake2b_headline`, so the headline has to arrive as the
 * primary tag. A user editing it would be editing a consensus value with no
 * indication that is what they were doing.
 */
export const miningConfig = sdk.Action.withInput(
  'mining-config',

  async () => ({
    name: i18n('Mining'),
    description: i18n('What goes into the blocks this gateway builds.'),
    warning: null,
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => readGroup(effects, 'mining'),

  async ({ effects, input }) => writeGroup(effects, 'mining', input),
)
