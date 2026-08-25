export const DEFAULT_LANG = 'en_US'

const dict = {
  'Starting Datum Gateway BLAKE2b': 0,
  'Stratum': 1,
  'Point your BLAKE2b ASIC at this address': 2,
  'Dashboard': 3,
  'Gateway status and share counts': 4,
  'The gateway is serving work': 5,
  'The gateway is not serving work yet': 6,
  'Payout Address': 7,
  'A regtest address from your BLAKE2b node. Every block this gateway mines pays here.': 8,
  'Must be a regtest address starting with m, n or 2': 9,
  'Set Payout Address': 10,
  'Choose where block rewards go. The gateway will not mine until this is set.': 11,
  'Payout Address Set': 12,
  'Restart the gateway for this to take effect. Blocks it mines will pay to this address.': 13,
  'Set a payout address before mining': 14,
  'Get an address from your node to receive block rewards': 15,
  'Stratum (compatibility test)': 16,
  'Same mining, but the conversation is recorded so you can report how your miner behaves. Use the normal Stratum address otherwise.': 17,
  'Compatibility capture': 18,
  'Ready to record a miner': 19,
  'Not recording yet': 20,
  'Make': 21,
  'Who makes it, e.g. Goldshell, Bitmain': 22,
  'Model': 23,
  'e.g. HS-Box, SC-Box, Antminer A3': 24,
  'Firmware version': 25,
  'From the miner’s own web interface, if you can find it': 26,
  'Anything else worth saying': 27,
  'What you tried, what it did, anything that looked odd': 28,
  'Create Compatibility Report': 29,
  'Summarise how your miner talked to this gateway, so the result can be shared with the upstream projects.': 30,
  'Compatibility Report': 31,
  'Copy this and share it in the Bitcoin section of paulscode.com (a free account is needed to post), or open a GitHub issue if you prefer. Nothing is sent anywhere on its own.': 32,
  'Report': 33,
  'Dashboard password': 34,
  'The password for the dashboard’s admin pages. The username is always “admin”. Leave it as it is to keep the current one, or use Generate for a new one. Clearing it turns the admin pages off.': 35,
  'Dashboard Password': 36,
  'Show or change the password for the dashboard’s admin pages, which is what lets you see connected miners.': 37,
  'The gateway restarts to apply a change. Mining hardware reconnects on its own.': 38,
  'The dashboard’s admin pages are on. Sign in with the username and password below to see your connected miners.': 39,
  'The dashboard’s admin pages are off. The dashboard still shows gateway status, but not the list of connected miners.': 40,
  'Username': 41,
  'Password': 42,
  '(admin pages disabled)': 43,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
