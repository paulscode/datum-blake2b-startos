import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { readFile, writeFile } from 'fs/promises'
import { isValidAddress } from '../payoutAddress'

/**
 * The store as a migration sees it, which is the host path rather than the
 * `sdk.volumes.main` handle the file model uses. The keys this migration reads
 * are no longer in the schema, so the model cannot express them.
 */
const storePath = '/media/startos/volumes/main/store.json'

const notes =
  'Collapses the payout address back to a single value, and refuses to carry a '  +
  'test-chain address onto mainnet. '  +
  ' ' +
  'This service briefly kept one payout address per chain, from when it could '  +
  'be pointed at a private test chain as well as at mainnet. It serves one '  +
  'chain now, so the record collapses to the single address you most recently '  +
  'set. '  +
  ' ' +
  'An address left over from before that split is only carried forward if it '  +
  'stands up as a mainnet address on its own. A test-network address would not '  +
  'be rejected by anything downstream: DATUM does not care which network an '  +
  'address came from, so it would build a valid mainnet output paying a key '  +
  'from a wallet you do not have, and nothing would report it. Where that is '  +
  'the risk the address is cleared and you are asked for a new one before the '  +
  'gateway starts.'

export const v1_0_0_43 = VersionInfo.of({
  version: '1.0.0:43',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    /**
     * Collapse the per-chain payout record back to a single address, and refuse
     * to carry a test-chain address onto mainnet.
     *
     * Three shapes have existed and all three are still out there:
     *
     *   - before 1.0.0:36, a single `poolAddress`, with no record of its chain;
     *   - 1.0.0:36, `poolAddresses` keyed by chain, with mainnet spelled `main`;
     *   - 1.0.0:38, the same map with mainnet spelled `mainnet`.
     *
     * The newest wins, because it is the one a user most recently set. The
     * pre-:36 field is taken only if it is a valid mainnet address: that field
     * recorded no chain, and on an install that was running the private chain it
     * holds a regtest address. Carrying that forward is the one outcome worth
     * going out of the way to prevent. DATUM's parser is explicitly agnostic
     * about which network an address came from, so it would not object; it would
     * build a valid mainnet output paying a key from a wallet the operator does
     * not have, and nothing would report it.
     *
     * Cleared rather than kept, so the critical task in init/watchPayoutAddress
     * asks for a new one before the gateway starts. Being asked once is cheap
     * next to that.
     */
    up: async ({ effects }) => {
      const raw = await readFile(storePath, 'utf8').catch(() => null)
      if (raw === null) return

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        // An unreadable store is not this migration's to repair; the file model
        // rebuilds it from defaults on the next read.
        return
      }
      if (parsed === null || typeof parsed !== 'object') return

      const store = parsed as Record<string, unknown>
      const byChain = (store['poolAddresses'] ?? {}) as Record<string, unknown>
      const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

      const previous = pick(store['poolAddress'])
      const chosen =
        pick(byChain['mainnet']) ||
        pick(byChain['main']) ||
        // Only if it stands up as a mainnet address on its own. See above.
        (isValidAddress(previous) ? previous : '')

      store['poolAddress'] = chosen
      delete store['poolAddresses']
      delete store['nodeChain']

      await writeFile(storePath, JSON.stringify(store, null, 2) + '\n', 'utf8')
    },
    down: IMPOSSIBLE,
  },
})
