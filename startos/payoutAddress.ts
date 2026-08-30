/**
 * What counts as a payout address, per chain.
 *
 * One module because three callers need to agree and previously did not: the
 * action's input pattern, the action's own check, and now the migration. When the
 * first two disagreed for one revision, the form accepted an address the handler
 * then rejected.
 *
 * The rules are DATUM's, not Bitcoin's, and they are narrower. `datum_utils.c`
 * decodes bech32 only for the `bc` and `tb` prefixes, so a regtest `bcrt1`
 * address cannot be converted and the gateway refuses to start. Regtest
 * therefore has to use a legacy address, which is why Get Payout Address asks
 * the node for a legacy one there.
 */

/** Chains this gateway can be pointed at, as bitcoind names them. */
export type PayoutChain = 'main' | 'regtest' | 'testnet4'

type Rule = {
  /** Accepts an address usable for payouts on this chain. */
  pattern: RegExp
  /** Shown when the address does not match, naming what would work instead. */
  expected: string
}

const RULES: Record<PayoutChain, Rule> = {
  // Mainnet: bech32 and bech32m under `bc`, plus legacy P2PKH and P2SH. This is
  // real money, so nothing test-shaped is accepted here.
  main: {
    pattern: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
    expected: 'an address starting with bc1, 1 or 3',
  },
  // The public test network: `tb` bech32, or the base58 prefixes test chains
  // share.
  testnet4: {
    pattern: /^(tb1[a-z0-9]{25,87}|[mn2][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
    expected: 'an address starting with tb1, m, n or 2',
  },
  // Regtest: legacy only, because DATUM cannot decode bcrt1 at all. Accepting one
  // here would move the failure to a gateway that will not start.
  regtest: {
    pattern: /^[mn2][a-km-zA-HJ-NP-Z1-9]{25,39}$/,
    expected: 'an address starting with m, n or 2',
  },
}

export function isValidFor(chain: PayoutChain, address: string): boolean {
  return RULES[chain].pattern.test(address.trim())
}

export function expectedFor(chain: PayoutChain): string {
  return RULES[chain].expected
}

export function isPayoutChain(chain: string): chain is PayoutChain {
  return chain in RULES
}

/**
 * The chain an address belongs to, judged by its own prefix.
 *
 * Only for the migration, which has an address from before addresses were keyed
 * by chain and no record of which chain it was set on. Everywhere else the chain
 * is known and should be used instead of guessed.
 *
 * `null` when the prefix cannot decide, which is the honest answer for the base58
 * test prefixes: regtest and testnet4 share `m`, `n` and `2`, and that shared
 * prefix is exactly why a stale address was accepted on the wrong chain rather
 * than rejected. Leaving it unassigned means the operator is asked, which is the
 * only safe answer when the alternative is paying to a wallet they may not have.
 */
export function chainFromAddress(address: string): PayoutChain | null {
  const addr = address.trim()
  if (!addr) return null
  if (RULES.main.pattern.test(addr)) return 'main'
  if (/^tb1[a-z0-9]{25,87}$/.test(addr)) return 'testnet4'
  return null
}
