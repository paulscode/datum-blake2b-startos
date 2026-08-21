export const DEFAULT_LANG = 'en_US'

const dict = {
  'Starting Datum Gateway BLAKE2b (regtest)': 0,
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
  'Copy this and open an issue on the datum-blake2b-startos repo. Nothing is sent anywhere on its own.': 32,
  'Report': 33,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
