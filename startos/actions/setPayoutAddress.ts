import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  poolAddress: Value.text({
    name: i18n('Payout Address'),
    description: i18n(
      'A regtest address from your BLAKE2b node. Every block this gateway mines pays here.',
    ),
    required: true,
    default: null,
    patterns: [
      {
        // Regtest addresses only: base58 starting m, n or 2, or bech32 bcrt1.
        // Deliberately narrow. A mainnet address here would be a silent trap,
        // since this chain's coins are worthless and the user would be pointing
        // at an address whose key they may not even hold on a real chain.
        regex: '([mn2][a-km-zA-HJ-NP-Z1-9]{25,39}|bcrt1[a-z0-9]{8,71})',
        description: i18n(
          'Must be a regtest address: starts with m, n, 2, or bcrt1',
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
    if (!/^([mn2][a-km-zA-HJ-NP-Z1-9]{25,39}|bcrt1[a-z0-9]{8,71})$/.test(addr)) {
      throw new Error(
        `Not a regtest address: ${addr}. It must start with m, n, 2 or bcrt1. ` +
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
