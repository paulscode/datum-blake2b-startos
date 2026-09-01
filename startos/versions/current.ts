import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Adds a Stratum Interface health check, so other apps can require this gateway ' +
  'the same way they require the official one. HashGG asks for a check by that ' +
  'name, and a name that does not exist reads to StartOS exactly like one that is ' +
  'failing, so without it nothing written against the official gateway could ' +
  'depend on this one. ' +
  ' ' +
  'While your node is still syncing the check reports that it is waiting rather ' +
  'than reporting a fault. The gateway does not open its stratum port until it has ' +
  'its first block template, and it cannot get one from a node that has not caught ' +
  'up, so on a fresh node that port stays shut for hours. Nothing is wrong during ' +
  'that time, and the check now says so instead of showing red.'

export const current = VersionInfo.of({
  version: '1.0.0:40',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version only adds a health check, which is computed
    // live and stored nowhere; no setting, stored value or on-disk layout changes.
    //
    // The payout-address re-file that :38 needed lives in `v1_0_0_38.ts`, with the
    // version that introduced it, rather than being carried forward here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
