import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Lets a miner ask for the share difficulty it should run at, by putting it in ' +
  'the Stratum password. Send `d=8192` and the gateway starts that miner there ' +
  'and holds it as a floor; send `fd=8192` and it holds exactly there with no ' +
  'vardiff at all. Anything the gateway does not recognise is ignored, so the `x` ' +
  'that almost every miner sends means what it always did and no existing miner ' +
  'changes difficulty on upgrade. ' +
  ' ' +
  'This exists because the password is often the only field an operator can set. ' +
  'Rental marketplaces and some firmware let you configure a pool host, port, ' +
  'worker name and password and nothing else, with no way to make the miner ' +
  'negotiate difficulty through the protocol. A small miner left on a difficulty ' +
  'meant for a large one produces very few shares, which is what makes a rented ' +
  'rig look like it is underdelivering when it is not. ' +
  ' ' +
  'The request sets a floor and not merely a starting point. Difficulty is adjusted ' +
  'downward by halving with a clamp, so setting only the starting value is undone ' +
  'at the first adjustment, which would leave the feature doing nothing for exactly ' +
  'the small miners it is for. ' +
  ' ' +
  'A request cannot lower difficulty past the limits that are not preferences: the ' +
  'new `stratum.vardiff_client_min` setting, below which no miner may ask, the ' +
  'compatibility floor of a miner recognised as needing one, and the minimum the ' +
  'pool itself declares when mining pooled. `vardiff_client_min` is in turn bounded ' +
  'by `vardiff_min`, so ' +
  'it can never be stricter than the difficulty this gateway already hands out ' +
  'unasked. Values round to a power of two, matching how vardiff steps.'

export const current = VersionInfo.of({
  version: '1.0.0:41',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version only adds a way for a miner to ask for its
    // own difficulty; it changes no setting, no stored value and no on-disk layout,
    // and a miner that asks for nothing behaves exactly as before.
    //
    // The payout-address re-file that :38 needed lives in `v1_0_0_38.ts`, with the
    // version that introduced it, rather than being carried forward here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
