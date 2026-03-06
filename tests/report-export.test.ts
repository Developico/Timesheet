import { describe, it, expect } from 'vitest'
import { generateCSV, reportFilename } from '@/lib/report-export'
import type { ReportResult } from '@/types/reports'

function makeResult(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    params: { dateFrom: '2024-03-01', dateTo: '2024-03-31', groupBy: 'consultant' },
    rows: [
      {
        groupKey: 'c1',
        groupLabel: 'Alice',
        totalHours: 120,
        billableHours: 100,
        nonBillableHours: 20,
        billablePercentage: 83.33,
        entryCount: 15,
      },
    ],
    summary: {
      totalHours: 120,
      billableHours: 100,
      nonBillableHours: 20,
      billablePercentage: 83.33,
      uniqueProjects: 3,
      uniqueConsultants: 1,
    },
    generatedAt: '2024-04-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('generateCSV', () => {
  it('starts with UTF-8 BOM', () => {
    const csv = generateCSV(makeResult())
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })

  it('includes metadata header lines', () => {
    const csv = generateCSV(makeResult())
    expect(csv).toContain('# Report: Hours by Consultant')
    expect(csv).toContain('# Period: 2024-03-01 - 2024-03-31')
  })

  it('includes column headers', () => {
    const csv = generateCSV(makeResult())
    expect(csv).toContain('Consultant,Total Hours,Billable Hours,Non-billable Hours,Billable %,Entries')
  })

  it('includes data rows', () => {
    const csv = generateCSV(makeResult())
    expect(csv).toContain('Alice,120,100,20,83.33%,15')
  })

  it('includes TOTAL summary row', () => {
    const csv = generateCSV(makeResult())
    expect(csv).toContain('TOTAL,120,100,20,83.33%,')
  })

  it('uses Project header when groupBy=project', () => {
    const csv = generateCSV(makeResult({
      params: { dateFrom: '2024-03-01', dateTo: '2024-03-31', groupBy: 'project' },
    }))
    expect(csv).toContain('Project,')
  })

  it('uses Client header when groupBy=client', () => {
    const csv = generateCSV(makeResult({
      params: { dateFrom: '2024-03-01', dateTo: '2024-03-31', groupBy: 'client' },
    }))
    expect(csv).toContain('Client,')
  })
})

describe('reportFilename', () => {
  it('generates filename with groupBy and date range', () => {
    const name = reportFilename(makeResult(), 'csv')
    expect(name).toBe('tt-report-consultant-2024-03-01-2024-03-31.csv')
  })

  it('works with different extensions', () => {
    const name = reportFilename(makeResult(), 'pdf')
    expect(name).toBe('tt-report-consultant-2024-03-01-2024-03-31.pdf')
  })
})
