import { storeJson } from '../../fileModels/store.json'
import { i18n } from '../../i18n'
import { sdk } from '../../sdk'

/**
 * The config actions mirror the official Datum Gateway package's, group for
 * group, so a user who knows that one finds the same settings under the same
 * names here. Adapted from `Start9Labs/datum-gateway-startos` (MIT).
 *
 * Where they differ, they differ for a reason recorded on the action itself.
 * The settings this package controls are absent throughout: the listen ports,
 * the RPC credentials, `save_submitblocks_dir`, `pow_algorithm` and
 * `modify_conf`. A user who could edit those could break the package's wiring
 * without any way to tell that is what happened.
 *
 * Everything here is optional. Unset means the key is not written at all, so
 * DATUM's own default applies rather than a value we guessed.
 */
export const CONFIG_GROUP = 'Config'

type Group = 'bitcoind' | 'stratum' | 'mining' | 'api' | 'logger' | 'datum'

/** Read one group out of the store, for an action's fill callback. */
export async function readGroup<G extends Group>(effects: any, group: G) {
  const c = await storeJson.read((s) => s.config).const(effects)
  return (c?.[group] ?? {}) as NonNullable<typeof c>[G]
}

/** Merge one group back, leaving the other five untouched. */
export async function writeGroup(effects: any, group: Group, input: any) {
  // Strip nulls: the SDK gives an unset optional field as null, and writing
  // null would serialise a JSON null into DATUM's config rather than omitting
  // the key, which is not the same thing to the parser.
  const cleaned = Object.fromEntries(
    Object.entries(input ?? {}).filter(([, v]) => v !== null && v !== ''),
  )
  await storeJson.merge(effects, { config: { [group]: cleaned } } as any)
}

export { i18n, sdk }
