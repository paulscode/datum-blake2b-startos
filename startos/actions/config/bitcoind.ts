import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  work_update_seconds: Value.number({
    name: i18n('Work Update Seconds'),
    description: i18n(
      'How often to check the node for a new block template, in seconds.',
    ),
    required: false,
    default: null,
    placeholder: '5',
    min: 1,
    max: 120,
    integer: true,
    units: 's',
  }),
  notify_fallback: Value.toggle({
    name: i18n('Notify Fallback'),
    description: i18n(
      'Poll the node for new blocks as a backstop, in case its block notification does not arrive.',
    ),
    default: true,
  }),
})

/**
 * The RPC address and credentials are absent on purpose: they come from the
 * node package over the bridge, and its cookie through a read-only mount. There
 * is nothing for a user to fill in and a wrong value here would only break the
 * connection that already works.
 */
export const bitcoindConfig = sdk.Action.withInput(
  'bitcoind-config',

  async () => ({
    name: i18n('Bitcoind'),
    description: i18n('How the gateway talks to your Bitcoin node.'),
    warning: null,
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => readGroup(effects, 'bitcoind'),

  async ({ effects, input }) => writeGroup(effects, 'bitcoind', input),
)
