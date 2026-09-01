import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Hardens the difficulty request added in 1.0.0.41, from a review done while ' +
  'preparing the change for upstream. Three things came out of it. ' +
  ' ' +
  'The password was read on every `mining.authorize`, and a miner may send that ' +
  'more than once on one connection. Since a changed difficulty sends fresh work, ' +
  'a miner alternating between two values could make the gateway build and send a ' +
  'full job per request, where it used to reply with a small acknowledgement. It ' +
  'is now read once per connection, which is also what asking for a starting ' +
  'difficulty means. This is the one worth updating for if you point rented ' +
  'hashrate at this gateway, because the miners doing so are not yours. ' +
  ' ' +
  'A request is now bounded. The number was parsed in a way that saturates rather ' +
  'than failing, so a long enough run of digits arrived as the largest 64-bit ' +
  'value and went into the difficulty and share-target maths unchecked. Requests ' +
  'beyond anything usable are ignored rather than clamped: the request is a floor, ' +
  'so a value too high for the miner cannot be walked back down, and ignoring it ' +
  'leaves ordinary difficulty adjustment running. ' +
  ' ' +
  'Setting `stratum.vardiff_client_min` to 0 reached an undefined shift before the ' +
  'check that rejects it. It is now rejected first, with a clear message. ' +
  ' ' +
  'No miner that was working is affected, and nothing about how a request is ' +
  'honoured has changed.'

export const current = VersionInfo.of({
  version: '1.0.0:42',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version only changes how a difficulty request is
    // parsed and how often it is read; no setting, stored value or on-disk layout
    // changes, and a miner that asks for nothing behaves exactly as before.
    //
    // The payout-address re-file that :38 needed lives in `v1_0_0_38.ts`, with the
    // version that introduced it, rather than being carried forward here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
