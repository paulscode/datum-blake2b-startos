import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:8',
  releaseNotes: {
    en_US: 'Point the user at the node Get Payout Address action, so there is a way to obtain an address without a shell.',
    es_ES: 'Point the user at the node Get Payout Address action, so there is a way to obtain an address without a shell.',
    de_DE: 'Point the user at the node Get Payout Address action, so there is a way to obtain an address without a shell.',
    pl_PL: 'Point the user at the node Get Payout Address action, so there is a way to obtain an address without a shell.',
    fr_FR: 'Point the user at the node Get Payout Address action, so there is a way to obtain an address without a shell.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
