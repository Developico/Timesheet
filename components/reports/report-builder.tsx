"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, FolderKanban, BarChart3, Receipt, FileBarChart, Loader2 } from "lucide-react"
import { REPORT_PRESETS } from "@/lib/report-presets"
import { ReportPreview } from "./report-preview"
import { ExportBar } from "./export-bar"
import type { ReportParams, ReportResult } from "@/types/reports"

interface ReportBuilderProps {
  projects: { id: string; code: string; name: string }[]
  consultants: { id: string; name: string }[]
}

const ICON_MAP: Record<string, React.ElementType> = {
  Users, FolderKanban, BarChart3, Receipt,
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultDateFrom(): string {
  const now = new Date()
  return fmt(new Date(now.getFullYear(), now.getMonth(), 1))
}
function defaultDateTo(): string {
  const now = new Date()
  return fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

export function ReportBuilder({ projects, consultants }: ReportBuilderProps) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [groupBy, setGroupBy] = useState<ReportParams['groupBy']>('consultant')
  const [billable, setBillable] = useState<'all' | 'billable' | 'non-billable'>('all')
  const [selectedProjects, setSelectedProjects] = useState<string>('all')
  const [selectedConsultants, setSelectedConsultants] = useState<string>('all')
  const [result, setResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (overrideParams?: Partial<ReportParams>) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const params = new URLSearchParams()
      params.set('dateFrom', overrideParams?.dateFrom ?? dateFrom)
      params.set('dateTo', overrideParams?.dateTo ?? dateTo)
      params.set('groupBy', overrideParams?.groupBy ?? groupBy)
      params.set('billable', overrideParams?.billable ?? billable)
      if (!overrideParams) {
        if (selectedProjects !== 'all') params.set('projectIds', selectedProjects)
        if (selectedConsultants !== 'all') params.set('consultantIds', selectedConsultants)
      }
      if (overrideParams?.projectIds) params.set('projectIds', overrideParams.projectIds.join(','))
      if (overrideParams?.consultantIds) params.set('consultantIds', overrideParams.consultantIds.join(','))

      const res = await fetch(`/api/reports/data?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setResult(json.value as ReportResult)

      // If we used a preset, sync the form fields
      if (overrideParams) {
        if (overrideParams.dateFrom) setDateFrom(overrideParams.dateFrom)
        if (overrideParams.dateTo) setDateTo(overrideParams.dateTo)
        if (overrideParams.groupBy) setGroupBy(overrideParams.groupBy)
        if (overrideParams.billable) setBillable(overrideParams.billable)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, groupBy, billable, selectedProjects, selectedConsultants])

  const handlePreset = (presetId: string) => {
    const preset = REPORT_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    const params = preset.getParams()
    generate(params as Partial<ReportParams>)
  }

  return (
    <div className="space-y-6 mobile-px">
      {/* Quick Reports */}
      <div>
       {/* <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Reports</h3> */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {REPORT_PRESETS.map(preset => {
            const Icon = ICON_MAP[preset.icon] ?? FileBarChart
            return (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset.id)}
                disabled={loading}
                className="flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 hover:border-[#01EED4]/50 disabled:opacity-50"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{preset.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom Report Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date From */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {/* Date To */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {/* Group By */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Group By</label>
              <Select value={groupBy} onValueChange={v => setGroupBy(v as ReportParams['groupBy'])}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultant">Consultant</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Billable */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Billable</label>
              <Select value={billable} onValueChange={v => setBillable(v as 'all' | 'billable' | 'non-billable')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="billable">Billable only</SelectItem>
                  <SelectItem value="non-billable">Non-billable only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Projects */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              <Select value={selectedProjects} onValueChange={setSelectedProjects}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Consultants */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Consultant</label>
              <Select value={selectedConsultants} onValueChange={setSelectedConsultants}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All consultants</SelectItem>
                  {consultants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={() => generate()}
              disabled={loading}
              className="bg-[#01EED4] text-gray-900 hover:bg-[#01EED4]/85 dark:bg-[#01EED4] dark:text-gray-900 dark:hover:bg-[#01EED4]/85 font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          <ExportBar result={result} />
          <ReportPreview result={result} />
        </>
      )}
    </div>
  )
}
