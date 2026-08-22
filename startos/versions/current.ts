import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:16',
  releaseNotes: {
    en_US: "Use the upstream fix for the header-v2 h1 version bit, which now lives in the gateway's own commitment code.",
    es_ES: "Use the upstream fix for the header-v2 h1 version bit, which now lives in the gateway's own commitment code.",
    de_DE: "Use the upstream fix for the header-v2 h1 version bit, which now lives in the gateway's own commitment code.",
    pl_PL: "Use the upstream fix for the header-v2 h1 version bit, which now lives in the gateway's own commitment code.",
    fr_FR: "Use the upstream fix for the header-v2 h1 version bit, which now lives in the gateway's own commitment code.",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
