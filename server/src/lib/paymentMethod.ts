/** What a payment can be taken as. Free text before this; a fixed list from here on. */
export const PAYMENT_METHODS = ['UPI', 'Bank transfer', 'Card', 'Cheque', 'Cash'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const CASH_WORDS = ['cash', 'nakad', 'nagad']

/**
 * Whether a payment was taken in cash.
 *
 * The method was a free-text box for a long time, so the stored values are whatever
 * anyone typed — "Cash", "CASH", "cash payment". Matching on the word covers those as
 * well as the fixed list that replaces them.
 */
export function isCash(method?: string | null) {
  const value = String(method ?? '').toLowerCase()
  return CASH_WORDS.some((word) => value.includes(word))
}

/**
 * Whether a payment should put the booking on the invoice series.
 *
 * Only money that arrived through a bank does. Cash stays off the numbered series
 * entirely: once the GST registration is live, every serial raised has to be accounted
 * for in a return, and a cash booking that took a number would have to be answered for.
 *
 * A payment with no method recorded is left off too. A missing number can be issued by
 * hand afterwards; a serial raised against cash cannot be taken back out of the series.
 */
export function countsForInvoice(method?: string | null) {
  const value = String(method ?? '').trim()
  return value.length > 0 && !isCash(value)
}
