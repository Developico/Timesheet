"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import type { ReportResult } from "@/types/reports"
import { groupTaskDetails } from "@/types/reports"

const BAR_COLORS = ['#6eedd9', '#174076', '#e03768', '#f59e0b', '#8b5cf6', '#22c55e', '#ec4899', '#06b6d4']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ReportPreview({ result, groupTasks = false }: { result: ReportResult; groupTasks?: boolean }) {
  const { params, rows, summary } = result
  const groupLabel = capitalize(params.groupBy)
  const hasTasks = rows.some(r => r.taskDetails && r.taskDetails.length > 0)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleRow = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(rows.filter(r => r.taskDetails?.length).map(r => r.groupKey)))
  }, [rows])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="Total Hours" value={String(summary.totalHours)} accent />
        <SummaryCard label="Billable Hours" value={String(summary.billableHours)} color="#6eedd9" />
        <SummaryCard label="Billable %" value={`${summary.billablePercentage}%`} color="#6eedd9" />
        <SummaryCard label="Projects" value={String(summary.uniqueProjects)} />
        <SummaryCard label="Consultants" value={String(summary.uniqueConsultants)} />
      </div>

      {/* Horizontal bar chart */}
      {rows.length > 0 && <HoursBarChart rows={rows} maxHours={rows[0]?.totalHours ?? 0} groupLabel={groupLabel} />}

      {/* Data table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Hours by {groupLabel}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {params.dateFrom} — {params.dateTo}
              </span>
            </CardTitle>
            {hasTasks && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 px-2 text-xs">
                  <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 px-2 text-xs">
                  <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
                  Collapse All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6">No data found for the selected filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {hasTasks && <TableHead className="w-8" />}
                  <TableHead>{groupLabel}</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Non-billable</TableHead>
                  <TableHead className="text-right">Billable %</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const isExpanded = expanded.has(row.groupKey)
                  const hasDetails = row.taskDetails && row.taskDetails.length > 0
                  return (
                    <>
                      <TableRow
                        key={row.groupKey}
                        className={hasDetails ? "cursor-pointer hover:bg-muted/50" : undefined}
                        onClick={hasDetails ? () => toggleRow(row.groupKey) : undefined}
                      >
                        {hasTasks && (
                          <TableCell className="w-8 px-2">
                            {hasDetails && (
                              isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{row.groupLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.totalHours}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.billableHours}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.nonBillableHours}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.billablePercentage}%</TableCell>
                        <TableCell className="text-right tabular-nums">{row.entryCount}</TableCell>
                      </TableRow>
                      {isExpanded && hasDetails && groupTasks && (
                        groupTaskDetails(row.taskDetails!).map((gs, i) => (
                          <TableRow key={`${row.groupKey}-grp-${i}`} className="bg-muted/30">
                            {hasTasks && <TableCell />}
                            <TableCell className="pl-8 text-xs">
                              <span className="font-medium text-foreground">{gs.task}</span>
                              <span className="ml-2 text-muted-foreground">({gs.entryCount} {gs.entryCount === 1 ? 'entry' : 'entries'})</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs font-medium">{gs.totalHours}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{gs.billableHours}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{gs.nonBillableHours}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {gs.totalHours > 0 ? `${Math.round((gs.billableHours / gs.totalHours) * 100)}%` : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{gs.entryCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {isExpanded && hasDetails && !groupTasks && row.taskDetails?.map((td, i) => (
                        <TableRow key={`${row.groupKey}-task-${i}`} className="bg-muted/30">
                          {hasTasks && <TableCell />}
                          <TableCell className="pl-8 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{td.task}</span>
                            <span className="ml-2">{td.date}</span>
                            <span className="ml-2">· {td.consultantName}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{td.hours}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{td.billable ? td.hours : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{td.billable ? '—' : td.hours}</TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      ))}
                    </>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  {hasTasks && <TableCell />}
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{summary.totalHours}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{summary.billableHours}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{summary.nonBillableHours}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{summary.billablePercentage}%</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HoursBarChart({ rows, maxHours, groupLabel }: { rows: ReportResult['rows']; maxHours: number; groupLabel: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t) }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hours Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row, i) => {
          const pct = maxHours > 0 ? (row.totalHours / maxHours) * 100 : 0
          const color = BAR_COLORS[i % BAR_COLORS.length]
          const billablePct = row.totalHours > 0 ? (row.billableHours / row.totalHours) * 100 : 0
          return (
            <div key={row.groupKey} className={`space-y-1.5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium">{row.groupLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs text-muted-foreground">{row.billableHours}h billable</span>
                  <span className="text-sm font-semibold tabular-nums">{row.totalHours}h</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: visible ? `${pct}%` : '0%',
                    background: `linear-gradient(90deg, ${color} ${billablePct}%, ${color}55 ${billablePct}%)`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function SummaryCard({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <Card className={`py-4 ${accent ? 'border-[#01EED4]/40 dark:border-[#01EED4]/30' : ''}`}>
      <CardContent className="px-4 py-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold tabular-nums mt-1" style={color ? { color } : undefined}>{value}</p>
      </CardContent>
    </Card>
  )
}
