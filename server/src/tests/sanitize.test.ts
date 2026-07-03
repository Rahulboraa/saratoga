import { describe, it, expect } from 'vitest'
import { serializeBooking, serializeCalendarBooking, serializeLead, serializeVisitor, assertNoFinancialKeys } from '../lib/sanitize.js'

const booking = {
  _id: 'b1', guest: 'G', phone: '9', checkinDate: '2026-08-15', checkoutDate: '2026-08-16',
  checkinTime: '15:00', checkoutTime: '10:00', pax: '30', purpose: 'Party', source: 'Direct',
  dest: 'HDFC', notes: 'n', createdBy: 'admin', overlap: false,
  breakdown: { venue: 1, catering: 2, decor: 3, music: 4, cleaning: 5, license: 6, security: 7 },
  amount: 15, legacyReceived: 5, collected: 10, due: 5, status: 'partial',
}

const lead = {
  _id: 'l1', date: '2026-07-01', time: '10:00', name: 'L', phone: '9', eventType: 'Shoot',
  outcome: 'Interested', followup: '', notes: '', exec: 'simran', execLabel: 'Simran',
  flag: 'escalate', adminComment: 'secret', importedBy: '',
}

const visitor = {
  _id: 'v1', date: '2026-07-01', loggedAt: 'x', name: 'V', phone: '9', purpose: 'Delivery',
  inTime: '10:00', outTime: '', remarks: '', fuStatus: 'Hold', fuRemark: 'call back', loggedBy: 'caretaker',
}

describe('serializeBooking', () => {
  it('gives admin all financial fields', () => {
    const out = serializeBooking(booking, 'admin')
    expect(out.amount).toBe(15)
    expect(out.breakdown.venue).toBe(1)
    expect(out.collected).toBe(10)
    expect(out.status).toBe('partial')
    expect(out.dest).toBe('HDFC')
  })

  it.each(['manager', 'sales', 'caretaker'] as const)('strips all financial keys for %s', (role) => {
    const out = serializeBooking(booking, role)
    expect(assertNoFinancialKeys(out)).toEqual([])
    expect(out.guest).toBe('G')
    expect(out).not.toHaveProperty('amount')
    expect(out).not.toHaveProperty('breakdown')
    expect(out).not.toHaveProperty('collected')
    expect(out).not.toHaveProperty('due')
    expect(out).not.toHaveProperty('status')
    expect(out).not.toHaveProperty('dest')
    expect(out).not.toHaveProperty('legacyReceived')
  })
})

describe('serializeCalendarBooking', () => {
  it('exposes only calendar-safe fields', () => {
    const out = serializeCalendarBooking(booking)
    expect(assertNoFinancialKeys(out)).toEqual([])
    expect(Object.keys(out).sort()).toEqual(
      ['checkinDate', 'checkinTime', 'checkoutDate', 'checkoutTime', 'guest', 'id', 'overlap', 'pax', 'purpose'],
    )
  })
})

describe('serializeLead', () => {
  it('keeps flag and adminComment for admin and manager', () => {
    expect(serializeLead(lead, 'admin').adminComment).toBe('secret')
    expect(serializeLead(lead, 'manager').flag).toBe('escalate')
  })

  it('strips flag and adminComment for sales', () => {
    const out = serializeLead(lead, 'sales')
    expect(out).not.toHaveProperty('flag')
    expect(out).not.toHaveProperty('adminComment')
    expect(out.name).toBe('L')
  })
})

describe('serializeVisitor', () => {
  it('hides follow-up fields from caretaker only', () => {
    expect(serializeVisitor(visitor, 'sales').fuStatus).toBe('Hold')
    const out = serializeVisitor(visitor, 'caretaker')
    expect(out).not.toHaveProperty('fuStatus')
    expect(out).not.toHaveProperty('fuRemark')
  })
})
