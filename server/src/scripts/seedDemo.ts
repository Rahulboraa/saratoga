import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { env } from '../env.js'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor } from '../models/Visitor.js'
import { Lead } from '../models/Lead.js'

const isRemote = env.MONGODB_URI.includes('mongodb+srv') || env.MONGODB_URI.includes('mongodb.net')
const dbName = env.MONGODB_URI.split('/').pop()?.split('?')[0] ?? ''
if (isRemote && !dbName.includes('test')) {
  throw new Error(`Refusing to seed demo data into remote non-test database "${dbName}". Use a *_test database.`)
}

await connectDb()
console.log(`Seeding demo data into "${dbName || 'saratoga'}" (${isRemote ? 'remote' : 'local'})`)

await Promise.all([
  Booking.deleteMany({}), Payment.deleteMany({}), Expense.deleteMany({}),
  ExpensePayment.deleteMany({}), Visitor.deleteMany({}), Lead.deleteMany({}),
])

const bk = (guest: string, phone: string, checkin: string, checkout: string, purpose: string, source: string, breakdown: Record<string, number>, notes = '', times: [string, string] = ['15:00', '10:00']) => ({
  guest, phone, checkinDate: checkin, checkoutDate: checkout, purpose, source,
  checkinTime: times[0], checkoutTime: times[1],
  pax: `${20 + Math.floor(Math.random() * 60)} guests`,
  dest: ['HDFC', 'Rajound Paytm', 'Airbnb', 'ICICI'][Math.floor(Math.random() * 4)],
  notes, breakdown, createdBy: 'admin',
})

const bookings = await Booking.create([
  bk('Sharma Wedding', '9810012345', '2026-05-09', '2026-05-11', 'Party', 'Referral', { venue: 90000, catering: 45000, decor: 25000, music: 12000, cleaning: 5000, license: 5000, security: 20000 }, 'Mehendi + sangeet, DJ till 10pm'),
  bk('Netflix Ad Shoot', '9820098200', '2026-05-18', '2026-05-20', 'Shoot', 'Direct', { venue: 120000, cleaning: 8000, license: 15000, security: 50000 }, 'Crew of 40, genset required'),
  bk('Kapoor Anniversary', '9911223344', '2026-05-25', '2026-05-25', 'Party', 'Airbnb', { venue: 55000, catering: 30000, decor: 15000, cleaning: 4000 }),
  bk('Mehta Pre-wedding', '9877700011', '2026-06-03', '2026-06-04', 'Pre-wedding', 'Direct', { venue: 45000, decor: 10000, cleaning: 3000 }),
  bk('Aarav 1st Birthday', '9899911122', '2026-06-08', '2026-06-08', 'Kids Birthday', 'Referral', { venue: 40000, catering: 25000, decor: 18000, cleaning: 3500 }),
  bk('Zomato Office Party', '9560012399', '2026-06-14', '2026-06-15', 'Party', 'Direct', { venue: 85000, catering: 60000, music: 15000, cleaning: 6000 }),
  bk('Singh Family Getaway', '9812345670', '2026-06-21', '2026-06-23', 'Other', 'Airbnb', { venue: 65000, cleaning: 5000 }),
  bk('Myntra Catalogue Shoot', '9870001112', '2026-06-27', '2026-06-28', 'Shoot', 'Direct', { venue: 95000, cleaning: 7000, license: 12000 }),
  bk('Gupta Engagement', '9955512340', '2026-07-05', '2026-07-06', 'Party', 'Referral', { venue: 75000, catering: 50000, decor: 30000, music: 18000, cleaning: 5000 }),
  bk('Riya Pre-wedding', '9811100234', '2026-07-12', '2026-07-13', 'Pre-wedding', 'Airbnb', { venue: 48000, decor: 8000, cleaning: 3000 }),
  bk('Verma Kitty Party', '9899988877', '2026-07-18', '2026-07-18', 'Party', 'Direct', { venue: 35000, catering: 20000, cleaning: 2500 }, '', ['11:00', '17:00']),
  bk('Music Video Shoot', '9777788899', '2026-07-18', '2026-07-19', 'Shoot', 'Direct', { venue: 110000, cleaning: 8000, license: 15000 }, 'Overlap check — evening setup', ['16:00', '12:00']),
  bk('Ahuja 25th Anniversary', '9810055667', '2026-07-26', '2026-07-27', 'Party', 'Referral', { venue: 80000, catering: 55000, decor: 22000, music: 14000, cleaning: 5000 }),
  bk('Kabir 5th Birthday', '9911002200', '2026-08-02', '2026-08-02', 'Kids Birthday', 'Direct', { venue: 42000, catering: 28000, decor: 20000, cleaning: 3500 }),
  bk('Bansal Wedding', '9810098100', '2026-08-09', '2026-08-11', 'Party', 'Referral', { venue: 150000, catering: 90000, decor: 45000, music: 20000, cleaning: 8000, license: 8000, security: 25000 }, 'Full villa, 3 functions'),
  bk('Fashion Brand Shoot', '9873332221', '2026-08-16', '2026-08-17', 'Shoot', 'Airbnb', { venue: 88000, cleaning: 6000, license: 10000 }),
  bk('Chopra Pre-wedding', '9990001234', '2026-08-23', '2026-08-24', 'Pre-wedding', 'Direct', { venue: 50000, decor: 12000, cleaning: 3000 }),
  bk('Diwali Corporate Bash', '9560011223', '2026-09-05', '2026-09-06', 'Party', 'Direct', { venue: 95000, catering: 70000, decor: 35000, music: 20000, cleaning: 6000 }),
  bk('Tanwar Family Reunion', '9812223334', '2026-09-13', '2026-09-14', 'Other', 'Referral', { venue: 60000, catering: 35000, cleaning: 4000 }),
  bk('Web Series Shoot', '9878889990', '2026-09-20', '2026-09-23', 'Shoot', 'Direct', { venue: 200000, cleaning: 12000, license: 20000, security: 60000 }, '4-day schedule, 60 crew'),
])

const payPlans: [number, number[], string[]][] = [
  [0, [1.0], ['UPI']],
  [1, [0.5, 0.5], ['Bank Transfer', 'Bank Transfer']],
  [2, [1.0], ['Cash']],
  [3, [0.4], ['UPI']],
  [4, [1.0], ['UPI']],
  [5, [0.5, 0.3], ['Bank Transfer', 'UPI']],
  [6, [1.0], ['Cash']],
  [7, [0.6], ['Bank Transfer']],
  [8, [0.3], ['UPI']],
  [9, [1.0], ['Cash']],
  [10, [0.5], ['UPI']],
  [12, [0.25], ['UPI']],
  [14, [0.3, 0.2], ['Bank Transfer', 'UPI']],
  [15, [0.5], ['Bank Transfer']],
  [17, [0.2], ['UPI']],
]

const payments: Record<string, unknown>[] = []
for (const [idx, fractions, methods] of payPlans) {
  const b = bookings[idx]
  let offset = -30
  fractions.forEach((f, i) => {
    const d = new Date(b.checkinDate)
    d.setDate(d.getDate() + offset + i * 12)
    payments.push({
      bookingId: b._id,
      date: d.toISOString().slice(0, 10),
      amount: Math.round(b.amount * f),
      method: methods[i],
      dest: b.dest,
      by: ['Deepak', 'Simran', 'Akhil'][i % 3],
      notes: fractions.length > 1 ? `Installment ${i + 1}` : 'Full payment',
    })
  })
}
await Payment.create(payments)

const expenses = await Expense.create([
  { date: '2026-05-01', cat: 'Salary', desc: 'Caretaker salary — May', amount: 18000, vendor: 'Ramesh', by: 'Akhil' },
  { date: '2026-05-06', cat: 'Housekeeping', desc: 'Deep cleaning post-wedding', amount: 8500, vendor: 'UrbanKlean', by: 'Deepak' },
  { date: '2026-05-14', cat: 'Electricity', desc: 'Electricity bill — May', amount: 22400, vendor: 'DHBVN' },
  { date: '2026-05-20', cat: 'Meta Ads', desc: 'Instagram lead campaign', amount: 15000, vendor: 'Meta', by: 'Simran' },
  { date: '2026-06-01', cat: 'Salary', desc: 'Caretaker salary — June', amount: 18000, vendor: 'Ramesh', by: 'Akhil' },
  { date: '2026-06-10', cat: 'Maintenance', desc: 'Pool pump replacement', amount: 32000, vendor: 'AquaTech' },
  { date: '2026-06-18', cat: 'Decor', desc: 'Permanent fairy lights — lawn', amount: 12500, vendor: 'LightHouse Decor' },
  { date: '2026-06-25', cat: 'Marketing', desc: 'Drone video for listings', amount: 9000, vendor: 'SkyShots' },
  { date: '2026-07-01', cat: 'Salary', desc: 'Caretaker salary — July', amount: 18000, vendor: 'Ramesh', by: 'Akhil' },
  { date: '2026-07-08', cat: 'Electricity', desc: 'Electricity bill — June', amount: 31800, vendor: 'DHBVN' },
  { date: '2026-07-15', cat: 'Dry Cleaning', desc: 'Curtains + sofa covers', amount: 6400, vendor: 'Pressto' },
  { date: '2026-07-22', cat: 'Meta Ads', desc: 'Wedding season campaign', amount: 25000, vendor: 'Meta', by: 'Simran' },
  { date: '2026-08-01', cat: 'Salary', desc: 'Caretaker salary — August', amount: 18000, vendor: 'Ramesh', by: 'Akhil' },
  { date: '2026-08-12', cat: 'Maintenance', desc: 'Bathroom regrouting x4', amount: 21000, vendor: 'FixIt Bros' },
  { date: '2026-08-20', cat: 'Catering', desc: 'Standby chef — Bansal wedding', amount: 15000, vendor: 'Chef Manoj' },
])

const expPays: Record<string, unknown>[] = []
expenses.forEach((e, i) => {
  if (i % 3 === 0) expPays.push({ expenseId: e._id, date: e.date, amount: e.amount, method: 'Bank Transfer', to: e.vendor, by: 'Akhil' })
  else if (i % 3 === 1) expPays.push({ expenseId: e._id, date: e.date, amount: Math.round(e.amount * 0.5), method: 'UPI', to: e.vendor, by: 'Deepak', notes: 'Advance' })
})
await ExpensePayment.create(expPays)

await Visitor.create([
  { date: '2026-07-01', name: 'Amit Courier', phone: '9811111111', purpose: 'Delivery', inTime: '10:30', outTime: '10:45', loggedBy: 'caretaker' },
  { date: '2026-07-01', name: 'Pooja Sharma', phone: '9822222222', purpose: 'Guest visit — site tour', inTime: '16:00', outTime: '17:10', fuStatus: 'Hold', fuRemark: 'Wants Dec wedding dates, call with quote', loggedBy: 'caretaker' },
  { date: '2026-07-02', name: 'DHBVN Meter Reader', phone: '9833333333', purpose: 'Staff', inTime: '11:00', outTime: '11:15', loggedBy: 'caretaker' },
  { date: '2026-07-02', name: 'Ravi Plumber', phone: '9844444444', purpose: 'Vendor — pool pump service', inTime: '14:00', outTime: '16:30', loggedBy: 'caretaker' },
  { date: '2026-07-03', name: 'Neha & Family', phone: '9855555555', purpose: 'Guest — venue recce', inTime: '12:00', outTime: '', remarks: 'Liked the lawn, budget discussion pending', fuStatus: 'Hold', fuRemark: 'Share party package on WhatsApp', loggedBy: 'caretaker' },
  { date: '2026-07-03', name: 'BigBasket Delivery', phone: '9866666666', purpose: 'Delivery', inTime: '09:15', outTime: '09:20', loggedBy: 'caretaker' },
  { date: '2026-06-30', name: 'Suresh Gardener', phone: '9877777777', purpose: 'Staff', inTime: '08:00', outTime: '13:00', loggedBy: 'caretaker' },
  { date: '2026-06-30', name: 'Tent House Crew', phone: '9888888888', purpose: 'Vendor — decor pickup', inTime: '15:00', outTime: '18:00', loggedBy: 'caretaker' },
])

await Lead.create([
  { date: '2026-07-01', time: '11:20', name: 'Rohit Malhotra', phone: '9810011001', eventType: 'Wedding / Engagement', outcome: 'Interested', followup: '2026-07-06', notes: 'Nov wedding, 150 pax, asked full villa quote', exec: 'simran', execLabel: 'Simran' },
  { date: '2026-07-01', time: '15:45', name: 'Kritika Jain', phone: '9810022002', eventType: 'Birthday / Anniversary / Milestone', outcome: 'Callback', followup: '2026-06-29', notes: 'Husband ka 40th, wants pool party', exec: 'deepak', execLabel: 'Deepak' },
  { date: '2026-06-28', time: '12:00', name: 'AdFilm Productions', phone: '9810033003', eventType: 'Shoot', outcome: 'Interested', followup: '2026-06-30', notes: '2-day ad shoot, need crew parking for 8 vans', exec: 'simran', execLabel: 'Simran', flag: 'escalate', adminComment: 'Big ticket — Akhil ko loop karo' },
  { date: '2026-06-27', time: '17:30', name: 'Sneha Agarwal', phone: '9810044004', eventType: 'Corporate / Office Party', outcome: 'Converted', notes: 'Zomato team offsite — booked 14 June', exec: 'deepak', execLabel: 'Deepak', flag: 'good' },
  { date: '2026-06-26', time: '10:15', name: 'Manish Tiwari', phone: '9810055005', eventType: 'Wedding / Engagement', outcome: 'Not Interested', notes: 'Budget mismatch, wanted under 50k', exec: 'simran', execLabel: 'Simran' },
  { date: '2026-07-02', time: '13:00', name: 'Divya Kapoor', phone: '9810066006', eventType: 'Shoot', outcome: '', notes: 'Insta form fill — pre-wedding shoot query', exec: '' },
  { date: '2026-07-02', time: '18:20', name: 'Harsh Vardhan', phone: '9810077007', eventType: 'Birthday / Anniversary / Milestone', outcome: '', notes: 'Walk-in enquiry, kid ka birthday Aug me', exec: '' },
  { date: '2026-07-03', time: '10:00', name: 'Priyanka Sethi', phone: '9810088008', eventType: 'Wedding / Engagement', outcome: 'Callback', followup: '2026-07-10', notes: 'Roka ceremony, 60 pax, veg catering only', exec: 'simran', execLabel: 'Simran' },
  { date: '2026-06-25', time: '14:40', name: 'Gaurav Bhalla', phone: '9810099009', eventType: 'Corporate / Office Party', outcome: 'Interested', followup: '2026-06-28', notes: 'Startup founders retreat, 2 nights', exec: 'deepak', execLabel: 'Deepak', flag: 'review', adminComment: 'Weekday discount offer kiya hai — confirm pricing' },
  { date: '2026-06-24', time: '16:10', name: 'Meera Reddy', phone: '9810010010', eventType: 'Other', outcome: 'Converted', notes: 'Family reunion — booked 21 June', exec: 'simran', execLabel: 'Simran', flag: 'good' },
])

const counts = {
  bookings: await Booking.countDocuments(),
  payments: await Payment.countDocuments(),
  expenses: await Expense.countDocuments(),
  expensePayments: await ExpensePayment.countDocuments(),
  visitors: await Visitor.countDocuments(),
  leads: await Lead.countDocuments(),
}
console.log('Demo data seeded:', counts)
await mongoose.disconnect()
