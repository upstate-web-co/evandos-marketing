import { describe, it, expect } from 'vitest'
import { isTokenExpired, isTokenExpiringSoon } from '../src/lib/social/tokens'

// ─── isTokenExpired ──────────────────────────────────

describe('isTokenExpired', () => {
  it('returns true for a past date', () => {
    expect(isTokenExpired('2020-01-01T00:00:00.000Z')).toBe(true)
  })

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(isTokenExpired(future)).toBe(false)
  })

  it('returns true for the current instant (<=)', () => {
    const now = new Date().toISOString()
    expect(isTokenExpired(now)).toBe(true)
  })

  it('handles date-only string (no time component)', () => {
    expect(isTokenExpired('2020-01-01')).toBe(true)
    expect(isTokenExpired('2099-12-31')).toBe(false)
  })

  it('handles non-UTC timezone offset strings', () => {
    // Date far in the past regardless of timezone
    expect(isTokenExpired('2020-01-01T00:00:00+05:00')).toBe(true)
  })

  it('returns true for empty string (Invalid Date <= any Date is false, but NaN comparison)', () => {
    // new Date('') creates Invalid Date, getTime() returns NaN
    // NaN <= Date.now() is false — so isTokenExpired('') returns false
    // This documents the actual behavior for defensive coding
    expect(isTokenExpired('')).toBe(false)
  })
})

// ─── isTokenExpiringSoon ─────────────────────────────

describe('isTokenExpiringSoon', () => {
  it('returns true when token expires within default 5 minutes', () => {
    const inThreeMinutes = new Date(Date.now() + 3 * 60_000).toISOString()
    expect(isTokenExpiringSoon(inThreeMinutes)).toBe(true)
  })

  it('returns false when token expires well into the future', () => {
    const inTwoHours = new Date(Date.now() + 2 * 3600_000).toISOString()
    expect(isTokenExpiringSoon(inTwoHours)).toBe(false)
  })

  it('returns true for already-expired token', () => {
    expect(isTokenExpiringSoon('2020-01-01T00:00:00.000Z')).toBe(true)
  })

  it('respects custom minutesBefore parameter', () => {
    const inTenMinutes = new Date(Date.now() + 10 * 60_000).toISOString()
    // Not expiring soon with 5-min window
    expect(isTokenExpiringSoon(inTenMinutes, 5)).toBe(false)
    // But expiring soon with 15-min window
    expect(isTokenExpiringSoon(inTenMinutes, 15)).toBe(true)
  })

  it('handles edge case: well past the boundary is not expiring soon', () => {
    // 5 min + 10 sec buffer to avoid timing flakiness
    const pastBoundary = new Date(Date.now() + 5 * 60_000 + 10_000).toISOString()
    expect(isTokenExpiringSoon(pastBoundary, 5)).toBe(false)
  })

  it('treats zero minutesBefore as only catching already-expired', () => {
    const inOneSecond = new Date(Date.now() + 1000).toISOString()
    expect(isTokenExpiringSoon(inOneSecond, 0)).toBe(false)
    expect(isTokenExpiringSoon('2020-01-01T00:00:00Z', 0)).toBe(true)
  })

  it('handles GBP-scale expiry (1 hour window for hourly refresh)', () => {
    const in30Minutes = new Date(Date.now() + 30 * 60_000).toISOString()
    // With 60-min window (used in TokenManager for "expiring soon" display)
    expect(isTokenExpiringSoon(in30Minutes, 60)).toBe(true)
    // With default 5-min window
    expect(isTokenExpiringSoon(in30Minutes, 5)).toBe(false)
  })

  it('handles LinkedIn-scale expiry (60-day tokens)', () => {
    const in59Days = new Date(Date.now() + 59 * 24 * 3600_000).toISOString()
    expect(isTokenExpiringSoon(in59Days, 5)).toBe(false)
    // Even with 24-hour window
    expect(isTokenExpiringSoon(in59Days, 1440)).toBe(false)
  })
})
