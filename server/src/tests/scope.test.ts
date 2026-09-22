import { describe, it, expect, vi } from 'vitest'

const userRecord: { propertyId: string | null } = { propertyId: null }
vi.mock('../models/User.js', () => ({
  ROLES: ['admin', 'manager', 'sales', 'caretaker'],
  User: { findById: () => ({ select: () => Promise.resolve(userRecord) }) },
}))
import type { Request, Response } from 'express'
import { resolveScope, scoped, writeProperty } from '../middleware/scope.js'

const PROP = '507f1f77bcf86cd799439011'

function reqOf(user: Partial<Request['user']>, headers: Record<string, string> = {}) {
  return { user: { id: 'u1', ...user }, headers, query: {} } as unknown as Request
}

function resOf() {
  const res = {
    status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), headersSent: false,
  } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('resolveScope', () => {
  it('pins a non-admin to their own property and ignores the header', async () => {
    const req = reqOf({ role: 'manager', propertyId: PROP }, { 'x-property': 'someone-elses-id' })
    const next = vi.fn()
    await resolveScope(req, resOf(), next)
    expect(next).toHaveBeenCalled()
    expect(req.scope.propertyId).toBe(PROP)
    expect(String((req.scope.filter as { propertyId: unknown }).propertyId)).toBe(PROP)
  })

  it('refuses a non-admin with no property assigned', async () => {
    userRecord.propertyId = null
    const res = resOf()
    const next = vi.fn()
    await resolveScope(reqOf({ role: 'manager', propertyId: null }), res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('repairs a token issued before properties existed', async () => {
    // Signed in before the claim existed: the token has no property, the user record does.
    userRecord.propertyId = PROP
    const req = reqOf({ role: 'caretaker', propertyId: null })
    const res = resOf()
    const next = vi.fn()
    await resolveScope(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.scope.propertyId).toBe(PROP)
    // and hands back a token that carries it, so it heals instead of failing forever
    expect(res.setHeader).toHaveBeenCalledWith('x-refresh-token', expect.any(String))
  })

  it('gives an admin every property when no header is sent', async () => {
    const req = reqOf({ role: 'admin', propertyId: null })
    const next = vi.fn()
    await resolveScope(req, resOf(), next)
    expect(req.scope.propertyId).toBeNull()
    expect(req.scope.filter).toEqual({})
  })
})

describe('scoped', () => {
  it('merges the route filter with the property scope', () => {
    const req = { scope: { propertyId: PROP, filter: { propertyId: PROP } } } as unknown as Request
    expect(scoped(req, { guest: 'Parul' })).toEqual({ guest: 'Parul', propertyId: PROP })
  })

  it('cannot be widened by a route filter that names another property', () => {
    const req = { scope: { propertyId: PROP, filter: { propertyId: PROP } } } as unknown as Request
    expect(scoped(req, { propertyId: 'other' })).toEqual({ propertyId: PROP })
  })
})

describe('writeProperty', () => {
  it('returns the scoped property', () => {
    const req = { scope: { propertyId: PROP, filter: {} } } as unknown as Request
    expect(writeProperty(req, resOf())).toBe(PROP)
  })

  it('rejects a write while an admin is viewing all properties', () => {
    const res = resOf()
    const req = { scope: { propertyId: null, filter: {} } } as unknown as Request
    expect(writeProperty(req, res)).toBeNull()
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
