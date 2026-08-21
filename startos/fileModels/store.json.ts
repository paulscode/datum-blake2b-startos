import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  // Where block rewards go. There is no safe default: an address we invented
  // would silently send the user's coins somewhere they do not control, so this
  // starts empty and the service refuses to run until it is set.
  //
  // TODO: a `sdk.Action` to set this, surfaced as a critical task on install, so
  // the user is prompted rather than having to find it.
  poolAddress: z.string().catch(''),

  // Starting share difficulty. Vardiff adapts from here; 64 lets even a slow
  // hasher produce shares immediately on connect.
  vardiffMin: z.number().int().positive().catch(64),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
