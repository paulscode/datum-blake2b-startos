import { manifest as knotsManifest } from 'knots-blake2b-startos/startos/manifest'
import {
  chainDataSubdir,
  chainFromConf,
  rpcHostId as knotsRpcHostId,
  rpcPort as knotsRpcPort,
} from 'knots-blake2b-startos/startos/utils'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { captureLog, dataDir, knotsMountpoint, submittedDir } from '../utils'

const KNOTS_PKG = knotsManifest.id

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
    // Whether the node accepted a block is a different question from whether it
    // accepted shares, and only the node can answer it. Same read-only mount and
    // same cookie the daemon uses, and the only call made is getblockheader.
    const rpcAddr = await sdk.host
      .getBridgeAddress(effects, {
        packageId: KNOTS_PKG,
        hostId: knotsRpcHostId,
        internalPort: knotsRpcPort,
        ssl: false,
      })
      .const()

    // The summariser lives in the image next to the recorder, so the parsing
    // stays in one place and the action does not re-implement it in TypeScript.
    const report = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'datum' },
      sdk.Mounts.of()
        .mountVolume({
          volumeId: 'main',
          subpath: null,
          mountpoint: dataDir,
          readonly: true,
        })
        .mountDependency<typeof knotsManifest>({
          dependencyId: KNOTS_PKG,
          volumeId: 'main',
          subpath: null,
          mountpoint: knotsMountpoint,
          readonly: true,
        }),
      'report',
      async (sub) => {
        // Which chain the node is on, from its own generated config through the
        // mount we already have. bitcoind nests a non-mainnet chain's cookie in
        // a subdirectory named for that chain and keeps mainnet's at the root,
        // so this decides where to look for the cookie.
        //
        // The rule is `chainFromConf`'s, in the node package, rather than a
        // second copy here. The copy is how this broke: it listed the chains by
        // hand and fell back to regtest, so mainnet, which is spelled by the
        // *absence* of a chain line rather than by `mainnet=1`, resolved to
        // regtest and the cookie was looked for in a directory that does not
        // exist there. report.py then reported block acceptance as "not
        // checked", which is the one question this report exists to answer, and
        // it went quiet rather than wrong, which is harder to notice. The same
        // bug hit testnet4 before it hit mainnet; sharing the rule is what stops
        // it happening to the next chain.
        const knotsConf = await sub
          .execFail(['cat', `${knotsMountpoint}/bitcoin.conf`])
          .then((r) => r.stdout.toString())
          .catch(() => '')
        const chain = chainFromConf(knotsConf)
        // Empty for mainnet, so the path collapses to `<mount>/.cookie`.
        const chainSubdir = chainDataSubdir(chain)
        const cookiePath = chainSubdir
          ? `${knotsMountpoint}/${chainSubdir}/.cookie`
          : `${knotsMountpoint}/.cookie`

        const { stdout } = await sub.execFail([
          'python3',
          '/usr/local/bin/report.py',
          captureLog,
          '--submitted-dir',
          submittedDir,
          '--rpc-url',
          rpcAddr ? `http://${rpcAddr}` : '',
          '--rpc-cookie',
          cookiePath,
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
          // Identifies our own scripts. The gateway commit does not: two images
          // can carry the same one and differ in everything we wrote.
          '--tooling-id',
          await sub
            .execFail(['cat', '/etc/datum-tooling-id'])
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
