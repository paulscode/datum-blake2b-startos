import { sdk } from '../sdk'
import { dependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'
import { seedFiles } from './seedFiles'
import { seedPoolPubkey } from './seedPoolPubkey'
import { watchPayoutAddress } from './watchPayoutAddress'

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  setInterfaces,
  actions,
  dependencies,
  seedFiles,
  seedPoolPubkey,
  watchPayoutAddress,
)

export const uninit = sdk.setupUninit(versionGraph)
