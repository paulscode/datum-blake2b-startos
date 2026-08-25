import { utils } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { defaultPasswordSpec } from '../utils'

/**
 * Create store.json with its defaults on install, so the file exists for the
 * user to set a payout address in. The service will not start until they do.
 */
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  if (kind === 'install') {
    await storeJson.merge(effects, {})
  }

  // A dashboard password is generated rather than prompted for. It gates the
  // pages that show connected miners, so a blank one makes the dashboard much
  // less useful, and unlike the payout address there is no answer only the user
  // can give. The Dashboard Password action shows, changes or clears it.
  //
  // On every init, not just install, so an existing install picks one up on
  // update rather than being left with the pages off until someone finds the
  // action. Guarded on "unset" rather than on the init kind, which also means a
  // user who deliberately cleared the password to turn the pages off keeps them
  // off: an empty string is a decision, and `?? undefined` does not overwrite
  // it. Only a genuinely absent field is filled.
  const current = await storeJson.read((s) => s.adminPassword).once()
  if (current === undefined || current === null) {
    await storeJson.merge(effects, {
      adminPassword: utils.getDefaultString(defaultPasswordSpec),
    })
  }
})
