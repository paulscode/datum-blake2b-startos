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
  work_update_seconds: Value.number({
    name: i18n('Work Update Seconds'),
    description: i18n(
      'Seconds between routine work updates sent to miners. A new block is picked up immediately regardless. The gateway enforces at least 5.',
    ),
    required: false,
    default: null,
    placeholder: '5',
    // DATUM raises anything under 5 to 5 (datum_conf.c), so a lower value here
    // was a setting that silently did nothing.
    min: 5,
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

  async ({ effects }) => {
    const group = await readGroup(effects, 'bitcoind')
    // Earlier versions accepted 1 to 4, which the gateway already ran as 5. Show
    // what it runs, so an old value does not block saving this form.
    const w = (group as any).work_update_seconds
    return typeof w === 'number' && w < 5 ? { ...group, work_update_seconds: 5 } : group
  },

  async ({ effects, input }) => {
    await assertTimingsAgree(effects, 'bitcoind', input)
    return writeGroup(effects, 'bitcoind', input)
  },
)
