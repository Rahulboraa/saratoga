import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor } from '../models/Visitor.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { ensureDefaultProperty } from '../services/defaultProperty.js'

/**
 * One-off: everything that existed before properties belongs to the original villa.
 * Safe to re-run — it only touches rows that have no property yet.
 */
await connectDb()
const property = await ensureDefaultProperty()
console.log(`default property: ${property.name} (${property.id})`)

const models = { bookings: Booking, payments: Payment, expenses: Expense, expensePayments: ExpensePayment, visitors: Visitor, leads: Lead }
for (const [label, model] of Object.entries(models)) {
  const result = await (model as typeof Booking).updateMany(
    { $or: [{ propertyId: { $exists: false } }, { propertyId: null }] },
    { $set: { propertyId: property._id } },
  )
  console.log(`${label}: stamped ${result.modifiedCount}`)
}

// Admins deliberately have no property; everyone else needs one to see anything.
const users = await User.updateMany(
  { role: { $ne: 'admin' }, $or: [{ propertyId: { $exists: false } }, { propertyId: null }] },
  { $set: { propertyId: property._id } },
)
console.log(`users: assigned ${users.modifiedCount}`)

await mongoose.disconnect()
console.log('migration complete')
