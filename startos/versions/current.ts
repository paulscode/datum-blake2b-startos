import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:9',
  releaseNotes: {
    en_US: 'Reject bech32 regtest addresses: DATUM cannot pay to them, and accepting one moved the failure somewhere far less obvious.',
    es_ES: 'Reject bech32 regtest addresses: DATUM cannot pay to them, and accepting one moved the failure somewhere far less obvious.',
    de_DE: 'Reject bech32 regtest addresses: DATUM cannot pay to them, and accepting one moved the failure somewhere far less obvious.',
    pl_PL: 'Reject bech32 regtest addresses: DATUM cannot pay to them, and accepting one moved the failure somewhere far less obvious.',
    fr_FR: 'Reject bech32 regtest addresses: DATUM cannot pay to them, and accepting one moved the failure somewhere far less obvious.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
