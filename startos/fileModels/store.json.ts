import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  // Where block rewards go, keyed by chain. There is no safe default: an address
  // we invented would silently send the user's coins somewhere they do not
  // control, so a chain with no entry means the service refuses to run.
  //
  // Keyed by chain because it was not, and that was a real hazard rather than an
  // untidiness. bitcoind keeps a separate wallet per chain, so an address derived
  // on one belongs to a wallet another never opens. A single field survived a
  // chain switch and kept paying to the old chain's wallet. Worse, it did so
  // quietly: DATUM's parser is explicitly "agnostic to testnet vs mainnet
  // addresses" (datum_utils.c), so a leftover tb1 address on mainnet produces a
  // perfectly valid mainnet output paying a key from a test wallet.
  poolAddresses: z.record(z.string(), z.string()).catch({}),

  // The chain the node was on at the last start, recorded by main.ts.
  //
  // Actions cannot see the node's config the way main.ts can, and an address has
  // to be validated against the chain it is for. Recording it here is how Set
  // Payout Address knows which rules to apply and which key to write, without
  // asking the user to tell it something the system already knows.
  nodeChain: z.string().catch(''),

  // The single-chain field this replaced. Read only by the migration, which moves
  // it under the chain its own prefix identifies. Kept rather than deleted so an
  // upgrade cannot lose an address that was set before the split, and so nothing
  // silently reads a value that may belong to a different chain.
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
          coinbase_tag_primary: z.string().optional(),
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
