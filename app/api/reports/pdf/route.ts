import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth-guard'
import { apiError } from '@/lib/api-response'
import type { ReportResult } from '@/types/reports'

/**
 * POST /api/reports/pdf
 * Accepts a ReportResult JSON body and returns a PDF binary.
 * Uses basic HTML → PDF generation without heavy dependencies.
 */
export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth

  // 2. Admin guard
  const role = typeof auth.token['role'] === 'string' ? auth.token['role'] : ''
  if (role !== 'Administrator') {
    return apiError(403, 'Forbidden', { code: 'ADMIN_REQUIRED' })
  }

  // 3. Parse body
  let result: ReportResult
  try {
    result = await req.json()
  } catch {
    return apiError(400, 'Invalid JSON body', { code: 'INVALID_BODY' })
  }

  if (!result?.params || !result?.rows || !result?.summary) {
    return apiError(400, 'Missing required report fields (params, rows, summary)', {
      code: 'VALIDATION_FAILED',
    })
  }

  // 4. Generate PDF HTML
  const html = buildReportHTML(result)

  // Return HTML that the client will print to PDF via window.print()
  // This avoids heavy server-side PDF dependencies while still providing
  // a printable, well-formatted document.
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildReportHTML(result: ReportResult): string {
  const { params, rows, summary } = result
  const groupLabel = capitalize(params.groupBy)

  const tableRows = rows
    .map(
      r => `
    <tr>
      <td>${escapeHtml(r.groupLabel)}</td>
      <td class="num">${r.totalHours}</td>
      <td class="num">${r.billableHours}</td>
      <td class="num">${r.nonBillableHours}</td>
      <td class="num">${r.billablePercentage}%</td>
      <td class="num">${r.entryCount}</td>
    </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Time Report — ${escapeHtml(groupLabel)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11pt; color: #1a1a1a; padding: 40px; }
  h1 { font-size: 18pt; margin-bottom: 4px; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 20px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; min-width: 140px; }
  .summary-card .label { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 16pt; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
  th { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; color: #555; background: #f9f9f9; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; border-top: 2px solid #333; }
  .footer { margin-top: 32px; font-size: 8pt; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<h1>Developico Timesheet — Report</h1>
<div class="meta">
  Hours by ${escapeHtml(groupLabel)} &middot;
  Period: ${escapeHtml(params.dateFrom)} — ${escapeHtml(params.dateTo)} &middot;
  Generated: ${escapeHtml(new Date(result.generatedAt).toLocaleString('en-GB'))} &middot;
  Filter: ${escapeHtml(params.billable ?? 'all')}
</div>

<div class="summary">
  <div class="summary-card"><div class="label">Total Hours</div><div class="value">${summary.totalHours}</div></div>
  <div class="summary-card"><div class="label">Billable Hours</div><div class="value">${summary.billableHours}</div></div>
  <div class="summary-card"><div class="label">Billable %</div><div class="value">${summary.billablePercentage}%</div></div>
  <div class="summary-card"><div class="label">Projects</div><div class="value">${summary.uniqueProjects}</div></div>
  <div class="summary-card"><div class="label">Consultants</div><div class="value">${summary.uniqueConsultants}</div></div>
</div>

<table>
<thead>
  <tr>
    <th>${escapeHtml(groupLabel)}</th>
    <th class="num">Total Hours</th>
    <th class="num">Billable</th>
    <th class="num">Non-billable</th>
    <th class="num">Billable %</th>
    <th class="num">Entries</th>
  </tr>
</thead>
<tbody>
  ${tableRows}
</tbody>
<tfoot>
  <tr>
    <td>TOTAL</td>
    <td class="num">${summary.totalHours}</td>
    <td class="num">${summary.billableHours}</td>
    <td class="num">${summary.nonBillableHours}</td>
    <td class="num">${summary.billablePercentage}%</td>
    <td class="num"></td>
  </tr>
</tfoot>
</table>

<div class="footer">Developico · Confidential</div>

<script class="no-print">
  window.onload = function() { window.print(); };
</script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
