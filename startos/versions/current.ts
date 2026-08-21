import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:4',
  releaseNotes: {
    en_US: 'Make the Stratum port LAN-reachable so a miner can actually connect: secure null binds only to the internal bridge.',
    es_ES: 'Make the Stratum port LAN-reachable so a miner can actually connect: secure null binds only to the internal bridge.',
    de_DE: 'Make the Stratum port LAN-reachable so a miner can actually connect: secure null binds only to the internal bridge.',
    pl_PL: 'Make the Stratum port LAN-reachable so a miner can actually connect: secure null binds only to the internal bridge.',
    fr_FR: 'Make the Stratum port LAN-reachable so a miner can actually connect: secure null binds only to the internal bridge.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
