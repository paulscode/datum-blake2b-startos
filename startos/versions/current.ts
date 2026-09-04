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
  'This gateway now behaves like the official Datum Gateway package, and the ' +
  'two things that made it behave otherwise are gone. ' +
  ' ' +
  'The compatibility report is removed: the Create Compatibility Report action, ' +
  'the second Stratum port that recorded a miner’s conversation, and the ' +
  'Stratum (compatibility test) address with it. It existed to find out which ' +
  'Sia ASICs could talk to this gateway, back when nobody knew. Enough hardware ' +
  'is known to work now, and it was the largest single thing making this look ' +
  'unlike the package people install it expecting. If your miner was pointed at ' +
  'the capture port, point it at the ordinary Stratum address instead. ' +
  ' ' +
  'The chain is no longer configurable, following the same change in the node ' +
  'package. This gateway builds templates for the BLAKE2b chain on mainnet. ' +
  'Your payout address moves from the per-chain record to a single one, and it ' +
  'has to be a mainnet address: if the one you had was for the private test ' +
  'chain, it is cleared and you will be asked for a new one before the gateway ' +
  'starts. That is deliberate. DATUM’s address parser does not care which ' +
  'network an address came from, so a leftover test address would have built a ' +
  'perfectly valid mainnet payment to a key you may not hold. ' +
  ' ' +
  'PRIMARY COINBASE TAG NOW WORKS. It has been a form field that did nothing ' +
  'since it was added: the value was saved, then discarded on the way to the ' +
  'gateway by a rule meant to stop the coinbase tag being edited while it still ' +
  'had to carry the fork’s activation headline. That headline was consensus for ' +
  'exactly one block, 961640, which was mined on 30 August 2026, so the rule ' +
  'has outlived what it was protecting. If you set a tag and wondered why your ' +
  'blocks did not carry it, that is why. ' +
  ' ' +
  'The health checks are renamed to the official package’s: Web Interface, ' +
  'Stratum Interface, Number of Stratum Clients Connected, Estimated Hashrate. ' +
  'The service is also considered ready when its dashboard answers rather than ' +
  'when its Stratum port opens. That port stays shut until the gateway has its ' +
  'first block template, which on a syncing node is hours, and everything else ' +
  'waited on it, so the figures you most want during a sync were the ones you ' +
  'could not see.'

export const current = VersionInfo.of({
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
