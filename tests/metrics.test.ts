import { describe, it, expect } from 'vitest'
import { getWorkingDays, calculateKPIMetrics, calculateProjectMetrics } from '@/lib/metrics'
import type { TimeEntry } from '@/types'

describe('getWorkingDays', () => {
  it('counts weekdays in a full week (Mon-Sun)', () => {
    // 2024-01-01 (Mon) to 2024-01-07 (Sun) = 5 working days
    expect(getWorkingDays('2024-01-01', '2024-01-07')).toBe(5)
  })

  it('returns 0 for weekend only', () => {
    // 2024-01-06 (Sat) to 2024-01-07 (Sun)
    expect(getWorkingDays('2024-01-06', '2024-01-07')).toBe(0)
  })

  it('counts a single weekday', () => {
    expect(getWorkingDays('2024-01-01', '2024-01-01')).toBe(1)
  })

  it('counts two weeks correctly', () => {
    // 2024-01-01 (Mon) to 2024-01-14 (Sun) = 10 working days
    expect(getWorkingDays('2024-01-01', '2024-01-14')).toBe(10)
  })
})

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
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

describe('calculateKPIMetrics', () => {
  it('computes correct metrics for simple case', () => {
    const entries = [
      makeEntry({ hours: 8, billable: true }),
      makeEntry({ id: 'e2', hours: 4, billable: false }),
    ]
    const kpi = calculateKPIMetrics(entries, '2024-01-01', '2024-01-01')
    expect(kpi.reportedHours).toBe(12)
    expect(kpi.requiredHours).toBe(8)
    expect(kpi.billableHours).toBe(8)
    expect(kpi.realizedPercentage).toBe(150)
    expect(kpi.activeProjects).toBe(1)
  })

  it('handles zero entries', () => {
    const kpi = calculateKPIMetrics([], '2024-01-01', '2024-01-05')
    expect(kpi.reportedHours).toBe(0)
    expect(kpi.requiredHours).toBe(40)
    expect(kpi.realizedPercentage).toBe(0)
    expect(kpi.billablePercentage).toBe(0)
  })
})

describe('calculateProjectMetrics', () => {
  const projects = [
    { id: 'p1', name: 'Project A', code: 'PA', color: '#ff0000' },
    { id: 'p2', name: 'Project B', code: 'PB', color: '#00ff00' },
  ]

  it('groups hours by project', () => {
    const entries = [
      makeEntry({ projectId: 'p1', hours: 6 }),
      makeEntry({ id: 'e2', projectId: 'p1', hours: 2 }),
      makeEntry({ id: 'e3', projectId: 'p2', hours: 4 }),
    ]
    const metrics = calculateProjectMetrics(entries, projects)
    expect(metrics).toHaveLength(2)
    expect(metrics[0].projectId).toBe('p1')
    expect(metrics[0].totalHours).toBe(8)
    expect(metrics[1].projectId).toBe('p2')
    expect(metrics[1].totalHours).toBe(4)
  })

  it('creates "Other" bucket when more than topN projects', () => {
    const manyProjects = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, code: `C${i}`, color: '#000',
    }))
    const entries = manyProjects.map((p, i) =>
      makeEntry({ id: `e${i}`, projectId: p.id, hours: 10 - i }),
    )
    const metrics = calculateProjectMetrics(entries, manyProjects, 5)
    expect(metrics).toHaveLength(6) // 5 + Other
    expect(metrics[metrics.length - 1].projectCode).toBe('OTHER')
  })
})
