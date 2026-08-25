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

/**
 * Replace one group, leaving the other five untouched.
 *
 * Nulls are dropped, because the SDK reports an unset optional field as null and
 * writing null would put a JSON null into DATUM's config rather than omitting
 * the key, which is not the same thing to its parser.
 *
 * The group is **replaced rather than merged**, and that distinction is the
 * whole point. A form always submits every field, so a null means the user
 * cleared it. Merging a cleaned object leaves the old value in place: setting
 * `max_threads` to 4 and then clearing it would leave 4 stored forever, with the
 * form showing empty and the config saying 4. Replacing makes clearing work.
 * Found by clearing a value on the box and watching it come back.
 */
export async function writeGroup(effects: any, group: Group, input: any) {
  const cleaned = Object.fromEntries(
    Object.entries(input ?? {}).filter(([, v]) => v !== null && v !== ''),
  )
  const store = await storeJson.read().once()
  await storeJson.write(effects, {
    ...(store ?? {}),
    config: { ...(store?.config ?? {}), [group]: cleaned },
  } as any)
}

export { i18n, sdk }
