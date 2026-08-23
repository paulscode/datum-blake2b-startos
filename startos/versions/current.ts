import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:18',
  releaseNotes: {
    en_US: "Fixes the build, which was still compiled from an older gateway commit than the notes claimed. Compatibility reports now identify the exact build they came from, and no longer credit one miner with blocks another miner found.",
    es_ES: "Fixes the build, which was still compiled from an older gateway commit than the notes claimed. Compatibility reports now identify the exact build they came from, and no longer credit one miner with blocks another miner found.",
    de_DE: "Fixes the build, which was still compiled from an older gateway commit than the notes claimed. Compatibility reports now identify the exact build they came from, and no longer credit one miner with blocks another miner found.",
    pl_PL: "Fixes the build, which was still compiled from an older gateway commit than the notes claimed. Compatibility reports now identify the exact build they came from, and no longer credit one miner with blocks another miner found.",
    fr_FR: "Fixes the build, which was still compiled from an older gateway commit than the notes claimed. Compatibility reports now identify the exact build they came from, and no longer credit one miner with blocks another miner found.",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
