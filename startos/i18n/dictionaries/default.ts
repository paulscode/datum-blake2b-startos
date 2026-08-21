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
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
