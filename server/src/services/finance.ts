import { Payment } from '../models/Payment.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import type { Types } from 'mongoose'

export interface PaymentTotals {
  /** Net of refunds — what the guest is actually out of pocket. */
  collected: number
  /** Money handed back, which a refunded deposit makes up most of. */
  refunded: number
}

export async function paymentSums(bookingIds?: Types.ObjectId[], scope: Record<string, unknown> = {}) {
  const rows = await Payment.aggregate([
    ...(bookingIds ? [{ $match: { bookingId: { $in: bookingIds } } }] : []),
    ...(Object.keys(scope).length ? [{ $match: scope }] : []),
    {
      $group: {
        _id: '$bookingId',
        collected: { $sum: '$amount' },
        // Refunds are recorded as negative payments.
        refunded: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
      },
    },
  ])
  return new Map<string, PaymentTotals>(
    rows.map((r) => [String(r._id), { collected: r.collected, refunded: r.refunded }]),
  )
}

export async function expensePaymentSums(expenseIds?: Types.ObjectId[], scope: Record<string, unknown> = {}) {
  const rows = await ExpensePayment.aggregate([
    ...(expenseIds ? [{ $match: { expenseId: { $in: expenseIds } } }] : []),
    ...(Object.keys(scope).length ? [{ $match: scope }] : []),
    { $group: { _id: '$expenseId', sum: { $sum: '$amount' } } },
  ])
  return new Map<string, number>(rows.map((r) => [String(r._id), r.sum]))
}

export function statusOf(amount: number, collected: number) {
  if (collected <= 0) return 'pending'
  if (collected >= amount) return 'paid'
  return 'partial'
}

export function withFinance(
  doc: { _id: unknown; amount: number; legacyReceived?: number; breakdown?: { license?: number; security?: number } | null },
  sums: Map<string, PaymentTotals>,
) {
  const totals = sums.get(String(doc._id)) ?? { collected: 0, refunded: 0 }
  const collected = (doc.legacyReceived ?? 0) + totals.collected

  // The security deposit is money held on the guest's behalf, not money earned, so it is
  // no part of what the booking is worth: counting it inflated both the balance owed and
  // the collections the accounts are built from.
  //
  // A refund still reduces what is owed, which is right for a cancellation or an
  // overpayment handed back.
  const payable = doc.amount + (doc.breakdown?.license ?? 0) - totals.refunded

  return { collected, refunded: totals.refunded, due: payable - collected, status: statusOf(payable, collected) }
}
