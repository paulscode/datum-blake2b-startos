import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  "The gateway is now built on CONVOY's current v0.5.0 beta and reports " +
  'that version, so Lazarus no longer lists it as out of date. Your payout ' +
  'settings, the full pool payout list and BLAKE2b support are unchanged. ' +
  "On the gateway's Config page, changing the Extranonce2 size is now " +
  'marked as needing a restart. Uses version 3.1.0 of the packaging SDK. ' +
  'From 1.0.0:56: the gateway no longer misses a payout split the pool sends ' +
  'before it is ready, and no longer changes the empty job sent on a new ' +
  'block while miners are working on it.'

export const current = VersionInfo.of({
  version: '1.0.0:57',
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
