import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  coinbase_tag_primary: Value.text({
    name: i18n('Primary Coinbase Tag'),
    description: i18n(
      'Free text placed in the coinbase of blocks this gateway builds, when mining solo. Leave blank to use the value this chain requires at its activation block. A pool overrides this.',
    ),
    required: false,
    default: null,
    placeholder: 'DATUM Gateway',
  }),
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
 * **The primary coinbase tag** used to be missing here, locked to the node's
 * `blake2b_headline`, on the grounds that editing it would be editing a
 * consensus value unknowingly. That was too broad. The headline is consensus for
 * exactly one block on any chain, the one at the activation height:
 * `validation.cpp` runs the check only when
 * `block.m_height == DeploymentHeight(DEPLOYMENT_BLAKE2B)`. Everywhere else the
 * field is what DATUM says it is, "text to have in the primary coinbase tag when
 * not using pool", which is a label for your own blocks.
 *
 * So it is editable, and blank still means "use the headline", which keeps a
 * private chain working with nothing set. The entrypoint holds the one case that
 * matters: if the node has not yet reached the activation height, it appends the
 * headline to whatever was chosen rather than dropping either, and refuses if the
 * two together exceed DATUM's 60-byte field rather than truncating. A truncated
 * headline is a rejected block that looks like bad luck.
 *
 * On mainnet this is already moot. Activation was block 961640 on 30 August 2026,
 * so any block mined now is past it.
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
