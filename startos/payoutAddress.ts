/**
 * What counts as a payout address.
 *
 * One module because three callers need to agree and previously did not: the
 * action's input pattern, the action's own check, and the migration. When the
 * first two disagreed for one revision, the form accepted an address the handler
 * then rejected.
 *
 * The rules are DATUM's, not Bitcoin's, and they are narrower. `datum_utils.c`
 * decodes bech32 only for the `bc` and `tb` prefixes, falling back to libblkmaker
 * for base58. On mainnet, which is the only chain this gateway serves, `bc1`
 * addresses go straight through.
 *
 * This used to be a table keyed by chain, with a regtest row accepting base58
 * `m`, `n` and `2` because DATUM cannot decode `bcrt1` at all. The node package
 * follows mainnet only as of its 1.0.0:30, so the table has one row and the
 * chain argument is gone.
 */

/**
 * bech32 and bech32m under `bc`, plus legacy P2PKH and P2SH.
 *
 * Nothing test-shaped is accepted. That is a real check rather than tidiness:
 * DATUM's parser is explicitly agnostic about which network an address came
 * from, so a leftover `tb1` or `m...` address here produces a perfectly valid
 * mainnet output paying a key from a wallet the operator may not hold, and
 * nothing downstream would complain.
 */
const PATTERN = /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/

/** Shown when the address does not match, naming what would work instead. */
export const EXPECTED = 'an address starting with bc1, 1 or 3'

export function isValidAddress(address: string): boolean {
  return PATTERN.test(address.trim())
}
