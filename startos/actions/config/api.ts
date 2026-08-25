import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  allow_insecure_auth: Value.toggle({
    name: i18n('Allow Insecure Authentication'),
    description: i18n(
      'Permit a weaker login exchange for the dashboard. Safari needs this; other browsers do not.',
    ),
    warning: i18n(
      'This lowers the security of the dashboard login. Use it only on a network you trust.',
    ),
    default: false,
  }),
})

/**
 * The password is not here. It has its own action, Dashboard Password, which
 * also generates one on install, and the official package separates it the same
 * way. The listen port is this package's own and not offered.
 */
export const apiConfig = sdk.Action.withInput(
  'api-config',

  async () => ({
    name: i18n('API'),
    description: i18n('Settings for the gateway dashboard.'),
    warning: null,
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => readGroup(effects, 'api'),

  async ({ effects, input }) => writeGroup(effects, 'api', input),
)
