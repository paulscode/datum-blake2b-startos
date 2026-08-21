import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:14',
  releaseNotes: {
    en_US: 'Report TCP connections and stratum sessions separately: a miner that opens idle probe connections was reading as one that thrashes.',
    es_ES: 'Report TCP connections and stratum sessions separately: a miner that opens idle probe connections was reading as one that thrashes.',
    de_DE: 'Report TCP connections and stratum sessions separately: a miner that opens idle probe connections was reading as one that thrashes.',
    pl_PL: 'Report TCP connections and stratum sessions separately: a miner that opens idle probe connections was reading as one that thrashes.',
    fr_FR: 'Report TCP connections and stratum sessions separately: a miner that opens idle probe connections was reading as one that thrashes.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
