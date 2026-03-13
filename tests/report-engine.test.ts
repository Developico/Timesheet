import { describe, it, expect } from 'vitest'
import { aggregateReport } from '@/lib/report-engine'
import type { TimeEntry, Project, Consultant } from '@/types'
import type { ReportParams } from '@/types/reports'
import { groupTaskDetails } from '@/types/reports'

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    date: '2024-03-01',
    consultantId: 'c1',
    projectId: 'p1',
    hours: 8,
    billable: true,
    ...overrides,
  }
}

const projects: Project[] = [
  { id: 'p1', code: 'PRJ1', name: 'Alpha', client: 'Acme', color: '#000', billable: true, assigned: true },
  { id: 'p2', code: 'PRJ2', name: 'Beta', client: 'Globex', color: '#111', billable: false, assigned: true },
]

const consultants: Consultant[] = [
  { id: 'c1', name: 'Alice' },
  { id: 'c2', name: 'Bob' },
]

const baseParams: ReportParams = {
  dateFrom: '2024-03-01',
  dateTo: '2024-03-31',
  groupBy: 'consultant',
}

describe('aggregateReport', () => {
  it('groups by consultant and sums hours', () => {
    const entries = [
      entry({ id: 'e1', consultantId: 'c1', hours: 8 }),
      entry({ id: 'e2', consultantId: 'c1', hours: 4 }),
      entry({ id: 'e3', consultantId: 'c2', hours: 6 }),
    ]
    const result = aggregateReport(entries, projects, consultants, baseParams)

    expect(result.rows).toHaveLength(2)
    // Sorted descending by totalHours
    expect(result.rows[0].groupLabel).toBe('Alice')
    expect(result.rows[0].totalHours).toBe(12)
    expect(result.rows[1].groupLabel).toBe('Bob')
    expect(result.rows[1].totalHours).toBe(6)
    expect(result.summary.totalHours).toBe(18)
  })

  it('groups by project', () => {
    const entries = [
      entry({ id: 'e1', projectId: 'p1', hours: 5 }),
      entry({ id: 'e2', projectId: 'p2', hours: 3 }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, groupBy: 'project' })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].groupLabel).toBe('PRJ1 — Alpha')
    expect(result.rows[0].totalHours).toBe(5)
    expect(result.rows[1].groupLabel).toBe('PRJ2 — Beta')
  })

  it('groups by client', () => {
    const entries = [
      entry({ id: 'e1', projectId: 'p1', hours: 4 }),
      entry({ id: 'e2', projectId: 'p2', hours: 6 }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, groupBy: 'client' })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].groupLabel).toBe('Globex')
    expect(result.rows[0].totalHours).toBe(6)
    expect(result.rows[1].groupLabel).toBe('Acme')
    expect(result.rows[1].totalHours).toBe(4)
  })

  it('filters billable only', () => {
    const entries = [
      entry({ id: 'e1', hours: 8, billable: true }),
      entry({ id: 'e2', hours: 4, billable: false }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, billable: 'billable' })

    expect(result.summary.totalHours).toBe(8)
    expect(result.summary.billableHours).toBe(8)
    expect(result.summary.nonBillableHours).toBe(0)
  })

  it('filters non-billable only', () => {
    const entries = [
      entry({ id: 'e1', hours: 8, billable: true }),
      entry({ id: 'e2', hours: 4, billable: false }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, billable: 'non-billable' })

    expect(result.summary.totalHours).toBe(4)
    expect(result.summary.billableHours).toBe(0)
  })

  it('filters by projectIds', () => {
    const entries = [
      entry({ id: 'e1', projectId: 'p1', hours: 5 }),
      entry({ id: 'e2', projectId: 'p2', hours: 3 }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, projectIds: ['p1'] })

    expect(result.summary.totalHours).toBe(5)
    expect(result.summary.uniqueProjects).toBe(1)
  })

  it('filters by consultantIds', () => {
    const entries = [
      entry({ id: 'e1', consultantId: 'c1', hours: 8 }),
      entry({ id: 'e2', consultantId: 'c2', hours: 4 }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, consultantIds: ['c2'] })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].groupLabel).toBe('Bob')
    expect(result.summary.totalHours).toBe(4)
  })

  it('computes billable percentage correctly', () => {
    const entries = [
      entry({ id: 'e1', hours: 6, billable: true }),
      entry({ id: 'e2', hours: 4, billable: false }),
    ]
    const result = aggregateReport(entries, projects, consultants, baseParams)

    expect(result.summary.billablePercentage).toBe(60)
    expect(result.rows[0].billablePercentage).toBe(60)
  })

  it('returns empty rows for no data', () => {
    const result = aggregateReport([], projects, consultants, baseParams)

    expect(result.rows).toEqual([])
    expect(result.summary.totalHours).toBe(0)
    expect(result.summary.billablePercentage).toBe(0)
  })

  it('includes params and generatedAt in result', () => {
    const result = aggregateReport([], projects, consultants, baseParams)

    expect(result.params).toEqual(baseParams)
    expect(result.generatedAt).toBeTruthy()
  })

  it('includes taskDetails when includeTasks is true', () => {
    const entries = [
      entry({ id: 'e1', consultantId: 'c1', hours: 8, task: 'Development', date: '2024-03-01' }),
      entry({ id: 'e2', consultantId: 'c1', hours: 4, task: 'Code review', date: '2024-03-02' }),
      entry({ id: 'e3', consultantId: 'c2', hours: 6, task: 'Testing', date: '2024-03-01' }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, includeTasks: true })

    expect(result.rows).toHaveLength(2)
    // Alice row (12h total) comes first
    const aliceRow = result.rows[0]
    expect(aliceRow.taskDetails).toHaveLength(2)
    // Sorted by date then task
    expect(aliceRow.taskDetails![0].task).toBe('Development')
    expect(aliceRow.taskDetails![0].date).toBe('2024-03-01')
    expect(aliceRow.taskDetails![1].task).toBe('Code review')
    expect(aliceRow.taskDetails![1].date).toBe('2024-03-02')

    const bobRow = result.rows[1]
    expect(bobRow.taskDetails).toHaveLength(1)
    expect(bobRow.taskDetails![0].task).toBe('Testing')
    expect(bobRow.taskDetails![0].consultantName).toBe('Bob')
  })

  it('omits taskDetails when includeTasks is false or undefined', () => {
    const entries = [
      entry({ id: 'e1', consultantId: 'c1', hours: 8, task: 'Development' }),
    ]
    const result = aggregateReport(entries, projects, consultants, baseParams)

    expect(result.rows[0].taskDetails).toBeUndefined()
  })

  it('uses "(no task)" for entries without task field', () => {
    const entries = [
      entry({ id: 'e1', consultantId: 'c1', hours: 8 }),
    ]
    const result = aggregateReport(entries, projects, consultants, { ...baseParams, includeTasks: true })

    expect(result.rows[0].taskDetails![0].task).toBe('(no task)')
  })
})

describe('groupTaskDetails', () => {
  it('aggregates entries by task name', () => {
    const details = [
      { task: 'Development', date: '2024-03-01', consultantName: 'Alice', hours: 4, billable: true },
      { task: 'Development', date: '2024-03-02', consultantName: 'Alice', hours: 6, billable: true },
      { task: 'Meetings', date: '2024-03-01', consultantName: 'Alice', hours: 2, billable: false },
    ]
    const grouped = groupTaskDetails(details)

    expect(grouped).toHaveLength(2)
    // Sorted by totalHours descending
    expect(grouped[0].task).toBe('Development')
    expect(grouped[0].totalHours).toBe(10)
    expect(grouped[0].billableHours).toBe(10)
    expect(grouped[0].nonBillableHours).toBe(0)
    expect(grouped[0].entryCount).toBe(2)

    expect(grouped[1].task).toBe('Meetings')
    expect(grouped[1].totalHours).toBe(2)
    expect(grouped[1].billableHours).toBe(0)
    expect(grouped[1].nonBillableHours).toBe(2)
    expect(grouped[1].entryCount).toBe(1)
  })

  it('returns empty array for empty input', () => {
    expect(groupTaskDetails([])).toEqual([])
  })

  it('handles mixed billable/non-billable for same task', () => {
    const details = [
      { task: 'Review', date: '2024-03-01', consultantName: 'Alice', hours: 3, billable: true },
      { task: 'Review', date: '2024-03-02', consultantName: 'Bob', hours: 2, billable: false },
    ]
    const grouped = groupTaskDetails(details)

    expect(grouped).toHaveLength(1)
    expect(grouped[0].totalHours).toBe(5)
    expect(grouped[0].billableHours).toBe(3)
    expect(grouped[0].nonBillableHours).toBe(2)
    expect(grouped[0].entryCount).toBe(2)
  })
})
