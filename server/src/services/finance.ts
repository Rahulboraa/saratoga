import { Payment } from '../models/Payment.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import type { Types } from 'mongoose'

export async function paymentSums(bookingIds?: Types.ObjectId[], scope: Record<string, unknown> = {}) {
  const rows = await Payment.aggregate([
    ...(bookingIds ? [{ $match: { bookingId: { $in: bookingIds } } }] : []),
    ...(Object.keys(scope).length ? [{ $match: scope }] : []),
    { $group: { _id: '$bookingId', sum: { $sum: '$amount' } } },
  ])
  return new Map<string, number>(rows.map((r) => [String(r._id), r.sum]))
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
  sums: Map<string, number>,
) {
  const collected = (doc.legacyReceived ?? 0) + (sums.get(String(doc._id)) ?? 0)
  const payable = doc.amount + (doc.breakdown?.license ?? 0) + (doc.breakdown?.security ?? 0)
  return { collected, due: payable - collected, status: statusOf(payable, collected) }
}
