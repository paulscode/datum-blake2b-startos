import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  // Where block rewards go. There is no safe default: an address we invented
  // would silently send the user's coins somewhere they do not control, so this
  // starts empty and the service refuses to run until it is set.
  //
  // TODO: a `sdk.Action` to set this, surfaced as a critical task on install, so
  // the user is prompted rather than having to find it.
  poolAddress: z.string().catch(''),

  // Password for the dashboard's admin pages, which is what makes the connected
  // miners visible at all. Empty disables them, which is DATUM's own semantics
  // for a blank admin_password rather than a convention invented here. Generated
  // on install so the dashboard is useful without the user doing anything.
  // Optional rather than `.catch('')`, so "never set" and "deliberately cleared"
  // are different values. `seedFiles` fills only the first: an empty string is a
  // user turning the admin pages off and must survive the next init.
  adminPassword: z.string().optional().catch(undefined),

  // Starting share difficulty. Vardiff adapts from here; 64 lets even a slow
  // hasher produce shares immediately on connect.
  //
  // Predates `config.stratum.vardiff_min` below and is kept as the authority so
  // an existing install keeps its value with no migration. The Stratum config
  // form edits this field, not the nested one.
  vardiffMin: z.number().int().positive().catch(64),

  // The rest of DATUM's own configuration, grouped exactly as DATUM groups it,
  // so the config actions here line up with the official Datum Gateway package's
  // and a user moving between them finds the same settings in the same places.
  //
  // Every field is optional with a `.catch()`, which is what lets this be added
  // to a released package without a migration: an existing store.json simply
  // reads as all-unset. Unset means "do not write it", so DATUM's own defaults
  // apply rather than ours.
  //
  // Settings this package controls are deliberately absent: the listen ports,
  // the RPC credentials (from the node's cookie), `save_submitblocks_dir`,
  // `pow_algorithm` and `modify_conf`. Exposing them would let a user break the
  // package's own wiring.
  config: z
    .object({
      bitcoind: z
        .object({
          work_update_seconds: z.number().int().positive().optional(),
          notify_fallback: z.boolean().optional(),
        })
        .catch({}),
      stratum: z
        .object({
          max_clients_per_thread: z.number().int().positive().optional(),
          max_threads: z.number().int().positive().optional(),
          max_clients: z.number().int().positive().optional(),
          trust_proxy: z.number().int().nonnegative().optional(),
          vardiff_target_shares_min: z.number().int().positive().optional(),
          vardiff_quickdiff_count: z.number().int().positive().optional(),
          vardiff_quickdiff_delta: z.number().int().positive().optional(),
          share_stale_seconds: z.number().int().positive().optional(),
          fingerprint_miners: z.boolean().optional(),
          idle_timeout_no_subscribe: z.number().int().nonnegative().optional(),
          idle_timeout_no_shares: z.number().int().nonnegative().optional(),
          idle_timeout_max_last_work: z.number().int().nonnegative().optional(),
        })
        .catch({}),
      mining: z
        .object({
          coinbase_tag_secondary: z.string().optional(),
          coinbase_unique_id: z.number().int().min(1).max(65535).optional(),
        })
        .catch({}),
      api: z
        .object({
          allow_insecure_auth: z.boolean().optional(),
        })
        .catch({}),
      logger: z
        .object({
          log_to_file: z.boolean().optional(),
          log_rotate_daily: z.boolean().optional(),
          log_calling_function: z.boolean().optional(),
          log_level_console: z.number().int().min(0).max(4).optional(),
          log_level_file: z.number().int().min(0).max(4).optional(),
        })
        .catch({}),
      datum: z
        .object({
          pool_host: z.string().optional(),
          pool_port: z.number().int().positive().optional(),
          pool_pubkey: z.string().optional(),
          pool_pass_workers: z.boolean().optional(),
          pool_pass_full_users: z.boolean().optional(),
          always_pay_self: z.boolean().optional(),
          pooled_mining_only: z.boolean().optional(),
          protocol_global_timeout: z.number().int().positive().optional(),
        })
        .catch({}),
    })
    .catch({
      bitcoind: {},
      stratum: {},
      mining: {},
      api: {},
      logger: {},
      datum: {},
    }),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
