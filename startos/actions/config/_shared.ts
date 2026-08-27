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
/**
 * DATUM's own defaults for the two settings that constrain each other. Needed
 * because either can be left unset, and the constraint is checked against what
 * DATUM will actually run with rather than against what the form holds.
 *
 * `work_update_seconds` is always written by `entrypoint.sh`, which supplies 5
 * when the user has set nothing. `protocol_global_timeout` is omitted when
 * unset, so DATUM's built-in 60 applies.
 */
const WORK_UPDATE_DEFAULT = 5
const PROTOCOL_TIMEOUT_DEFAULT = 60

/**
 * DATUM refuses to start unless `protocol_global_timeout` is at least
 * `work_update_seconds` plus 5, and says so as a FATAL during config parsing.
 *
 * The two live in different actions, so a value that is legal when saved can be
 * made illegal later from the other form. Both save paths call this, which is
 * what makes the check symmetric. Rejecting here rather than clamping in the
 * entrypoint is deliberate: silently stretching somebody's timeout hides a
 * misconfiguration, and a container that will not boot is worse than a form that
 * explains why.
 *
 * Verified against the binary rather than read from `--help`: 100 with 60 gives
 * "DATUM protocol global timeout must be at least the work update interval plus
 * 5 seconds."
 */
export async function assertTimingsAgree(
  effects: any,
  changed: 'bitcoind' | 'datum',
  input: any,
) {
  const c = await storeJson.read((s) => s.config).once()
  const workUpdate =
    (changed === 'bitcoind'
      ? input?.work_update_seconds
      : c?.bitcoind?.work_update_seconds) ?? WORK_UPDATE_DEFAULT
  const timeout =
    (changed === 'datum'
      ? input?.protocol_global_timeout
      : c?.datum?.protocol_global_timeout) ?? PROTOCOL_TIMEOUT_DEFAULT

  const required = workUpdate + 5
  if (timeout >= required) return

  throw new Error(
    changed === 'bitcoind'
      ? `A work update interval of ${workUpdate}s needs a DATUM protocol ` +
          `timeout of at least ${required}s, and it is currently ${timeout}s. ` +
          `Raise Protocol Timeout under DATUM Pool first, then set this.`
      : `A protocol timeout of ${timeout}s is below the ${required}s that a ` +
          `work update interval of ${workUpdate}s requires. Set it to ` +
          `${required}s or more, or lower Work Update Seconds under Bitcoind ` +
          `first.`,
  )
}

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
