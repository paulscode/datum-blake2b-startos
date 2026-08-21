import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { captureLog, dataDir } from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  make: Value.text({
    name: i18n('Make'),
    description: i18n('Who makes it, e.g. Goldshell, Bitmain'),
    required: false,
    default: null,
  }),
  model: Value.text({
    name: i18n('Model'),
    description: i18n('e.g. HS-Box, SC-Box, Antminer A3'),
    required: false,
    default: null,
  }),
  firmware: Value.text({
    name: i18n('Firmware version'),
    description: i18n('From the miner’s own web interface, if you can find it'),
    required: false,
    default: null,
  }),
  notes: Value.text({
    name: i18n('Anything else worth saying'),
    description: i18n('What you tried, what it did, anything that looked odd'),
    required: false,
    default: null,
  }),
})

export const createCompatibilityReport = sdk.Action.withInput(
  'create-compatibility-report',

  async () => ({
    name: i18n('Create Compatibility Report'),
    description: i18n(
      'Summarise how your miner talked to this gateway, so the result can be shared with the upstream projects.',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,
  async () => ({}),

  async ({ effects, input }) => {
    // The summariser lives in the image next to the recorder, so the parsing
    // stays in one place and the action does not re-implement it in TypeScript.
    const report = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'datum' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: dataDir,
        readonly: true,
      }),
      'report',
      async (sub) => {
        const { stdout } = await sub.execFail([
          'python3',
          '/usr/local/bin/report.py',
          captureLog,
          '--make',
          input.make || '',
          '--model',
          input.model || '',
          '--firmware',
          input.firmware || '',
          '--notes',
          input.notes || '',
          '--datum-commit',
          await sub
            .execFail(['cat', '/etc/datum-pinned-commit'])
            .then((r) => r.stdout.toString().trim())
            .catch(() => ''),
        ])
        return stdout.toString()
      },
    )

    return {
      version: '1' as const,
      title: i18n('Compatibility Report'),
      message: i18n(
        'Copy this and share it in the Bitcoin section of paulscode.com (a free account is needed to post), or open a GitHub issue if you prefer. Nothing is sent anywhere on its own.',
      ),
      result: {
        type: 'single' as const,
        name: i18n('Report'),
        description: null,
        value: report,
        masked: false,
        copyable: true,
        qr: false,
      },
    }
  },
)
