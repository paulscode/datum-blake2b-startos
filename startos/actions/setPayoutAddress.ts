import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { EXPECTED, isValidAddress } from '../payoutAddress'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

/**
 * The gateway serves one chain, so the form can say what a good address looks
 * like rather than hedging.
 *
 * It used to hedge, and had to. While this package could be pointed at either a
 * private chain or mainnet, the valid prefixes differed, action metadata is
 * evaluated at init and cached, and a description naming one chain's prefixes
 * would keep saying that after the node was switched to the other.
 *
 * The pattern is on the field now for the same reason: it can be, because the
 * rules no longer depend on anything the form cannot see. The handler still
 * checks, because the pattern was observed NOT to be enforced on the
 * `start-cli package action run` path.
 */
const inputSpec = InputSpec.of({
  poolAddress: Value.text({
    name: i18n('Payout Address'),
    description: i18n(
      'An address from your BLAKE2b node, starting with bc1. Every block this gateway mines pays here.',
    ),
    required: true,
    default: null,
    patterns: [
      {
        regex: '^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$',
        description: i18n(
          'A Bitcoin address starting with bc1, 1 or 3, from a wallet whose keys you hold. A block found solo pays its whole subsidy here.',
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
    // Validated here as well as in `patterns`. The pattern gives fast feedback
    // in the form, but it was observed NOT to be enforced on the
    // `start-cli package action run` path: an address that did not match passed
    // straight through and became the payout address. A handler throw is
    // enforced on every path, and this is the one setting where accepting a
    // wrong value silently sends someone's block rewards to an address they do
    // not control.
    const addr = input.poolAddress.trim()

    // Test-network prefixes get their own message, because the reason they fail
    // is not obvious: they are perfectly good addresses, on a chain this gateway
    // does not serve, and DATUM would happily pay to them.
    if (/^(bcrt1|tb1|[mn2])/.test(addr)) {
      throw new Error(
        `${addr} is a test-network address, and this gateway mines the BLAKE2b ` +
          `chain on mainnet. Paying to it would build a valid mainnet output for ` +
          `a key from a test wallet, which nothing downstream would object to. ` +
          `Use ${EXPECTED}, from a wallet whose keys you hold.`,
      )
    }

    if (!isValidAddress(addr)) {
      throw new Error(
        `${addr} is not an address this gateway can pay to. Use ${EXPECTED}. ` +
          `DATUM's address parser handles bech32 only for the bc and tb ` +
          `prefixes, falling back to base58, so anything else is refused at ` +
          `startup rather than at the block it would have paid.`,
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
