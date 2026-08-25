import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { dashboardUser, defaultPasswordSpec } from '../utils'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  password: Value.text({
    name: i18n('Dashboard password'),
    description: i18n(
      'The password for the dashboard’s admin pages. The username is always “admin”. Leave it as it is to keep the current one, or use Generate for a new one. Clearing it turns the admin pages off.',
    ),
    required: false,
    default: null,
    masked: true,
    generate: defaultPasswordSpec,
  }),
})

/**
 * The dashboard's admin password.
 *
 * Without one, DATUM's dashboard is much less useful than it looks. `/clients`,
 * the page listing each connected miner with its hashrate, accepted and rejected
 * share difficulty and user agent, is refused outright rather than degraded
 * (`datum_api.c`, `datum_api_client_dashboard`). `/threads` falls back to a
 * reduced view, `/config` becomes read-only, and the kick commands are gone. So
 * "is my miner actually working" was a question the dashboard could not answer.
 *
 * DATUM stores this in its own config as plaintext and authenticates with HTTP
 * digest (`MHD_digest_auth_check2`), so writing it into the config is the
 * intended path, not a workaround. Confirmed by reading `datum_conf.c` and
 * `datum_api.c` rather than assumed: the usual hazard with credentials in config
 * files is an app expecting a salted hash, and this one does not.
 *
 * Generated on install so the dashboard works out of the box. This action exists
 * to show it, change it, or clear it.
 */
export const setDashboardPassword = sdk.Action.withInput(
  'set-dashboard-password',

  async () => ({
    name: i18n('Dashboard Password'),
    description: i18n(
      'Show or change the password for the dashboard’s admin pages, which is what lets you see connected miners.',
    ),
    warning: i18n(
      'The gateway restarts to apply a change. Mining hardware reconnects on its own.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => ({
    password: (await storeJson.read((s) => s.adminPassword).once()) ?? '',
  }),

  async ({ effects, input }) => {
    const password = (input.password ?? '').trim()
    await storeJson.merge(effects, { adminPassword: password })

    return {
      version: '1' as const,
      title: i18n('Dashboard Password'),
      message: password
        ? i18n(
            'The dashboard’s admin pages are on. Sign in with the username and password below to see your connected miners.',
          )
        : i18n(
            'The dashboard’s admin pages are off. The dashboard still shows gateway status, but not the list of connected miners.',
          ),
      result: {
        type: 'group' as const,
        name: i18n('Dashboard Password'),
        description: null,
        value: [
          {
            type: 'single' as const,
            name: i18n('Username'),
            description: null,
            value: dashboardUser,
            masked: false,
            copyable: true,
            qr: false,
          },
          {
            type: 'single' as const,
            name: i18n('Password'),
            description: null,
            value: password || i18n('(admin pages disabled)'),
            masked: !!password,
            copyable: !!password,
            qr: false,
          },
        ],
      },
    }
  },
)
