import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'

/**
 * Create store.json with its defaults on install, so the file exists for the
 * user to set a payout address in. The service will not start until they do.
 */
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return
  await storeJson.merge(effects, {})
})
