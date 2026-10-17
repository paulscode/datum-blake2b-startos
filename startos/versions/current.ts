import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Rebuilt on version 3 of the StartOS packaging SDK, which needs StartOS ' +
  '0.4.0.2. Nothing you have set changes. ' +
  'When the pool sent its payout split before the gateway was ready for it, ' +
  'the gateway used to miss it and wait out a 5-second timeout before asking ' +
  'again; it now catches the early reply.'

export const current = VersionInfo.of({
  version: '1.0.0:56',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate: the SDK changed, and nothing on disk does.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
