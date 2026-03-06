import { describe, it, expect } from 'vitest'
import { isAbsenceProject, summarize, formatHours, round2, toPercent } from '@/lib/time-entries-summary'
import type { TimeEntry } from '@/types'

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    date: '2024-01-01',
    consultantId: 'c1',
    projectId: 'p1',
    hours: 8,
    billable: true,
    ...overrides,
  }
}

describe('isAbsenceProject', () => {
  it('detects Office.Absences by id', () => {
    expect(isAbsenceProject('Office.Absences')).toBe(true)
  })

  it('detects abs code', () => {
    expect(isAbsenceProject('some-id', 'ABS')).toBe(true)
  })

  it('detects vacation in name', () => {
    expect(isAbsenceProject('x', 'X', 'Annual Vacation')).toBe(true)
  })

  it('detects urlop (Polish) in name', () => {
    expect(isAbsenceProject('x', 'X', 'Urlop wypoczynkowy')).toBe(true)
  })

  it('returns false for normal projects', () => {
    expect(isAbsenceProject('p1', 'DEV', 'Development')).toBe(false)
  })
})

describe('summarize', () => {
  it('sums billable and non-billable hours', () => {
    const entries = [
      entry({ hours: 4, billable: true }),
      entry({ id: 'e2', hours: 2, billable: false }),
    ]
    const result = summarize(entries)
    expect(result.total).toBe(6)
    expect(result.billable).toBe(4)
    expect(result.nonBillable).toBe(2)
  })

  it('returns zeroes for empty array', () => {
    const result = summarize([])
    expect(result.total).toBe(0)
    expect(result.billable).toBe(0)
    expect(result.nonBillable).toBe(0)
    expect(result.absence).toBe(0)
  })
})

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    // 1.005 * 100 = 100.4999… in IEEE 754 → rounds down to 1.00
    expect(round2(1.005)).toBe(1)
    expect(round2(1.555)).toBe(1.56)
    expect(round2(3)).toBe(3)
  })
})

describe('toPercent', () => {
  it('returns percentage with one decimal', () => {
    expect(toPercent(1, 3)).toBeCloseTo(33.3, 0)
  })

  it('returns 0 when denominator is 0', () => {
    expect(toPercent(5, 0)).toBe(0)
  })
})

describe('formatHours', () => {
  it('formats integer hours without decimals', () => {
    expect(formatHours(8)).toBe('8h')
  })

  it('formats fractional hours with 2 decimals', () => {
    expect(formatHours(4.5)).toBe('4.50h')
  })
})
