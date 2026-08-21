import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:7',
  releaseNotes: {
    en_US: 'Validate the payout address in the action handler: the input pattern was not enforced on the CLI path and a mainnet address was accepted.',
    es_ES: 'Validate the payout address in the action handler: the input pattern was not enforced on the CLI path and a mainnet address was accepted.',
    de_DE: 'Validate the payout address in the action handler: the input pattern was not enforced on the CLI path and a mainnet address was accepted.',
    pl_PL: 'Validate the payout address in the action handler: the input pattern was not enforced on the CLI path and a mainnet address was accepted.',
    fr_FR: 'Validate the payout address in the action handler: the input pattern was not enforced on the CLI path and a mainnet address was accepted.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
