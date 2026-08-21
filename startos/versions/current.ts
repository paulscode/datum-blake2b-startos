import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:3',
  releaseNotes: {
    en_US: 'Read the node headline from its config so the activation block is not rejected bad-headline, and seed store.json on install.',
    es_ES: 'Read the node headline from its config so the activation block is not rejected bad-headline, and seed store.json on install.',
    de_DE: 'Read the node headline from its config so the activation block is not rejected bad-headline, and seed store.json on install.',
    pl_PL: 'Read the node headline from its config so the activation block is not rejected bad-headline, and seed store.json on install.',
    fr_FR: 'Read the node headline from its config so the activation block is not rejected bad-headline, and seed store.json on install.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
