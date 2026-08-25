import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

/**
 * The address shapes each chain accepts.
 *
 * Still deliberately narrow, for the reason it always was: a mainnet address
 * here is a silent trap. These coins are worthless, so a user pasting a mainnet
 * address is pointing at a key they may not hold, on a chain this will never
 * pay. Rejecting `bc1...` and `1.../3...` is the point.
 *
 * The difference between the two chains is bech32. DATUM's parser handles it for
 * the `bc` and `tb` prefixes only, so regtest's `bcrt1...` is unusable and
 * testnet4's `tb1...` is fine. Base58 works on both and shares its prefixes
 * between them, which is why regtest's rule also matches a testnet address.
 */
const addressRules = {
  regtest: {
    description: i18n(
      'Choose where block rewards go. Paste an address from your BLAKE2b node, which is on its own private chain. The gateway will not mine until this is set.',
    ),
  },
  testnet4: {
    description: i18n(
      'Choose where block rewards go. Paste an address from your BLAKE2b node, which is on the public BLAKE2b test network. The gateway will not mine until this is set.',
    ),
  },
} as const

/**
 * One spec, accepting either chain's shapes.
 *
 * The input spec is a fixed value in the action's type, so it cannot vary with
 * the chain. What can vary is the action's own description, which is built by an
 * async callback below and says which chain the node is actually on. That is the
 * half a user needs: the pattern only has to stop a mainnet address, and it does.
 *
 * `bcrt1...` is absent on purpose even though regtest produces it. DATUM cannot
 * convert it, so accepting it here would take a value the gateway then refuses.
 */
const inputSpec = InputSpec.of({
  poolAddress: Value.text({
    name: i18n('Payout Address'),
    description: i18n(
      'An address from your BLAKE2b node. Every block this gateway mines pays here.',
    ),
    required: true,
    default: null,
    patterns: [
      {
        regex: '^(tb1[a-z0-9]{25,87}|[mn2][a-km-zA-HJ-NP-Z1-9]{25,39})$',
        description: i18n(
          'Must be a test-chain address: tb1 on the public test network, or m, n or 2 on either chain',
        ),
      },
    ],
  }),
})

export const setPayoutAddress = sdk.Action.withInput(
  'set-payout-address',

  async ({ effects }) => {
    // Which chain the node was last seen on, recorded by main.ts. Actions have
    // no mount of the node's volume, so this is the only way to tell the user
    // what kind of address to paste. Absent before the first start.
    const chain = await storeJson.read((s) => s.detectedChain).once()
    return {
    name: i18n('Set Payout Address'),
    description:
      chain === 'testnet4'
        ? addressRules.testnet4.description
        : chain === 'regtest'
          ? addressRules.regtest.description
          : i18n(
              'Choose where block rewards go. The gateway will not mine until this is set.',
            ),
    warning: null,
    // Settable while stopped, which is when it is first needed, and while
    // running so it can be changed later.
    allowedStatuses: 'any' as const,
    group: null,
    visibility: 'enabled' as const,
    }
  },

  inputSpec,

  // Prefill with whatever is set, so changing it later is an edit rather than a
  // retype from nothing.
  async ({ effects }) => {
    const current = await storeJson.read((s) => s.poolAddress).once()
    return current ? { poolAddress: current } : {}
  },

  async ({ effects, input }) => {
    // Validate here as well as in `patterns`. The pattern gives fast feedback in
    // the form, but it was observed NOT to be enforced on the
    // `start-cli package action run` path: a mainnet address passed straight
    // through and became the payout address. A handler throw is enforced on
    // every path, and this is the one setting where accepting a wrong value
    // silently sends someone's block rewards to an address they do not control.
    const addr = input.poolAddress.trim()
    // bcrt1 is excluded deliberately, not by oversight. DATUM's address parser
    // only understands bech32 with the `bc` and `tb` prefixes
    // (datum_utils.c:415-425), so a regtest bech32 address fails to convert and
    // the gateway refuses to start. Accepting one here would move the failure
    // somewhere far less obvious.
    if (/^bcrt1/.test(addr)) {
      throw new Error(
        `${addr} is a bech32 regtest address, which this gateway cannot pay to: ` +
          `its address parser only understands the bc and tb prefixes. Use a ` +
          `legacy address starting with m, n or 2. The node's Get Payout Address ` +
          `action gives you one.`,
      )
    }
    if (!/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(addr)) {
      throw new Error(
        `Not a usable regtest address: ${addr}. It must start with m, n or 2. ` +
          `A mainnet address here would send block rewards somewhere you may not control.`,
      )
    }

    await storeJson.merge(effects, { poolAddress: addr })

    return {
      version: '1' as const,
      title: i18n('Payout Address Set'),
      message: i18n(
        'Restart the gateway for this to take effect. Blocks it mines will pay to this address.',
      ),
      result: {
        type: 'single' as const,
        name: i18n('Payout Address'),
        description: null,
        value: addr,
        masked: false,
        copyable: true,
        qr: true,
      },
    }
  },
)
