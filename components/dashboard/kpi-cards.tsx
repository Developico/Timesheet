"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { useFilters } from "@/lib/filter-context"
import { useEffect, useState, useMemo } from 'react'
import { useNewProjects } from '@/lib/use-new-projects'
import { calculateKPIMetrics } from '@/lib/metrics'
import { useConsultants } from '@/hooks/use-consultants'
import { useAuth } from '@/lib/auth-client'
import { useViewingScope } from '@/lib/viewing-scope'
import { useDaysOff } from '@/hooks/use-days-off'

// Simple count-up animation hook
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start: number | undefined; let raf: number
    const step = (ts: number) => {
      if (start === undefined) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(target * p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

type CardDescriptor = {
  title: string
  value: string
  raw: number
  unit: string
  subtitle: string
  icon: string
  color: string
  bgColor: string
  progress?: number
  progressColor?: string
  target?: number
  trend: string
  trendColor: string
}

interface KpiCardProps {
  card: CardDescriptor
  index: number
  isVisible: boolean
  reportedCard?: boolean
  microDaily: Array<{ iso: string; label: string; billable: number; nonBillable: number; absence: number; total: number }>
  todayIso: string
  iso: (d: Date) => string
}

function KpiCard({ card, index, isVisible, reportedCard, microDaily, todayIso }: KpiCardProps) {
  // Using hook inside its own component keeps rule-of-hooks compliance (was previously inside map loop)
  const animated = useCountUp(card.raw, 900 + index * 150)
  const display = `${card.unit === '%' ? animated.toFixed(1) : animated.toFixed(1)}${card.unit}`
  const hasGoal = card.target !== undefined && card.progress !== undefined
  const belowTarget = hasGoal && (card.progress as number) < (card.target as number)
  const critical = belowTarget && (card.progress as number) < (card.target as number) * 0.8
  const highlightClass = belowTarget ? (critical ? 'data-[hl=true]:bg-red-500/10 data-[hl=true]:shadow-[0_0_0_1px_rgba(220,38,38,0.25),0_2px_4px_-2px_rgba(220,38,38,0.25)]' : 'data-[hl=true]:bg-amber-500/10 data-[hl=true]:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_2px_4px_-2px_rgba(245,158,11,0.25)]') : ''
  return (
    <Card
      key={card.title}
      data-visible={isVisible}
      data-index={index}
      data-delay={`${index * 120}`}
  className="kpi-card relative hover:shadow-xl group transition-all duration-500 border-0 shadow-sm bg-[var(--surface)] dark:bg-[var(--surface-alt)] overflow-hidden opacity-0 translate-y-[18px] data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-teal-200/10 via-transparent to-indigo-300/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
  <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-100">
          <span className="inline-flex items-center gap-2">
            {card.title}
            {belowTarget && (
              <span
                className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${critical ? 'bg-red-500' : 'bg-amber-500'}`}
                aria-label={critical ? 'Critical: KPI below 80% of target' : 'Warning: KPI below target'}
                role="status"
              />
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            <span
              data-hl={belowTarget || undefined}
              className={`inline-block transition-all duration-700 will-change-transform group-hover:scale-[1.03] rounded-md px-2 py-0.5 ${highlightClass}`}
              aria-label={belowTarget ? (critical ? 'Critical: value significantly below target' : 'Warning: value below target') : undefined}
            >
              {display}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-200">{card.subtitle}</div>
          {belowTarget && (
            <div className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
              <span className={`text-[11px] ${critical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {critical ? 'Below 80% of target' : 'Below target'}
              </span>
            </div>
          )}
        </div>

        {card.progress !== undefined && (
          <div className="space-y-2">
            <div className="relative">
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-[color:var(--surface-overlay)_/_35] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out bg-teal-200" data-progressbar data-active={isVisible || undefined} data-pct={Math.min(card.progress,100)}
                />
              </div>
              {card.target && (
                <div
                  className="absolute top-0 w-0.5 h-3 bg-gray-400 dark:bg-gray-500"
                  data-targetmarker
                  data-left={card.target}
                />
              )}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-200">vs target</span>
              <div className="flex items-center space-x-2">
                {card.target && <span className="text-gray-400 dark:text-gray-200">Target: {card.target}%</span>}
                <span className={card.color}>{animated.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        {reportedCard && (
          <div
            className="grid h-10"
            data-micro
            data-cols={Math.max(microDaily.length,1)}
          >
            {microDaily.map((d, i) => {
              const capacity = 8
              const scale = d.total > 0 ? Math.min(d.total, capacity) / d.total : 0
              const hB = (d.billable / capacity) * 100 * scale
              const hN = (d.nonBillable / capacity) * 100 * scale
              const hA = (d.absence / capacity) * 100 * scale
              const overflow = Math.max(0, d.total - capacity)
              const isToday = d.iso === todayIso
              const title = `${d.label}: B ${d.billable.toFixed(1)}h, NB ${d.nonBillable.toFixed(1)}h, Abs ${d.absence.toFixed(1)}h — Total ${d.total.toFixed(1)}h / 8h`
              const baseDelay = index * 120 + i * 60
              return (
                <div
                  key={d.iso}
                  data-col
                  data-today={isToday ? true : undefined}
                  data-delay={baseDelay}
                  className="relative h-full rounded-sm overflow-hidden bg-gray-100 dark:bg-[color:var(--surface-overlay)_/_30] flex flex-col justify-end opacity-60 translate-y-2 transition-[opacity,transform] duration-500 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0"
                  title={title}
                  aria-label={title}
                  data-visible={isVisible || undefined}
                >
                  {overflow > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-400 opacity-0 data-[visible=true]:opacity-100 transition-opacity duration-500" data-line data-delay={baseDelay+180} data-visible={isVisible || undefined} />
                  )}
                  {hA > 0 && (
                    <div data-seg data-h={hA} data-delay={baseDelay+160} className="w-full bg-[#e03768] opacity-0 h-0 data-[visible=true]:opacity-100 transition-[height,opacity] duration-700" data-visible={isVisible || undefined} />
                  )}
                  {hN > 0 && (
                    <div data-seg data-h={hN} data-delay={baseDelay+80} className="w-full bg-[#174076] opacity-0 h-0 data-[visible=true]:opacity-100 transition-[height,opacity] duration-700" data-visible={isVisible || undefined} />
                  )}
                  {hB > 0 && (
                    <div data-seg data-h={hB} data-delay={baseDelay} className="w-full bg-[#6eedd9] opacity-0 h-0 data-[visible=true]:opacity-100 transition-[height,opacity] duration-700" data-visible={isVisible || undefined} />
                  )}
                </div>
              )}
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-200">vs last period</span>
          <span className={`text-xs font-medium ${card.trendColor}`}>{card.trend}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function KPICards() {
  const { filteredTimeEntries, filters, filteredProjects } = useFilters()
  const { newProjects } = useNewProjects()
  const { consultants } = useConsultants()
  const { user } = useAuth()
  const { consultantId: scopedConsultant } = useViewingScope()
  const [isVisible, setIsVisible] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setIsVisible(true),120); return ()=>clearTimeout(t); },[]);
  // dynamic style for KPI animations using attribute values
  useAggregatedDynamicCss('kpi-dynamic', `
    .kpi-card[data-visible="true"][data-delay]{transition-delay:var(--delay,0ms)}
    .kpi-card [data-progressbar]{width:0}
    .kpi-card [data-progressbar][data-active]{width:var(--pct,0%)}
    [data-micro]{display:grid}
    [data-micro][data-cols]{grid-template-columns:repeat(var(--cols,1),1fr);gap:4px}
    [data-col]{--delay:0ms}
    [data-col][data-delay]{transition-delay:var(--delay,0ms)}
    [data-col] [data-seg]{transition-delay:var(--delay,0ms)}
    [data-seg]{--h:0;height:0}
    [data-seg][data-visible="true"]{height:var(--h,0%)}
    [data-line][data-delay]{transition-delay:var(--delay,0ms)}
    [data-targetmarker]{left:var(--left,0%)}
  `)

  // Derive effective date range similar to calendar logic
  const computeRange = () => {
    const now = new Date();
    const dr = filters.dateRange;
    const r = { start: new Date(now), end: new Date(now) };
    const startOfWeek = (b:Date)=>{ const d=new Date(b); const wd=d.getDay()===0?7:d.getDay(); d.setDate(d.getDate()-wd+1); d.setHours(0,0,0,0); return d };
    if(dr==='this-week'){ r.start=startOfWeek(now); r.end=new Date(r.start); r.end.setDate(r.start.getDate()+6) }
    else if(dr==='previous-week'){ r.end=new Date(startOfWeek(now)); r.end.setDate(r.end.getDate()-1); r.start=new Date(r.end); r.start.setDate(r.end.getDate()-6) }
    else if(dr==='this-month'){ r.start=new Date(now.getFullYear(), now.getMonth(),1); r.end=new Date(now.getFullYear(), now.getMonth()+1,0) }
    else if(dr==='previous-month'||dr==='last-month'){ r.start=new Date(now.getFullYear(), now.getMonth()-1,1); r.end=new Date(now.getFullYear(), now.getMonth(),0) }
    else if(dr==='this-quarter'){ const q=Math.floor(now.getMonth()/3); r.start=new Date(now.getFullYear(), q*3,1); r.end=new Date(now.getFullYear(), q*3+3,0) }
    else if(dr==='previous-quarter'){ const q=Math.floor(now.getMonth()/3)-1; const year=q<0? now.getFullYear()-1: now.getFullYear(); const eff=q<0?3:q; r.start=new Date(year, eff*3,1); r.end=new Date(year, eff*3+3,0) }
    else if(dr==='this-year'){ r.start=new Date(now.getFullYear(),0,1); r.end=new Date(now.getFullYear(),11,31) }
    else if(dr==='previous-year'){ r.start=new Date(now.getFullYear()-1,0,1); r.end=new Date(now.getFullYear()-1,11,31) }
    else if(dr==='custom' && filters.startDate && filters.endDate){ r.start=filters.startDate; r.end=filters.endDate }
    r.start.setHours(0,0,0,0); r.end.setHours(23,59,59,999); return r;
  }
  const range = computeRange();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const { isDayOff } = useDaysOff({ from: iso(range.start), to: iso(range.end) })
  // Determine primary consultant (current user) similar to calendar view
  const primaryConsultantId = useMemo(()=>{
    if(!consultants?.length) return null as string | null
    if(user?.email){
      const found = consultants.find(c=> typeof c.email === 'string' && c.email.toLowerCase() === user.email!.toLowerCase())
      if(found) return found.id
    }
    return consultants[0]?.id ?? null
  }, [consultants, user?.email])

  // Entries used for KPI: if ViewingScope selects a consultant (admin use-case), trust it;
  // otherwise scope to primary user to match Calendar behavior.
  const entriesForKPI = useMemo(()=>{
    if(scopedConsultant){
      return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant)
    }
    if(primaryConsultantId){
      return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId)
    }
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])

  // Align billable classification with project metadata and exclude absences
  const projectById = useMemo(()=> new Map(filteredProjects.map(p=> [p.id, p])), [filteredProjects])
  // Build supplemental dynamic CSS mapping data attributes to custom properties (no attr() usage)
  const variableCss = useMemo(()=>{
    const lines: string[] = []
    // We'll only cover progress bars & micro columns later when rendering
    // Values will be encoded directly into a style tag using data-index referencing
    return lines.join('\n')
  },[])
  useAggregatedDynamicCss('kpi-dynamic-vars', variableCss)
  const isAbsenceProject = (pid: string) => {
    const p = projectById.get(pid)
    const codeLc = (p?.code || '').toLowerCase()
    const nameLc = (p?.name || '').toLowerCase()
    return pid === 'Office.Absences' || codeLc === 'office.absences' || codeLc === 'abs' || codeLc.includes('absence') ||
      nameLc.includes('absence') || nameLc.includes('urlop') || nameLc.includes('vacation') || nameLc.includes('holiday') || nameLc.includes('leave')
  }
  const entriesForKPIClassified = useMemo(()=> entriesForKPI.map(e=>{
    const proj = projectById.get(e.projectId)
    const isBillable = proj ? proj.billable : e.billable
    // Exclude absence from billable and from non-billable calculation in KPI; reported hours remain as-is
    return { ...e, billable: !isAbsenceProject(e.projectId) && isBillable }
  }), [entriesForKPI, projectById])

  const metrics = useMemo(()=> calculateKPIMetrics(entriesForKPIClassified, range.start.toISOString().slice(0,10), range.end.toISOString().slice(0,10)), [entriesForKPIClassified, range.start.getTime(), range.end.getTime()])

  const totalHours = metrics.reportedHours
  const billableHours = metrics.billableHours
  // Recompute required hours to exclude today and DaysOff
  const requiredHoursStrict = useMemo(() => {
    const start = new Date(range.start)
    const end = new Date(range.end)
    let sum = 0
    const cur = new Date(start)
    cur.setHours(0,0,0,0)
    const today = new Date(); today.setHours(0,0,0,0)
    while (cur <= end) {
      const dow = cur.getDay()
      const curIso = iso(cur)
      const isHoliday = isDayOff(curIso)
      const isTodayOrFuture = cur >= today
      if (dow >= 1 && dow <= 5 && !isHoliday && !isTodayOrFuture) {
        sum += 8
      }
      cur.setDate(cur.getDate() + 1)
    }
    return sum
  }, [range.start.getTime(), range.end.getTime(), isDayOff])
  const requiredHours = requiredHoursStrict
  const reportedKPI = requiredHours > 0 ? (totalHours / requiredHours) * 100 : 0
  // Billable KPI relative to required hours; cannot exceed Reported KPI
  const billableKPI = Math.min(
    reportedKPI,
    requiredHours > 0 ? (billableHours / requiredHours) * 100 : 0,
  )
  const activeProjects = metrics.activeProjects

  // Build micro chart data for Reported Hours: last 7 working days within range (skip weekends/holidays, no future days)
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const workingDaysIso = useMemo(() => {
    const out: string[] = []
    const cur = new Date(range.end)
    cur.setHours(0,0,0,0)
    const min = new Date(range.start)
    min.setHours(0,0,0,0)
    while (out.length < 7 && cur >= min) {
      const dow = cur.getDay()
      const isoStr = iso(cur)
      const isHoliday = isDayOff(isoStr)
      const inPastOrToday = cur <= today
      if (dow >= 1 && dow <= 5 && !isHoliday && inPastOrToday) {
        out.push(isoStr)
      }
      cur.setDate(cur.getDate() - 1)
    }
    return out.reverse()
  }, [range.start.getTime(), range.end.getTime(), isDayOff, today])

  const microDaily = useMemo(() => {
    // Fast lookup for project metadata to classify billable vs non-billable consistently
    const projectById = new Map(filteredProjects.map(p => [p.id, p]))
    const toLabel = (isoStr: string) => `${isoStr.slice(8,10)}.${isoStr.slice(5,7)}`
    return workingDaysIso.map(dIso => {
      let billable = 0, nonBillable = 0, absence = 0
      for (const e of entriesForKPI) {
        if (e.date !== dIso) continue
        if (isAbsenceProject(e.projectId)) {
          absence += e.hours
        } else {
          const proj = projectById.get(e.projectId)
          const isBill = proj ? proj.billable : e.billable
          if (isBill) billable += e.hours; else nonBillable += e.hours
        }
      }
      const total = billable + nonBillable + absence
      return { iso: dIso, label: toLabel(dIso), billable, nonBillable, absence, total }
    })
  }, [workingDaysIso, entriesForKPI, filteredProjects])

  // Color coding based on performance vs targets
  const getKPIColor = (value: number, target: number) => {
    if (value >= target)
      return { bg: "bg-green-50 dark:bg-green-950/20", text: "text-green-600", progress: "bg-green-500" }
    if (value >= target * 0.8)
      return { bg: "bg-yellow-50 dark:bg-yellow-950/20", text: "text-yellow-600", progress: "bg-yellow-500" }
    return { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600", progress: "bg-red-500" }
  }

  const reportedColors = getKPIColor(reportedKPI, 99)
  const billableColors = getKPIColor(billableKPI, 85)

  const cards: CardDescriptor[] = useMemo(()=>[
    {
      title: "Reported Hours",
      value: `${totalHours.toFixed(1)}h`,
      raw: totalHours,
      unit: 'h',
  subtitle: `${entriesForKPI.length} entries in range`,
      icon: "⏱",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      trend: "+12.3%",
      trendColor: "text-green-600",
  // miniChart replaced by computed stacked micro-bars below
    },
    {
      title: "Reported KPI",
      value: `${reportedKPI.toFixed(1)}%`,
      raw: reportedKPI,
      unit: '%',
  subtitle: `Target: 99% | ${totalHours.toFixed(1)}h / ${requiredHours}h`,
      icon: "📊",
      color: reportedColors.text,
      bgColor: reportedColors.bg,
      progress: reportedKPI,
      progressColor: reportedColors.progress,
      target: 99,
      trend: reportedKPI >= 99 ? "+2.1%" : "-1.8%",
      trendColor: reportedKPI >= 99 ? "text-green-600" : "text-red-500",
    },
    {
      title: "Billable KPI",
      value: `${billableKPI.toFixed(1)}%`,
  raw: billableKPI,
  unit: '%',
  subtitle: `Target: 85% | ${billableHours.toFixed(1)}h billable`,
      icon: "💼",
      color: billableColors.text,
      bgColor: billableColors.bg,
      progress: billableKPI,
      progressColor: billableColors.progress,
      target: 85,
      trend: billableKPI >= 85 ? "+3.2%" : "-2.4%",
      trendColor: billableKPI >= 85 ? "text-green-600" : "text-red-500",
    },
    // New Projects quick card (shows only if at least 1 new project)
    ...(newProjects.length>0 ? [{
      title: 'New Projects',
      value: `${newProjects.length}`,
      raw: newProjects.length,
      unit: '',
      subtitle: 'Awaiting your review',
      icon: '🆕',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-950/20',
      progress: undefined,
      target: undefined,
      trend: '',
      trendColor: 'text-teal-600'
    }]: []),
  ], [totalHours, entriesForKPI.length, reportedKPI, requiredHours, billableKPI, billableHours, newProjects.length, reportedColors, billableColors])

  // Generate CSS custom property assignments for each KPI card & its micro bars
  const cardVariableCss = useMemo(()=>{
    const lines: string[] = []
    cards.forEach((c, i)=>{
      const pct = c.progress !== undefined ? Math.min(c.progress, 100) : 0
      lines.push(`.kpi-card[data-index="${i}"]{--pct:${pct}%;--delay:${i*120}ms}`)
      if(c.target !== undefined){
        lines.push(`.kpi-card[data-index="${i}"] [data-targetmarker]{--left:${c.target}%}`)
      }
    })
    // Micro daily bars variables
    const reportedIndex = cards.findIndex(c=> c.title === 'Reported Hours')
    if(reportedIndex >= 0){
      lines.push(`.kpi-card[data-index="${reportedIndex}"] [data-micro]{--cols:${Math.max(microDaily.length,1)}` + `}`)
      microDaily.forEach((d, idx)=>{
        const baseDelay = reportedIndex*120 + idx*60
        const capacity = 8
        const scale = d.total > 0 ? Math.min(d.total, capacity) / d.total : 0
        const hB = (d.billable / capacity) * 100 * scale
        const hN = (d.nonBillable / capacity) * 100 * scale
        const hA = (d.absence / capacity) * 100 * scale
        // Assign heights & delays to individual segments via nth-of-type selectors for determinism
        // Structure: each data-col contains segments appended in order Absence (A), NonBillable (N), Billable (B)
        lines.push(`.kpi-card[data-index="${reportedIndex}"] [data-micro] [data-col]:nth-of-type(${idx+1}){--delay:${baseDelay}ms}`)
        let segOrder = 0
        if(hA>0){ lines.push(`.kpi-card[data-index="${reportedIndex}"] [data-micro] [data-col]:nth-of-type(${idx+1}) [data-seg]:nth-of-type(${++segOrder}){--h:${hA.toFixed(2)}%}`) }
        if(hN>0){ lines.push(`.kpi-card[data-index="${reportedIndex}"] [data-micro] [data-col]:nth-of-type(${idx+1}) [data-seg]:nth-of-type(${++segOrder}){--h:${hN.toFixed(2)}%}`) }
        if(hB>0){ lines.push(`.kpi-card[data-index="${reportedIndex}"] [data-micro] [data-col]:nth-of-type(${idx+1}) [data-seg]:nth-of-type(${++segOrder}){--h:${hB.toFixed(2)}%}`) }
      })
    }
    return lines.join('\n')
  }, [cards, microDaily])
  useAggregatedDynamicCss('kpi-card-vars', cardVariableCss)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => (
        <KpiCard
          key={card.title}
          card={card}
          index={index}
          isVisible={isVisible}
          reportedCard={card.title === 'Reported Hours'}
          microDaily={microDaily}
          todayIso={iso(today)}
          iso={iso}
        />
      ))}
      <ActiveProjectsCard />
    </div>
  )
}

export function ActiveProjectsCard() {
  const { filteredTimeEntries } = useFilters()

  const projectHours = [
    { code: "WEB-2024", name: "Web Platform Redesign", hours: 42.5, color: "bg-blue-500", percentage: 85 },
    { code: "API-CORE", name: "Core API Development", hours: 38.2, color: "bg-green-500", percentage: 76 },
    { code: "MOBILE-V2", name: "Mobile App v2.0", hours: 28.7, color: "bg-purple-500", percentage: 57 },
    { code: "DASH-PRO", name: "Dashboard Pro", hours: 24.1, color: "bg-orange-500", percentage: 48 },
    { code: "E-COM", name: "E-commerce Platform", hours: 19.3, color: "bg-teal-500", percentage: 39 },
    { code: "AUTH-SYS", name: "Authentication System", hours: 15.8, color: "bg-indigo-500", percentage: 32 },
  ]

  return null // (Active Projects card rendered by charts.tsx version)
}
