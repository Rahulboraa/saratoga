import { Property } from '../models/Property.js'
import type { Booking } from '../models/Booking.js'

export const GST_RATE = 0.18

/** Indian financial year label for a date, e.g. 2026-11-15 → "2026-27". */
export function financialYear(ymd: string) {
  const year = Number(ymd.slice(0, 4))
  const month = Number(ymd.slice(5, 7))
  const start = month >= 4 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/**
 * Next serial for a property, restarting each financial year. Invoice numbers must be
 * consecutive, so this only runs when an invoice is actually issued — never on a preview.
 */
export async function nextInvoiceNo(propertyId: string, date: string) {
  const fy = financialYear(date)
  const bumped = await Property.findOneAndUpdate(
    { _id: propertyId, invoiceFy: fy },
    { $inc: { invoiceSeq: 1 } },
    { new: true },
  )
  const property = bumped ?? await Property.findOneAndUpdate(
    { _id: propertyId },
    { $set: { invoiceFy: fy, invoiceSeq: 1 } },
    { new: true },
  )
  if (!property) throw Object.assign(new Error('Property not found'), { status: 400 })
  return `${property.invoicePrefix || 'INV'}/${fy}/${String(property.invoiceSeq).padStart(3, '0')}`
}

type BookingDoc = InstanceType<typeof Booking>

/**
 * Invoice figures for a booking. GST applies to the service lines only: the licence fee
 * is a pass-through at actuals and the security deposit is refundable, so neither is
 * taxed. A booking billed without GST carries the same lines at zero tax.
 */
export function invoiceLines(booking: BookingDoc) {
  const b = booking.breakdown
  const items = ([
    ['Venue rental', b?.venue ?? 0],
    ['Catering', b?.catering ?? 0],
    ['Decor', b?.decor ?? 0],
    ['Music', b?.music ?? 0],
    ['Valet', b?.valet ?? 0],
    ['Cleaning', b?.cleaning ?? 0],
  ] as [string, number][]).filter(([, amount]) => amount > 0).map(([label, amount]) => ({ label, amount }))

  const gstEnabled = booking.gstEnabled !== false
  const taxable = items.reduce((sum, i) => sum + i.amount, 0)
  const cgst = gstEnabled ? Math.round(taxable * (GST_RATE / 2)) : 0
  const sgst = gstEnabled ? Math.round(taxable * (GST_RATE / 2)) : 0
  const licence = b?.license ?? 0
  const security = b?.security ?? 0

  return {
    gstEnabled,
    items,
    taxable,
    cgst,
    sgst,
    licence,
    security,
    total: taxable + cgst + sgst + licence + security,
  }
}
