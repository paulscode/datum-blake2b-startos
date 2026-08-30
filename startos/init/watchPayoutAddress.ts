import { setPayoutAddress } from '../actions/setPayoutAddress'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

/**
 * Surface a critical task while no payout address is set.
 *
 * 'critical' blocks the service from starting, which is what we want: without a
 * payout address the gateway has nowhere to send block rewards, and inventing an
 * address would send the user's coins to a stranger. This replaces relying on the
 * entrypoint to fail, which told the user nothing in the UI.
 *
 * Runs on every init kind, and the prompt is idempotent, so once the address is
 * set a container rebuild is a no-op.
 *
 * Before the service has ever started, `nodeChain` is empty and no address can
 * be right, so the task is raised. That is the correct answer rather than an
 * edge case: there is nothing to mine to yet either way.
 */
export const watchPayoutAddress = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().const(effects)

  // Per chain, because an address set for another chain is not an address for
  // this one. Before the split this read a single field, so a node that had
  // switched chains looked configured while pointing at the old chain's wallet,
  // and the task that exists to catch exactly that stayed quiet.
  const chain = store?.nodeChain ?? ''
  const configured = chain ? store?.poolAddresses?.[chain] : undefined

  if (!configured) {
    await sdk.action.createOwnTask(effects, setPayoutAddress, 'critical', {
      reason: i18n('Set a payout address before mining'),
    })
  }
})
