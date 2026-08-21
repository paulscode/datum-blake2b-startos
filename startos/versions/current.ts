import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:13',
  releaseNotes: {
    en_US: 'Add a compatibility-test Stratum port that records a miner conversation, and a Create Compatibility Report action that summarises it for sharing upstream.',
    es_ES: 'Add a compatibility-test Stratum port that records a miner conversation, and a Create Compatibility Report action that summarises it for sharing upstream.',
    de_DE: 'Add a compatibility-test Stratum port that records a miner conversation, and a Create Compatibility Report action that summarises it for sharing upstream.',
    pl_PL: 'Add a compatibility-test Stratum port that records a miner conversation, and a Create Compatibility Report action that summarises it for sharing upstream.',
    fr_FR: 'Add a compatibility-test Stratum port that records a miner conversation, and a Create Compatibility Report action that summarises it for sharing upstream.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
