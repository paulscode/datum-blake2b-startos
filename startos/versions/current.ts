import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `The gateway's status page now tells you where to point your miner.

There is a new first row on the Stratum Server Info card, "Point Your Miner At", showing the full address including the port. It fills the host in from whatever address you opened the dashboard with, so if you opened it by IP it is exactly the line your miner needs, and if you opened it by name it says so and tells you to use your server's IP instead — because most mining firmware cannot look up a name.

On StartOS the Interfaces tab is still the one to trust for the port, since StartOS assigns that and the gateway inside the container cannot see which number it picked. The new row is a convenience, not a second source of truth.

This release is mostly for the Umbrel version of this app, where there is no Interfaces tab and working out the address was genuinely hard. Nothing about your mining changes.`

export const current = VersionInfo.of({
  version: '1.0.0:49',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The gateway gained an optional stratum.advertised_host,
    // which this package does not set: StartOS already publishes an authoritative
    // stratum address on the Interfaces tab, including the external port it
    // actually assigned, which the gateway cannot know from inside its container.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
