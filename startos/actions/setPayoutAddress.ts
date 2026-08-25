import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

/**
 * One spec, accepting either chain's address shapes.
 *
 * Deliberately not chain-specific, though it was for one revision. Action
 * metadata is evaluated at init and cached, so a description reading "a testnet4
 * address" would keep saying that until the next install, including after the
 * user switched the node to regtest. A wording that is true on both chains beats
 * one that is more precise and sometimes wrong.
 *
 * The pattern still has to refuse mainnet, and that is its real job: these coins
 * are worthless, so a `bc1...` or `1.../3...` address here is a key the user may
 * not hold, on a chain this will never pay.
 *
 * `bcrt1...` is absent on purpose even though regtest produces it. DATUM's
 * parser handles bech32 only for the `bc` and `tb` prefixes, so it cannot
 * convert a regtest bech32 address, and accepting one here would take a value
 * the gateway then refuses. Get Payout Address hands out base58 on regtest and
 * `tb1...` on testnet4 for exactly that reason.
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

  async () => ({
    name: i18n('Set Payout Address'),
    description: i18n(
      'Choose where block rewards go. The gateway will not mine until this is set.',
    ),
    warning: null,
    // Settable while stopped, which is when it is first needed, and while
    // running so it can be changed later.
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

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
