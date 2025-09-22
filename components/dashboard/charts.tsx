"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { useFilters } from "@/lib/filter-context"
import { useConsultants, type BasicConsultant } from "@/hooks/use-consultants"
import { useAuth } from "@/lib/auth-client"
import { useViewingScope } from "@/lib/viewing-scope"
import { useDaysOff } from "@/hooks/use-days-off"
import { format, addDays } from "date-fns"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { computeBarGeometry } from "@/lib/chart-geometry"
import { formatHours, round2 } from "@/lib/time-entries-summary"

function useAnimatedCounter(end: number, duration = 1000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (duration === 0) {
      setCount(end)
      return
    }
    
    let startTime: number | undefined
    let raf = 0
    const animate = (now: number) => {
      if (startTime === undefined) startTime = now
      const p = Math.min((now - startTime) / duration, 1)
      // Preserve fractional part for accurate hour display
      setCount(p * end)
      if (p < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [end, duration])

  return count
}

export function ActiveProjectsCard() {
  const { filteredTimeEntries, filters, filteredProjects } = useFilters()
  const { consultants } = useConsultants()
  const { user } = useAuth()
  const { consultantId: scopedConsultant } = useViewingScope()

  // Determine primary consultant like Calendar
  const primaryConsultantId = useMemo(()=>{
    if(!consultants?.length) return null as string | null
    if(user?.email){
      const lower = user.email.toLowerCase()
      const found = consultants.find(c=> c.email?.toLowerCase() === lower)
      if(found) return found.id
    }
    return consultants[0]?.id ?? null
  }, [consultants, user?.email])

  // Scope entries: ViewingScope overrides, else current user; else all
  const entriesForCard = useMemo(()=>{
    if(scopedConsultant){ return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant) }
    if(primaryConsultantId){ return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId) }
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])

  // Aggregate hours by project within range
  const projectHours = useMemo(()=>{
    const acc: Record<string, number> = {}
    for(const e of entriesForCard){ acc[e.projectId] = (acc[e.projectId] || 0) + e.hours }
    return acc
  }, [entriesForCard])

  const totalHours = useMemo(()=> Object.values(projectHours).reduce((s,h)=>s+h,0), [projectHours])

  const sortedAll = useMemo(() => Object.entries(projectHours).sort(([,a],[,b])=> b-a), [projectHours])
  const topN = Math.max(filters.topN, 5)
  const sortedProjects = useMemo(()=> sortedAll.slice(0, topN), [sortedAll, topN])
  const others = useMemo(()=> sortedAll.slice(topN), [sortedAll, topN])

  // Utility: resolve project meta
  const getProject = useCallback((id: string) => filteredProjects.find(p=> p.id === id), [filteredProjects])
  const getBarColor = useCallback((id: string) => {
    const p = getProject(id)
    const codeLc = (p?.code || '').toLowerCase()
    const nameLc = (p?.name || '').toLowerCase()
    const isAbs = id === 'Office.Absences' || codeLc === 'office.absences' || codeLc === 'abs' || codeLc.includes('absence') ||
      nameLc.includes('absence') || nameLc.includes('urlop') || nameLc.includes('vacation') || nameLc.includes('holiday') || nameLc.includes('leave')
    if(isAbs) return '#e03768'
  return p?.billable ? '#6eedd9' : '#174076'
  }, [getProject])

  const [isVisible, setIsVisible] = useState(false)
  useEffect(()=>{ const t=setTimeout(()=>setIsVisible(true),100); return ()=>clearTimeout(t); },[])

  // Local panel state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const selectedProjectRaw = useMemo(() => filteredProjects.find(p => p.id === selectedProjectId), [filteredProjects, selectedProjectId])
  const selectedProject = useMemo(()=>{
    if(!selectedProjectRaw) return undefined
    return {
      id: selectedProjectRaw.id,
      code: selectedProjectRaw.code,
      name: selectedProjectRaw.name,
  color: selectedProjectRaw.color || '#174076',
      billable: selectedProjectRaw.billable ?? true,
      client: selectedProjectRaw.client || '',
      note: selectedProjectRaw.note,
      assigned: selectedProjectRaw.assigned ?? false,
    }
  }, [selectedProjectRaw])
  const scopeLabel = useMemo(() => {
    const dr = filters?.dateRange || 'this-week'
    const labelMap: Record<string, string> = {
      'this-week': 'this week',
      'previous-week': 'previous week',
      'this-month': 'this month',
      'previous-month': 'previous month',
      'last-month': 'last month',
      'this-quarter': 'this quarter',
      'previous-quarter': 'previous quarter',
      'this-year': 'this year',
      'previous-year': 'previous year',
      'custom': 'custom range',
    }
    return labelMap[dr] || 'current range'
  }, [filters?.dateRange])

  // (Geometry helper imported from lib/chart-geometry)

  // Unified dynamic CSS for ActiveProjectsCard + HoursSummaryChart (reduces <style> tags)
  const dynamicCss = useMemo(() => {
    const lines: string[] = []
    // Active projects bar animations & colors
    sortedProjects.forEach(([projectId, hours], index) => {
      const percent = totalHours > 0 ? Math.round((hours / totalHours) * 1000) / 10 : 0
      const color = getBarColor(projectId)
      lines.push(`#active-projects-list [data-bar="${projectId}"] .bar-fill{background:${color};width:${percent}%;transition-delay:${index * 120 + 300}ms}`)
      lines.push(`#active-projects-list [data-bar="${projectId}"]{transition-delay:${index * 120 + 150}ms}`)
    })
    if (others.length) {
      const hours = others.reduce((s, [, h]) => s + h, 0)
      const percent = totalHours > 0 ? Math.round((hours / totalHours) * 1000) / 10 : 0
      const index = sortedProjects.length
      lines.push(`#active-projects-list [data-bar="__other__"] .bar-fill{background:#9CA3AF;width:${percent}%;transition-delay:${index * 120 + 300}ms}`)
      lines.push(`#active-projects-list [data-bar="__other__"]{transition-delay:${index * 120 + 150}ms}`)
    }
    return lines.join('\n')
  }, [sortedProjects, others, totalHours, getBarColor])
  useAggregatedDynamicCss('charts-active-projects', dynamicCss)

  return (
    <>
    {/* On large screens this card will take 1/2 or 1/3 width depending on parent grid; Hours Summary will span more columns */}
  <Card id="active-projects-list" className={`h-full relative overflow-hidden hover:shadow-xl transition-all duration-500 border-0 shadow-sm bg-[var(--surface)] dark:bg-[var(--card)] ${isVisible? 'opacity-100 translate-y-0':'opacity-0 translate-y-[18px]'}`}
      data-dashboard-card data-type="active-projects">
      <CardHeader className="pb-3">
  <div className={`transition-all duration-700 ${isVisible? 'opacity-100 translate-x-0':'opacity-0 -translate-x-3'}`}>
          <CardTitle className="text-lg font-semibold text-[var(--text-primary)]">Your Top 5 Active Projects</CardTitle>
          {/* Progress subtitle removed as project progress isn't shown */}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
  {sortedProjects.map(([projectId, hours], index) => {
          const project = getProject(projectId)
          const projectName = project?.name || `Project ${index + 1}`
          const percent = totalHours > 0 ? Math.round((hours / totalHours) * 1000)/10 : 0
          const color = getBarColor(projectId)
          return (
            <div
              key={projectId}
              data-bar={projectId}
              className={`space-y-3 transition-all duration-700 cursor-pointer ${isVisible? 'opacity-100 translate-y-0':'opacity-0 translate-y-[14px]'}`}
              onClick={() => setSelectedProjectId(projectId)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" data-color role="presentation" />
                  <div>
                    <div className="font-medium text-sm text-[var(--text-primary)]">{projectName}</div>
                    <div className="text-xs text-muted-token">{project?.code || projectId}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">{percent}%</div>
                  <div className="text-xs text-muted-token">{formatHours(hours)}</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full transition-all duration-700 ease-out bg-gray-200/40 overflow-hidden">
                  <div className={`bar-fill h-full rounded-full ${isVisible? 'w-full':'w-0'} transition-all duration-700 ease-out`} />
                </div>
              </div>
            </div>
          )
        })}
        {others.length>0 && (()=>{
          const hours = others.reduce((s, [,h])=> s+h, 0)
          const percent = totalHours > 0 ? Math.round((hours / totalHours) * 1000)/10 : 0
          const index = sortedProjects.length
          return (
            <div
              key="__other__"
              data-bar="__other__"
              className={`space-y-3 transition-all duration-700 ${isVisible? 'opacity-100 translate-y-0':'opacity-0 translate-y-[14px]'}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full dot-other" role="presentation" />
                  <div>
                    <div className="font-medium text-sm text-[var(--text-primary)]">Other Projects</div>
                    <div className="text-xs text-muted-token">OTHER</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">{percent}%</div>
                  <div className="text-xs text-muted-token">{formatHours(hours)}</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full transition-all duration-700 ease-out bg-gray-200/40 overflow-hidden">
                  <div className={`bar-fill h-full rounded-full dot-other ${isVisible? 'w-full':'w-0'} transition-all duration-700 ease-out`} />
                </div>
              </div>
            </div>
          )
        })()}
      </CardContent>
      {/* Panel rendered via portal to avoid being constrained by card transforms/overflow */}
    </Card>
    {selectedProject && typeof window !== 'undefined' && createPortal(
        <ProjectDetailPanel project={selectedProject} scopeLabel={`current ${scopeLabel}`} onClose={() => setSelectedProjectId(null)} />,
        document.body
      )}
    </>
  )
}

export function HoursSummaryChart() {
  const { filteredTimeEntries, effectiveRange, filteredProjects, filters } = useFilters()
  const [viewMode, setViewMode] = useState<"weekly" | "daily" | "monthly">("weekly")
  // width + data dependencies used inside dynamicCss
  const [isVisible, setIsVisible] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const hoverClearTimer = useRef<number | null>(null)
  const svgWrapRef = useRef<HTMLDivElement | null>(null)
  const [wrapWidth, setWrapWidth] = useState<number>(640)
  useEffect(() => {
    if (!svgWrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width) setWrapWidth(e.contentRect.width)
      }
    })
    ro.observe(svgWrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
      setIsInitialLoad(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Re-animate on view mode switch or layout width change
  // (placed later after data is derived to avoid use-before-declare)

  // Real data aggregation: daily/weekly points + max capacity (8h per working day minus holidays)
  interface UnifiedPoint { label: string; billable: number; nonBillable: number; absence: number; max: number; isFuture?: boolean }

  const dateIso = (d: Date) => {
    const dd = new Date(d)
    dd.setHours(0, 0, 0, 0)
    return dd.toISOString().slice(0, 10)
  }

  const { isDayOff } = useDaysOff({ from: dateIso(effectiveRange.start), to: dateIso(effectiveRange.end) })
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  // todayIso not used; removed for lint cleanliness

  // Scope to consultant (ViewingScope overrides; else current user; else all)
  const { consultants } = useConsultants()
  const { user } = useAuth()
  const { consultantId: scopedConsultant } = useViewingScope()
  const primaryConsultantId = useMemo(()=>{
    if(!consultants?.length) return null as string | null
    if(user?.email){
      const lower = user.email.toLowerCase()
      const found = consultants.find(c=> c.email?.toLowerCase() === lower)
      if(found) return found.id
    }
    return consultants[0]?.id ?? null
  }, [consultants, user?.email])
  const entriesForChart = useMemo(()=>{
    if(scopedConsultant){ return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant) }
    if(primaryConsultantId){ return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId) }
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])

  // (Uses shared computeBarGeometry)

  // Dynamic CSS for HoursSummaryChart (segments + max lines + metric bar colors)
  const hoursChartCss = useMemo(()=>{
    const lines: string[] = []
  lines.push(`#hours-summary-metrics [data-metric="billable"] .metric-bar-fill{background:#6eedd9}`)
    lines.push(`#hours-summary-metrics [data-metric="nonbillable"] .metric-bar-fill{background:#174076}`)
    lines.push(`#hours-summary-metrics [data-metric="absence"] .metric-bar-fill{background:#e03768}`)
    lines.push(`#hours-summary-metrics [data-metric="max"] .metric-bar-fill{background:#9169f4}`)
    
    // Use consistent scale-up animation for both initial load and mode switches
    const segmentDelay = 40
    const segmentDuration = 350
    const lineDelay = 20
    const lineDuration = 350
    
    for(let i=0;i<120;i++){
      // Unified scale-up animation for all cases
      lines.push(`#hours-summary-chart [data-seg="${i}"]{transform-origin:bottom center;transition:transform ${segmentDuration}ms ease,opacity ${segmentDuration}ms ease;transition-delay:${100 + i * segmentDelay}ms}`)
      lines.push(`#hours-summary-chart[data-visible="false"] [data-seg="${i}"]{transform:scaleY(.1);opacity:0}`)
      lines.push(`#hours-summary-chart[data-visible="true"] [data-seg="${i}"]{transform:scaleY(1);opacity:1}`)
      
      const delay = 200 + i * lineDelay
      lines.push(`#hours-summary-chart [data-max-line="${i}"]{transition:stroke-dashoffset ${lineDuration}ms ease ${delay}ms,opacity ${lineDuration}ms ease ${delay}ms}`)
      lines.push(`#hours-summary-chart[data-visible="false"] [data-max-line="${i}"]{stroke-dashoffset:var(--seg-${i},0);opacity:0.3}`)
      lines.push(`#hours-summary-chart[data-visible="true"] [data-max-line="${i}"]{stroke-dashoffset:0;opacity:1}`)
      lines.push(`#hours-summary-chart [data-max-group="${i}"]{transition:opacity ${lineDuration}ms ease ${180 + i * lineDelay}ms}`)
      lines.push(`#hours-summary-chart[data-visible="false"] [data-max-group="${i}"]{opacity:0}`)
      lines.push(`#hours-summary-chart[data-visible="true"] [data-max-group="${i}"]{opacity:1}`)
    }
    lines.push(`#hours-summary-chart [data-seg][data-ghost="true"]{opacity:.28}`)
    const n = entriesForChart.length
    if(n){
      const { barWidth } = computeBarGeometry(n, wrapWidth)
      const seg = Math.max(2, barWidth)
      for(let i=0;i<n;i++){ lines.push(`#hours-summary-chart [data-max-line="${i}"]{--seg-${i}:${seg};}`) }
    }
    return lines.join('\n')
  }, [entriesForChart, wrapWidth, computeBarGeometry])
  useAggregatedDynamicCss('charts-hours-summary-v2', hoursChartCss) // Added v2 to force cache refresh

    // (Merged variable CSS into main dynamicCss below)

  // Absence detection based on project metadata
  const isAbsenceProject = (pid: string) => {
    const p = filteredProjects.find(pp=> pp.id === pid)
    const codeLc = (p?.code || '').toLowerCase()
    const nameLc = (p?.name || '').toLowerCase()
    return pid === 'Office.Absences' || codeLc === 'office.absences' || codeLc === 'abs' || codeLc.includes('absence') ||
      nameLc.includes('absence') || nameLc.includes('urlop') || nameLc.includes('vacation') || nameLc.includes('holiday') || nameLc.includes('leave')
  }
  // Fast lookup for project metadata to classify billable vs non-billable consistently
  const projectById = useMemo(() => new Map(filteredProjects.map(p => [p.id, p])), [filteredProjects])

  const dailyPoints: UnifiedPoint[] = useMemo(() => {
    const points: UnifiedPoint[] = []
    const start = new Date(effectiveRange.start)
    const end = new Date(effectiveRange.end)
    let cursor = new Date(start)
    while (cursor <= end) {
      const dow = cursor.getDay()
      // Monday..Friday only on axis
      if (dow >= 1 && dow <= 5) {
  const iso = dateIso(cursor)
  // Treat today like future for capacity purposes (sync happens at night)
  const isFuture = cursor >= today
        const entries = entriesForChart.filter((e) => e.date === iso)
        let billable = 0, nonBillable = 0, absence = 0
        for (const e of entries) {
          if (isAbsenceProject(e.projectId)) {
            absence += e.hours
          } else {
            const proj = projectById.get(e.projectId)
            const isBillable = proj ? proj.billable : e.billable
            if (isBillable) billable += e.hours
            else nonBillable += e.hours
          }
        }
        const total = billable + nonBillable + absence
    const maxCap = (isDayOff(iso) || isFuture) ? 0 : 8
    points.push({ label: format(cursor, 'dd.MM'), billable, nonBillable, absence, max: maxCap, isFuture })
      }
      cursor = addDays(cursor, 1)
    }
    return points
  }, [effectiveRange.start, effectiveRange.end, entriesForChart, isDayOff, filteredProjects, today])

  const weeklyPoints: UnifiedPoint[] = useMemo(() => {
    if (dailyPoints.length === 0) return []
  const weeks = new Map<string, { label: string; billable: number; nonBillable: number; absence: number; max: number }>()
    // Group days by week label (Mon..Sun bucket label by week start date)
    // Label format: week starting dd.MM
  const start = new Date(effectiveRange.start)
    // normalize to Monday
    const day = start.getDay() || 7
    if (day !== 1) start.setDate(start.getDate() - (day - 1))

    dailyPoints.forEach((p, idx) => {
      // reconstruct date for this point from label by iterating original daily sequence index
      // Safer: recompute week key from effectiveRange and index distance
      // Instead, calculate the week key using a rolling cursor across original range
    })
    // Simpler: regen from effectiveRange again and parallel build to avoid fragile mapping
  const map = new Map<string, { label: string; billable: number; nonBillable: number; absence: number; max: number; isFuture: boolean }>()
    let cursor = new Date(effectiveRange.start)
    while (cursor <= effectiveRange.end) {
      const dow = cursor.getDay()
        const keyDate = new Date(cursor)
        const keyDay = keyDate.getDay() || 7
        if (keyDay !== 1) keyDate.setDate(keyDate.getDate() - (keyDay - 1))
        const key = dateIso(keyDate)
    if (!map.has(key)) map.set(key, { label: `Wk ${format(keyDate, 'ww')}`, billable: 0, nonBillable: 0, absence: 0, max: 0, isFuture: keyDate > today })
        const iso = dateIso(cursor)
        const entries = entriesForChart.filter((e) => e.date === iso)
        let billable = 0, nonBillable = 0, absence = 0
        for (const e of entries) {
          if (isAbsenceProject(e.projectId)) {
            absence += e.hours
          } else {
            const proj = projectById.get(e.projectId)
            const isBillable = proj ? proj.billable : e.billable
            if (isBillable) billable += e.hours
            else nonBillable += e.hours
          }
        }
  // Treat today like future for capacity purposes (sync happens at night)
    // Capacity: Mon–Fri only, exclude holidays; include weekend HOURS in totals but not in capacity
    const isWeekday = dow >= 1 && dow <= 5
    const maxCap = (isWeekday && !isDayOff(iso)) ? 8 : 0
        const agg = map.get(key)!
        agg.billable += billable
        agg.nonBillable += nonBillable
        agg.absence += absence
        agg.max += maxCap
      cursor = addDays(cursor, 1)
    }
  // round values to 2 decimals for consistency
  const out: UnifiedPoint[] = []
  map.forEach((v) => {
      out.push({
        label: v.label,
        billable: round2(v.billable),
        nonBillable: round2(v.nonBillable),
        absence: round2(v.absence),
    max: v.max,
    isFuture: v.isFuture,
      })
    })
    // sort by label (week number)
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    return out
  }, [dailyPoints, effectiveRange.start, effectiveRange.end, entriesForChart, isDayOff, filteredProjects, today])

  // Monthly aggregation for year-long views
  const monthlyPoints: UnifiedPoint[] = useMemo(() => {
    const map = new Map<string, { label: string; billable: number; nonBillable: number; absence: number; max: number }>()
    let cursor = new Date(effectiveRange.start)
    while (cursor <= effectiveRange.end) {
      const dow = cursor.getDay()
        const keyDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
        const key = `${keyDate.getFullYear()}-${String(keyDate.getMonth() + 1).padStart(2, '0')}-01`
        const label = format(keyDate, 'LLL')
        if (!map.has(key)) map.set(key, { label, billable: 0, nonBillable: 0, absence: 0, max: 0 })
        const iso = dateIso(cursor)
        const entries = entriesForChart.filter((e) => e.date === iso)
        let billable = 0, nonBillable = 0, absence = 0
        for (const e of entries) {
          if (isAbsenceProject(e.projectId)) {
            absence += e.hours
          } else {
            const proj = projectById.get(e.projectId)
            const isBillable = proj ? proj.billable : e.billable
            if (isBillable) billable += e.hours
            else nonBillable += e.hours
          }
        }
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const isFutureMonth = monthStart > today
  // Treat today like future for capacity purposes (sync happens at night)
  const isFutureDay = new Date(iso) >= today
        // For future months: don't count max at all; for current/past, Mon–Fri only and not holidays; include weekend HOURS in totals but not capacity
        const isWeekday = dow >= 1 && dow <= 5
        const maxCap = (isFutureMonth || isFutureDay || !isWeekday || isDayOff(iso)) ? 0 : 8
        const agg = map.get(key)!
        agg.billable += billable
        agg.nonBillable += nonBillable
        agg.absence += absence
        agg.max += maxCap
      cursor = addDays(cursor, 1)
    }
    const out: UnifiedPoint[] = []
    map.forEach((v, k) => {
      const [y, m] = k.split('-').map((s) => parseInt(s, 10))
      const isFuture = new Date(y, m - 1, 1) > today
      out.push({
        label: v.label,
        billable: round2(v.billable),
        nonBillable: round2(v.nonBillable),
        absence: round2(v.absence),
        max: v.max,
        isFuture,
      })
    })
    // sort by year-month key to ensure chronological order
    out.sort((a, b) => {
      // reconstruct artificial key order by comparing month names within the same range
      // since labels are LLL (locale short month), fallback to start->end iteration order by building keys again
      // Simpler: re-walk the range months and map labels to order
      const order: string[] = []
  const mCursor = new Date(effectiveRange.start.getFullYear(), effectiveRange.start.getMonth(), 1)
      const endMonth = new Date(effectiveRange.end.getFullYear(), effectiveRange.end.getMonth(), 1)
      while (mCursor <= endMonth) {
        order.push(format(mCursor, 'LLL'))
        mCursor.setMonth(mCursor.getMonth() + 1)
      }
      return order.indexOf(a.label) - order.indexOf(b.label)
    })
    return out
  }, [effectiveRange.start, effectiveRange.end, entriesForChart, isDayOff, filteredProjects, today])

  // Decide which view modes to offer based on selected date range
  const isYearRange = filters?.dateRange === 'this-year' || filters?.dateRange === 'previous-year'
  const allowedModes: Array<'weekly' | 'daily' | 'monthly'> = isYearRange ? ['monthly', 'weekly'] : ['weekly', 'daily']
  // Auto-correct current viewMode if it's not allowed for the current range
  useEffect(() => {
    if (!allowedModes.includes(viewMode)) {
      setViewMode(allowedModes[0])
    }
  // Intentionally only re-run when allowedModes changes via dateRange; viewMode reset side-effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.dateRange])

  const currentData: UnifiedPoint[] = viewMode === 'weekly' ? weeklyPoints : viewMode === 'daily' ? dailyPoints : monthlyPoints
  const globalMax = Math.max(1, ...currentData.map((d) => d.max))

  // Calculate totals for the period
  // Summary totals must include all entries in range (including weekends) to match KPIs
  let totalBillable = 0, totalNonBillable = 0, totalAbsence = 0
  for (const e of entriesForChart) {
    if (isAbsenceProject(e.projectId)) {
      totalAbsence += e.hours
    } else {
      const proj = projectById.get(e.projectId)
      const isBill = proj ? proj.billable : e.billable
      if (isBill) totalBillable += e.hours
      else totalNonBillable += e.hours
    }
  }
  // Max capacity remains computed from working days in the frame (Mon-Fri, minus holidays)
  const sumMax = currentData.reduce((sum, d) => sum + d.max, 0)

  // Use animated counters only on initial load for smooth entry
  const animatedBillable = useAnimatedCounter(totalBillable, isInitialLoad ? 1200 : 0)
  const animatedNonBillable = useAnimatedCounter(totalNonBillable, isInitialLoad ? 1400 : 0)
  const animatedAbsence = useAnimatedCounter(totalAbsence, isInitialLoad ? 1600 : 0)
  const animatedMax = useAnimatedCounter(sumMax, isInitialLoad ? 1800 : 0)

  // Use animated values for display
  const displayBillable = animatedBillable
  const displayNonBillable = animatedNonBillable
  const displayAbsence = animatedAbsence
  const displayMax = animatedMax

  // Re-animate chart when layout or data framing changes to maximize perceived responsiveness
  useEffect(() => {
    if (isInitialLoad) return // Skip on initial load
    // For mode changes, use same scale animation as initial load but faster
    setIsVisible(false)
    const t = setTimeout(() => setIsVisible(true), 100) // Quick reset for smooth scale animation
    return () => clearTimeout(t)
  }, [viewMode, wrapWidth, currentData.length, isInitialLoad])

  // Helpers for bucket ranges (Mon–Sun weeks, full months)
  const startOfWeek = (d: Date) => {
    const x = new Date(d); const day = x.getDay() || 7; if (day !== 1) x.setDate(x.getDate() - (day - 1))
    x.setHours(0,0,0,0); return x
  }
  const endOfWeek = (d: Date) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e }
  const startOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
  const endOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth()+1, 0); x.setHours(23,59,59,999); return x }
  const fmtISO = (d: Date) => d.toISOString().slice(0,10)

  const workingDaysBetween = (startISO: string, endISO: string) => {
    const s = new Date(startISO), e = new Date(endISO)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 5
    let days = 0; const x = new Date(s); x.setHours(0,0,0,0)
    while (x <= e) { const w = x.getDay(); if (w !== 0 && w !== 6) days++; x.setDate(x.getDate()+1) }
    return Math.max(days, 0)
  }

  // Build bucketRanges from effectiveRange for the active viewMode
  const bucketRanges = useMemo(() => {
    if (!effectiveRange?.start || !effectiveRange?.end) return undefined as Array<{start:string;end:string}> | undefined
    const s = new Date(effectiveRange.start)
    const e = new Date(effectiveRange.end)
    const out: Array<{start:string;end:string}> = []
    if (viewMode === 'weekly') {
      let cur = startOfWeek(s)
      while (cur <= e) {
        const ce = endOfWeek(cur)
        out.push({ start: fmtISO(cur), end: fmtISO(ce < e ? ce : e) })
        cur = new Date(cur); cur.setDate(cur.getDate()+7)
      }
    } else if (viewMode === 'monthly') {
      let cur = startOfMonth(s)
      while (cur <= e) {
        const ce = endOfMonth(cur)
        out.push({ start: fmtISO(cur), end: fmtISO(ce < e ? ce : e) })
        cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
      }
    } else {
      return undefined
    }
    return out
  }, [effectiveRange.start, effectiveRange.end, viewMode])

  // Capacity per bucket from ranges (working days × 8h); averaged for a stable baseline
  const inferredBucketCap = useMemo(() => {
    if (!bucketRanges?.length) return undefined as number | undefined
    const caps = bucketRanges.map(r => workingDaysBetween(r.start, r.end) * 8)
    const avg = caps.reduce((a,b)=>a+b,0) / caps.length
    return Math.round(avg * 10) / 10
  }, [bucketRanges])

  return (
  <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-sm bg-[var(--surface)] dark:bg-[var(--surface-alt)] overflow-hidden" data-dashboard-card data-type="hours-summary">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div
          className={`transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
        >
          <CardTitle className="text-lg font-semibold text-[var(--text-primary)]">Hours Summary</CardTitle>
          <p className="text-sm text-muted-token">Reported hours breakdown</p>
        </div>
        <div
          className={`flex transition-all duration-700 delay-200 ${isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
        >
          <div role="toolbar" aria-label="Hours view mode" className="flex rounded-md overflow-hidden shadow-xs border bg-muted/40">
            {isYearRange ? (
              <>
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='monthly'}
                  aria-pressed={viewMode==='monthly'}
                  onClick={() => setViewMode("monthly")}
                  className="text-xs px-3 py-1 rounded-none first:rounded-l-md last:rounded-r-md"
                >Monthly</Button>
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='weekly'}
                  aria-pressed={viewMode==='weekly'}
                  onClick={() => setViewMode("weekly")}
                  className="text-xs px-3 py-1 rounded-none first:rounded-l-md last:rounded-r-md"
                >Weekly</Button>
              </>
            ) : (
              <>
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='weekly'}
                  aria-pressed={viewMode==='weekly'}
                  onClick={() => setViewMode("weekly")}
                  className="text-xs px-3 py-1 rounded-none first:rounded-l-md last:rounded-r-md"
                >Weekly</Button>
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='daily'}
                  aria-pressed={viewMode==='daily'}
                  onClick={() => setViewMode("daily")}
                  className="text-xs px-3 py-1 rounded-none first:rounded-l-md last:rounded-r-md"
                >Daily</Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          id="hours-summary-metrics"
          className={`grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-700 delay-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          <div data-metric="billable" className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold text-billable">
              {formatHours(displayBillable)}
            </div>
            <div className="text-xs text-muted-token">Billable</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className={`metric-bar-fill h-full rounded-full transition-all duration-1000 delay-500 ${isVisible? 'w-full':'w-0'}`} /></div>
          </div>
          <div data-metric="nonbillable" className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold text-nonbillable">
              {formatHours(displayNonBillable)}
            </div>
            <div className="text-xs text-muted-token">Non-billable</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className={`metric-bar-fill h-full rounded-full transition-all duration-1000 delay-700 ${isVisible? 'w-full':'w-0'}`} /></div>
          </div>
          <div data-metric="absence" className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold text-absence">
              {formatHours(displayAbsence)}
            </div>
            <div className="text-xs text-muted-token">Absence</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className={`metric-bar-fill h-full rounded-full transition-all duration-1000 delay-900 ${isVisible? 'w-full':'w-0'}`} /></div>
          </div>
          <div data-metric="max" className="text-center group hover:scale-110 transition-transform duration-300">
            <div className="text-lg font-bold text-max">
              {formatHours(displayMax)}
            </div>
            <div className="text-xs text-muted-token">Max</div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className={`metric-bar-fill h-full rounded-full transition-all duration-1000 delay-1100 ${isVisible? 'w-full':'w-0'}`} /></div>
          </div>
        </div>

        {/* Column chart with dashed max line */}
        {(() => {
          const n = currentData.length
          const padding = { top: 10, right: 16, bottom: 36, left: 36 }
          const chartHeight = 240
          // compute barWidth and gap to perfectly fill available width
          const available = Math.max(200, wrapWidth - padding.left - padding.right)
          const gapFactor = 0.6
          let barWidth = (available / (n + (n - 1) * gapFactor)) || 6
          barWidth = Math.max(4, barWidth) // no upper cap to fully use the width
          const gap = Math.max(2, barWidth * gapFactor)
          const width = Math.max(wrapWidth, padding.left + (n * barWidth + (n - 1) * gap) + padding.right)
          const height = chartHeight + padding.top + padding.bottom

          // derive y-domain: maximize vertical usage with minimal headroom (20h increments)
          const totals = currentData.map(d => d.billable + d.nonBillable + d.absence)
          const capMax = Math.max(0, ...currentData.map(d => d.max))
          const dataMax = Math.max(0, ...totals)
          // Use 20-hour granularity on Y-axis
          const baseStep = 20
          const niceCeil = (v: number, step: number) => Math.ceil(v / step) * step
          // For monthly we won't use a fixed baseline; we'll fit to data/capacity
          // Use range-driven capacity when available
          const unitMax = viewMode === 'daily' ? 8 : viewMode === 'weekly' ? (inferredBucketCap ?? 40) : (inferredBucketCap ?? 0)
          // Y-domain: For daily/weekly we lock to capacity (8 or 40) unless data exceeds capacity (overtime) then expand.
          const domainTopRaw = Math.max(unitMax, capMax, dataMax)
          let yMax: number
          if (viewMode === 'daily' || viewMode === 'weekly') {
            if (domainTopRaw <= unitMax) yMax = unitMax
            else yMax = niceCeil(domainTopRaw, baseStep) // expand for overtime weeks
          } else {
            // Monthly keeps adaptive scaling with gentle headroom
            yMax = domainTopRaw <= unitMax ? unitMax : niceCeil(domainTopRaw, baseStep)
            const minHeadroom = unitMax + 10
            yMax = Math.max(yMax, niceCeil(minHeadroom, baseStep))
          }

          const scaleY = (v: number) => (v / (yMax || 1)) * chartHeight
          const xFor = (i: number) => padding.left + i * (barWidth + gap)
          const xMidFor = (i: number) => xFor(i) + barWidth / 2

          // y-axis ticks & grid lines
          const tickStep = baseStep
          const ticks: number[] = []
          for (let t = 0; t <= yMax; t += tickStep) ticks.push(t)

          // Max line(s): daily/weekly -> single baseline; monthly -> per-bar based on month's capacity
          const maxY = padding.top + chartHeight - scaleY(unitMax)
          const maxLineLen = width - padding.left - padding.right

          const handleMove = (evt: React.MouseEvent<SVGSVGElement>) => {
            if (!svgRef.current) return
            const pt = svgRef.current.createSVGPoint()
            pt.x = evt.clientX
            pt.y = evt.clientY
            const ctm = svgRef.current.getScreenCTM()
            if (!ctm) return
            const inv = ctm.inverse()
            const sp = pt.matrixTransform(inv)
            // determine index based on x coordinate
            const x = sp.x
            let idx: number | null = null
            for (let i = 0; i < n; i++) {
              const bx = xFor(i)
              if (x >= bx && x <= bx + barWidth) { idx = i; break }
            }
            setHoverIndex(idx)
            if (hoverClearTimer.current) { window.clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null }
          }
          const handleLeave = () => {
            if (hoverClearTimer.current) window.clearTimeout(hoverClearTimer.current)
            hoverClearTimer.current = window.setTimeout(() => setHoverIndex(null), 40)
          }
          return (
            <div id="hours-summary-chart" data-visible={isVisible? 'true':'false'} ref={svgWrapRef} className={`mt-2 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
              <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible" onMouseMove={handleMove} onMouseLeave={handleLeave}>
                {/* y-axis ticks & grid */}
                {ticks.map((t, idx) => {
                  const y = padding.top + chartHeight - scaleY(t)
                  const isZero = t === 0
                  return (
                    <g key={idx}>
                      <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke={isZero ? '#d1d5db' : '#e5e7eb'} opacity={isZero ? 0.9 : 0.6} strokeDasharray={isZero ? '' : '4 4'} />
                      <text x={padding.left - 6} y={y + 3} textAnchor="end" className="text-[10px] fill-[var(--text-muted)]">{t}</text>
                    </g>
                  )
                })}

                {/* bars */}
                {currentData.map((d, i) => {
                  const x = xFor(i)
                  const hBillable = scaleY(d.billable)
                  const hNonBillable = scaleY(d.nonBillable)
                  const hAbsence = scaleY(d.absence)
                  const yBillable = padding.top + chartHeight - hBillable
                  const yNonBillable = yBillable - hNonBillable
                  const yAbsence = yNonBillable - hAbsence
                  const ghost = !!d.isFuture
                  return (
                    <g
                      key={i}
                      data-seg={i}
                      data-visible={isVisible? 'true':'false'}
                      data-ghost={ghost || undefined}
                      className="transition-all duration-700"
                    >
                      {hBillable > 0 && (
                        <rect x={x} y={yBillable} width={barWidth} height={hBillable} fill="#6eedd9" rx={4} />
                      )}
                      {hNonBillable > 0 && (
                        <rect x={x} y={yNonBillable} width={barWidth} height={hNonBillable} fill="#174076" rx={4} />
                      )}
                      {hAbsence > 0 && (
                        <rect x={x} y={yAbsence} width={barWidth} height={hAbsence} fill="#e03768" rx={4} />
                      )}
                      {/* hover handled on svg wrapper to avoid flicker; bars remain pointer-agnostic */}
                    </g>
                  )
                })}

                {/* dashed max line(s) */}
                {currentData.map((d, i) => {
                  const y = padding.top + chartHeight - scaleY(d.max)
                  const x1 = xFor(i)
                  const x2 = x1 + barWidth
                  const xm = xMidFor(i)
                  const seg = Math.max(2, barWidth)
                  const yText = Math.max(y - 2, padding.top + 8)
                  if (d.max <= 0) return null
                  return (
                    <g key={`max-${i}`} data-max-group={i} className="opacity-0">
                      <line
                        data-max-line={i}
                        /* data-seg-val removed (legacy attr() replacement no longer needed) */
                        x1={x1}
                        x2={x2}
                        y1={y}
                        y2={y}
                        className="chart-max-line"
                        strokeWidth={2}
                        strokeDasharray={`${seg} ${seg}`}
                        strokeDashoffset={seg}
                      />
                      <text x={xm} y={yText} textAnchor="middle" fontSize={9} fill="#9169f4" fillOpacity={0.5}>{d.max.toFixed(0)}</text>
                    </g>
                  )
                })}

                {/* subtle Today marker between last to-date and future bars */}
                {(() => {
                  const firstFutureIdx = currentData.findIndex(d => d.isFuture)
                  if (firstFutureIdx <= 0) return null
                  const markerX = Math.max(padding.left, xFor(firstFutureIdx) - (gap / 2))
                  return (
                    <line
                      x1={markerX}
                      x2={markerX}
                      y1={padding.top}
                      y2={padding.top + chartHeight}
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="2 6"
                      opacity={0.35}
                    />
                  )
                })()}

                {/* tooltip */}
                {hoverIndex !== null && currentData[hoverIndex] && (() => {
                  const d = currentData[hoverIndex]
                  const total = d.billable + d.nonBillable + d.absence
                  const util = d.max > 0 ? Math.round((total / d.max) * 1000) / 10 : 0
                  const mid = xMidFor(hoverIndex)
                  const ttW = 180
                  const ttH = 86 + (d.absence > 0 ? 14 : 0)
                  const tx = Math.min(Math.max(mid - ttW / 2, padding.left), width - padding.right - ttW)
                  const ty = padding.top + 8
                  return (
                    <g pointerEvents="none">
                      <rect x={tx} y={ty} width={ttW} height={ttH} rx={8} fill="#111827" opacity={0.92} />
                      <text x={tx + 10} y={ty + 16} fill="#ffffff" fontSize={12} fontWeight={600}>{d.label}</text>
                      <circle cx={tx + 10} cy={ty + 30} r={3} fill="#6eedd9" />
                      <text x={tx + 18} y={ty + 34} fill="#ffffff" fontSize={11}>Billable: {formatHours(d.billable)}</text>
                      <circle cx={tx + 10} cy={ty + 46} r={3} fill="#174076" />
                      <text x={tx + 18} y={ty + 50} fill="#ffffff" fontSize={11}>Non-billable: {formatHours(d.nonBillable)}</text>
                      {d.absence > 0 && (
                        <>
                          <circle cx={tx + 10} cy={ty + 62} r={3} fill="#e03768" />
                          <text x={tx + 18} y={ty + 66} fill="#ffffff" fontSize={11}>Absence: {formatHours(d.absence)}</text>
                        </>
                      )}
                      <text x={tx + 10} y={ty + ttH - 24} fill="#c7d2fe" fontSize={11}>Total: {formatHours(total)} / Max: {formatHours(d.max)}</text>
                      <text x={tx + 10} y={ty + ttH - 8} fill="#c7d2fe" fontSize={11}>Utilization: {util.toFixed(1)}%</text>
                    </g>
                  )
                })()}

                {/* x labels */}
                {(() => {
                  const step = viewMode === 'monthly' ? 1 : Math.max(1, Math.ceil(n / 10))
                  return currentData.map((d, i) => (
                    i % step === 0 ? (
                      <text key={i} x={xMidFor(i)} y={height - 8} textAnchor="middle" className="text-[10px] fill-[var(--text-muted)]">{d.label}</text>
                    ) : null
                  ))
                })()}
              </svg>
            </div>
          )
        })()}

  {/* Legend removed to increase chart focus */}
      </CardContent>
    </Card>
  )
}

export function Charts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch" data-charts-layout>
      <div className="lg:col-span-2 flex flex-col h-full" data-charts-col="active">
        <ActiveProjectsCard />
      </div>
      <div className="lg:col-span-3 flex flex-col h-full" data-charts-col="hours">
        <HoursSummaryChart />
      </div>
    </div>
  )
}

