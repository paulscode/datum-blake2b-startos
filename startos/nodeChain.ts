import { manifest as knotsManifest } from 'knots-blake2b-startos/startos/manifest'
import { type Chain, chainFromConf } from 'knots-blake2b-startos/startos/utils'
import { sdk } from './sdk'
import { knotsMountpoint } from './utils'
import { T } from '@start9labs/start-sdk'

/**
 * Which chain the node is on, read from the node rather than from our own store.
 *
 * <p>This exists because the store was the wrong place to ask. `main.ts` records the chain on every
 * start, and Set Payout Address read that record, which made the one action a user needs *before*
 * the first start depend on a start having happened. On a fresh install that is a deadlock: the
 * critical task refuses to let the service start until an address is set, and the address cannot be
 * checked until the service has started.
 *
 * It was also simply not being written. `main.ts` read the store with `.const(effects)` and then
 * merged into the same file, which the SDK rejects as a write after const, so the merge threw and
 * took the start down with it. Reading the node directly removes both failures at once: there is no
 * stored value to be stale, absent, or unwritable.
 *
 * The node's generated `bitcoin.conf` is the same source `main.ts` uses, and `chainFromConf` is the
 * node package's own rule, so the two cannot disagree about what a config means. Mainnet is spelled
 * by the *absence* of a chain line rather than by `mainnet=1`, which is exactly the trap a
 * hand-rolled reader falls into.
 */
export async function readNodeChain(effects: T.Effects): Promise<Chain | null> {
  const conf = await sdk.SubContainer.withTemp(
    effects,
    { imageId: 'datum' },
    sdk.Mounts.of().mountDependency<typeof knotsManifest>({
      dependencyId: knotsManifest.id,
      volumeId: 'main',
      subpath: null,
      mountpoint: knotsMountpoint,
      readonly: true,
    }),
    'read-chain',
    async (sub) =>
      sub
        .execFail(['cat', `${knotsMountpoint}/bitcoin.conf`])
        .then((r) => r.stdout.toString())
        .catch(() => ''),
  ).catch(() => '')

  // An empty config is not a chain. It means the node has not written one yet, which is a
  // different answer from any particular chain and must not be reported as one: `chainFromConf`
  // treats the absence of a chain line as mainnet, so handing it nothing would confidently answer
  // mainnet about a node that has never run.
  //
  // Nothing is substituted here. A value this service recorded on some earlier start would be a
  // guess about a node we currently cannot read, and the case where it is most likely to be wrong,
  // the operator having switched the node's chain, is exactly the case where acting on it pays
  // block rewards to a wallet they do not have. Not knowing is reported as not knowing.
  if (!conf.trim()) {
    return null
  }

  return chainFromConf(conf)
}
