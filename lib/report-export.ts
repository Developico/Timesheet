import type { ReportResult } from '@/types/reports'
import { groupTaskDetails } from '@/types/reports'

const BOM = '\uFEFF'

export interface ExportOptions {
  groupTasks?: boolean
}

/**
 * Generate a CSV string from a ReportResult.
 * Includes UTF-8 BOM for correct display of Polish characters in Excel.
 */
export function generateCSV(result: ReportResult, options: ExportOptions = {}): string {
  const { params, rows, summary } = result
  const lines: string[] = []

  // Metadata header
  lines.push(`# Report: Hours by ${capitalize(params.groupBy)}`)
  lines.push(`# Period: ${params.dateFrom} - ${params.dateTo}`)
  lines.push(`# Generated: ${result.generatedAt}`)
  lines.push(`# Billable filter: ${params.billable ?? 'all'}`)
  lines.push('')

  // Column headers
  const headers = [
    params.groupBy === 'consultant' ? 'Consultant' : params.groupBy === 'project' ? 'Project' : 'Client',
    'Total Hours',
    'Billable Hours',
    'Non-billable Hours',
    'Billable %',
    'Entries',
  ]
  lines.push(headers.map(csvEscape).join(','))

  // Data rows (with optional task details)
  for (const row of rows) {
    lines.push(
      [
        row.groupLabel,
        row.totalHours.toString(),
        row.billableHours.toString(),
        row.nonBillableHours.toString(),
        `${row.billablePercentage}%`,
        row.entryCount.toString(),
      ]
        .map(csvEscape)
        .join(','),
    )

    if (row.taskDetails && row.taskDetails.length > 0) {
      if (options.groupTasks) {
        for (const gs of groupTaskDetails(row.taskDetails)) {
          lines.push(
            [
              `  ${gs.task}`,
              gs.totalHours.toString(),
              gs.billableHours.toString(),
              gs.nonBillableHours.toString(),
              gs.totalHours > 0 ? `${Math.round((gs.billableHours / gs.totalHours) * 100)}%` : '',
              gs.entryCount.toString(),
            ]
              .map(csvEscape)
              .join(','),
          )
        }
      } else {
        for (const td of row.taskDetails) {
          lines.push(
            [
              `  ${td.task}`,
              td.hours.toString(),
              td.billable ? td.hours.toString() : '0',
              td.billable ? '0' : td.hours.toString(),
              '',
              '',
              td.date,
              td.consultantName,
            ]
              .map(csvEscape)
              .join(','),
          )
        }
      }
    }
  }

  // Summary row
  lines.push('')
  lines.push(
    [
      'TOTAL',
      summary.totalHours.toString(),
      summary.billableHours.toString(),
      summary.nonBillableHours.toString(),
      `${summary.billablePercentage}%`,
      '',
    ]
      .map(csvEscape)
      .join(','),
  )

  return BOM + lines.join('\r\n') + '\r\n'
}

/**
 * Trigger a file download in the browser from a string or ArrayBuffer.
 */
export function downloadBlob(data: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Build a filename for report exports.
 */
export function reportFilename(result: ReportResult, ext: string): string {
  return `tt-report-${result.params.groupBy}-${result.params.dateFrom}-${result.params.dateTo}.${ext}`
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
