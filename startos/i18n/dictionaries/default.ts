export const DEFAULT_LANG = 'en_US'

const dict = {
  'Starting Datum Gateway BLAKE2b (regtest)': 0,
  'Stratum': 1,
  'Point your BLAKE2b ASIC at this address': 2,
  'Dashboard': 3,
  'Gateway status and share counts': 4,
  'The gateway is serving work': 5,
  'The gateway is not serving work yet': 6,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
