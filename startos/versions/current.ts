import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:17',
  releaseNotes: {
    en_US: 'Compatibility reports now say whether your node accepted the blocks your miner found, not only whether the gateway accepted its shares.',
    es_ES: 'Compatibility reports now say whether your node accepted the blocks your miner found, not only whether the gateway accepted its shares.',
    de_DE: 'Compatibility reports now say whether your node accepted the blocks your miner found, not only whether the gateway accepted its shares.',
    pl_PL: 'Compatibility reports now say whether your node accepted the blocks your miner found, not only whether the gateway accepted its shares.',
    fr_FR: 'Compatibility reports now say whether your node accepted the blocks your miner found, not only whether the gateway accepted its shares.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
