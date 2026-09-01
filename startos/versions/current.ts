import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Takes ten upstream changes to the gateway, four of which decide whether a ' +
  'block you mine is one your node will accept. ' +
  ' ' +
  'A BLAKE2b header carries its timestamp in two pieces that the node adds back ' +
  'together. In three separate cases the gateway could get that wrong and have ' +
  'no way of noticing, because everything looks right on this side and only the ' +
  'node disagrees. When the offset was larger than the timestamp the gateway ' +
  'gave up and used an unadjusted time while still flagging the header as ' +
  'adjusted, so the node would read a time that was never meant; consensus ' +
  'wraps that subtraction rather than treating it as an error, and the gateway ' +
  'now does the same. A share\'s time was checked against a value that is not ' +
  'the one the node reads, so with hasher time rolling on, a share could carry ' +
  'a time outside the window the node allows and still be sent up as a block. ' +
  ' ' +
  'Also fixed: a recycled job slot could keep stale state and skip re-sending ' +
  'the coinbase and merkle branches for the next share, and the difficulty ' +
  'reported for each miner was a placeholder rather than the real value. ' +
  ' ' +
  'Nothing to configure, and no setting changes. The build checks the gateway ' +
  'against the test vectors published with Knots rather than against values it ' +
  'computed itself, which is the comparison that catches this class of fault.'

export const current = VersionInfo.of({
  version: '1.0.0:39',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version only moves the pinned gateway commit; no
    // setting, stored value or on-disk layout changes, and no config option was
    // added, renamed or removed upstream between the two commits.
    //
    // The payout-address re-file that :38 needed lives in `v1_0_0_38.ts`, with the
    // version that introduced it, rather than being carried forward here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
