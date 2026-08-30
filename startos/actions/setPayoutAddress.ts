import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { expectedFor, isPayoutChain, isValidFor } from '../payoutAddress'
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
    // No pattern here. The rules depend on which chain the node is on, and a
    // pattern baked into the form cannot know it. The handler checks against
    // that chain and names the prefixes that would work, which is a better
    // error than a regex the form cannot explain.
    patterns: [],
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
    const nodeChain = (await storeJson.read((s) => s.nodeChain).once()) ?? ''
    const byChain = (await storeJson.read((s) => s.poolAddresses).once()) ?? {}
    const current = byChain[nodeChain]
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

    // Which chain this address is for. main.ts records it on every start, so it is
    // the chain the node is actually on rather than one guessed from the address,
    // which for the shared base58 test prefixes cannot be guessed at all.
    const nodeChain = (await storeJson.read((s) => s.nodeChain).once()) ?? ''
    if (!isPayoutChain(nodeChain)) {
      throw new Error(
        `Cannot tell which chain this node is on, so an address cannot be checked ` +
          `against it. Start the service once and try again: it records the chain ` +
          `when it starts. Setting an address for the wrong chain is how block ` +
          `rewards end up in a wallet you do not have.`,
      )
    }

    // bcrt1 gets its own message, because the reason it fails is not obvious.
    if (/^bcrt1/.test(addr)) {
      throw new Error(
        `${addr} is a bech32 regtest address, which this gateway cannot pay to: ` +
          `its address parser only understands the bc and tb prefixes. Use a ` +
          `legacy address starting with m, n or 2. The node's Get Payout Address ` +
          `action gives you one.`,
      )
    }

    if (!isValidFor(nodeChain, addr)) {
      throw new Error(
        `${addr} is not usable on ${nodeChain}. Use ${expectedFor(nodeChain)}. An ` +
          `address from another chain belongs to a wallet this node never opens, ` +
          `and DATUM will not stop you: its parser is explicitly agnostic to which ` +
          `network an address came from, so it would build a valid payment to a ` +
          `key you may not hold.`,
      )
    }

    // Keyed by chain. The single field this replaced survived a chain switch and
    // went on paying to the previous chain's wallet.
    const existing = (await storeJson.read((s) => s.poolAddresses).once()) ?? {}
    await storeJson.merge(effects, {
      poolAddresses: { ...existing, [nodeChain]: addr },
    })

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
