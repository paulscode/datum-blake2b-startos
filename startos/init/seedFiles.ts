import { utils } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { defaultPasswordSpec } from '../utils'

/**
 * Create store.json with its defaults on install, so the file exists for the
 * user to set a payout address in. The service will not start until they do.
 */
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return
  // A dashboard password is generated here rather than prompted for. It gates
  // the pages that show connected miners, so a blank one makes the dashboard
  // much less useful, and unlike the payout address there is no answer only the
  // user can give. The Dashboard Password action shows, changes or clears it.
  await storeJson.merge(effects, {
    adminPassword: utils.getDefaultString(defaultPasswordSpec),
  })
})
