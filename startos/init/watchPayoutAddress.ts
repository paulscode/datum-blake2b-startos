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
 * This used to look the address up by the chain the node was last seen on, and
 * raise the task when that chain was unknown, which on a fresh install is always.
 * There is one chain now, so the question is simply whether an address is set.
 */
export const watchPayoutAddress = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().const(effects)

  if (!store?.poolAddress) {
    await sdk.action.createOwnTask(effects, setPayoutAddress, 'critical', {
      reason: i18n('Set a payout address before mining'),
    })
  }
})
