import { CONFIG_GROUP, i18n, readGroup, sdk, writeGroup } from './_shared'

const { InputSpec, Value } = sdk

// Keys are strings, not numbers: `Value.select` keys its values by string and
// `default` must be one of them. DATUM wants a number, so the handler converts.
const levels = {
  '0': i18n('All (most detail)'),
  '1': i18n('Debug'),
  '2': i18n('Info'),
  '3': i18n('Warning'),
  '4': i18n('Error (least detail)'),
}

const inputSpec = InputSpec.of({
  log_level_console: Value.select({
    name: i18n('Console Log Level'),
    description: i18n('How much detail reaches the service logs.'),
    values: levels,
    default: '1',
  }),
  log_to_file: Value.toggle({
    name: i18n('Log to File'),
    description: i18n(
      'Also write logs to a file on this service’s volume, in addition to the service logs.',
    ),
    default: false,
  }),
  log_level_file: Value.select({
    name: i18n('File Log Level'),
    description: i18n('How much detail reaches that file.'),
    values: levels,
    default: '1',
  }),
  log_rotate_daily: Value.toggle({
    name: i18n('Rotate Log Daily'),
    description: i18n('Start a new log file each day.'),
    default: false,
  }),
  log_calling_function: Value.toggle({
    name: i18n('Log Calling Function'),
    description: i18n(
      'Include the function each message came from. Useful when reporting a bug upstream.',
    ),
    default: true,
  }),
})

/**
 * `log_to_console` is not offered and is always on: it is how anything reaches
 * `start-cli package logs`, and a user who turned it off would have a service
 * that appeared to have stopped saying anything.
 */
export const loggerConfig = sdk.Action.withInput(
  'logger-config',

  async () => ({
    name: i18n('Logger'),
    description: i18n('How much the gateway writes about what it is doing.'),
    warning: null,
    allowedStatuses: 'any',
    group: CONFIG_GROUP,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const g = (await readGroup(effects, 'logger')) as any
    return {
      ...g,
      log_level_console:
        g.log_level_console != null ? String(g.log_level_console) : '1',
      log_level_file: g.log_level_file != null ? String(g.log_level_file) : '1',
    }
  },

  async ({ effects, input }) => {
    const i = input as any
    await writeGroup(effects, 'logger', {
      ...i,
      log_level_console: Number(i.log_level_console),
      log_level_file: Number(i.log_level_file),
    })
  },
)
