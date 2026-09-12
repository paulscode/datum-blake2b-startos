import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { convoyPoolPubkey, datumBuiltinPoolPubkey } from '../utils'

/**
 * Make sure the pool key on disk is one that can actually reach a pool on this chain.
 *
 * <p>DATUM compiles in a pool key and uses it whenever the config names none. That key is Ocean's,
 * on the chain that kept SHA256d, so on this chain "unset" is not neutral: a gateway given Convoy's
 * host and port and nothing else offers the wrong key, the handshake cannot authenticate, and with
 * reward sharing on "prefer" it falls back to solo silently. The dashboard shows it as "Non-Pooled
 * Mode" with the gateway's own coinbase tag where the pool's would be, which is not an obvious way
 * to say "wrong key".
 *
 * <p>Setting the action's default was not enough on its own, and that is why this exists. A default
 * populates the form; it does not write anything. An install that updated into it still had no
 * pool_pubkey in its store, so DATUM_SETTINGS still omitted it and DATUM still substituted Ocean's,
 * until someone happened to open DATUM Pool and press Save. The Umbrel package repairs itself in
 * its pre-start hook and this is the equivalent, so an update applies itself here too.
 *
 * <p>Two cases are repaired. Absent, which is every install predating the default. And Ocean's key
 * present verbatim, which is what a config carried over from the official Datum Gateway package
 * looks like, and what someone gets if they read it off DATUM's own documentation.
 *
 * <p>Anything else is the operator's and is left alone, including a key they pasted from Convoy
 * themselves and any key Convoy rotates to later. Unlike the dashboard password, an empty string is
 * not treated as a decision worth keeping: a blank password meaningfully turns the admin pages off,
 * whereas a blank pool key just means Ocean's, which cannot be what anyone wanted here.
 */
export const seedPoolPubkey = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().once()
  const current = store?.config?.datum?.pool_pubkey

  const unset = current === undefined || current === null || current === ''
  const isDatumBuiltin =
    typeof current === 'string' &&
    current.trim().toLowerCase() === datumBuiltinPoolPubkey

  if (!unset && !isDatumBuiltin) {
    return
  }

  //Reconstructed rather than merged shallowly, so the other config groups survive. Same shape as
  //writeGroup, which is the only other writer of this part of the store.
  await storeJson.write(effects, {
    ...(store ?? {}),
    config: {
      ...(store?.config ?? {}),
      datum: {
        ...(store?.config?.datum ?? {}),
        pool_pubkey: convoyPoolPubkey,
      },
    },
  } as any)
})
