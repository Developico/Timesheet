"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useProjects, type BasicProject } from "@/hooks/use-projects"
import { summarize, isAbsenceProject } from "@/lib/time-entries-summary"
import { useConsultants, type BasicConsultant } from "@/hooks/use-consultants"
import { useAuth } from "@/lib/auth-client"
import { useViewingScope } from "@/lib/viewing-scope"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useDaysOff } from "../../hooks/use-days-off"
import { useFilters } from "@/lib/filter-context"

interface CalendarEntry {
  id:string;
  date:string;
  projectId:string;
  hours:number;
  billable:boolean;
  consultantId?: string;
  description?:string;
  note?: string;
  task?: string;
}
interface AggregatedDayEntry extends CalendarEntry { aggregated: true; count: number; project?: BasicProject }
type DayDisplayEntry = CalendarEntry & { project?: BasicProject } | AggregatedDayEntry

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownSort, setBreakdownSort] = useState<
    'total-desc' | 'billable-desc' | 'nonbillable-desc' | 'absence-desc' | 'code-asc' | 'name-asc'
  >('total-desc')
  // Gesture + keyboard navigation refs/state ----------------------------------
  const gestureRef = useRef<HTMLDivElement | null>(null)
  const dragStart = useRef<{x:number; y:number; t:number} | null>(null)
  // Simple responsive detection (no SSR impact – guarded by typeof window)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  useEffect(()=>{
    const mq = () => setIsMobile(typeof window!=='undefined' && window.innerWidth < 640)
    mq();
    window.addEventListener('resize', mq)
    return ()=> window.removeEventListener('resize', mq)
  },[])
  // Aggregation now defaults ON per request
  const [aggregateDayEntries, setAggregateDayEntries] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { projects, loading: projectsLoading, error: projectsError } = useProjects()
  const { filteredTimeEntries, filters } = useFilters()
  const { consultants } = useConsultants()
  const { user } = useAuth()
  const { consultantId: scopedConsultant } = useViewingScope()

  // Scope entries to active consultant: ViewingScope overrides; else current user; else fallback to all
  const primaryConsultantId = useMemo(()=>{
    if(!consultants?.length) return null as string | null
    if(user?.email){
      const lower = user.email.toLowerCase()
      const found = consultants.find(c=> c.email?.toLowerCase() === lower)
      if(found) return found.id
    }
    return consultants[0]?.id ?? null
  }, [consultants, user?.email])

  const entriesForCalendarSrc = useMemo(()=>{
    if(scopedConsultant) return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant)
    if(primaryConsultantId) return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId)
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])

  const calendarEntries: CalendarEntry[] = useMemo(()=> entriesForCalendarSrc.map(e=>({
    id:e.id,
    date:e.date,
    projectId:e.projectId,
    hours:e.hours,
    billable:e.billable,
    consultantId: (e as any).consultantId,
    description:(e as any).description,
    note:(e as any).note,
    task:(e as any).task,
  })), [entriesForCalendarSrc])

  const entriesByDate = useMemo(()=>{ const m:Record<string,CalendarEntry[]> = {}; for(const e of calendarEntries){ (m[e.date] ||= []).push(e) } return m }, [calendarEntries])

  // Extend with absence pseudo project if not present
  const enhancedProjects = useMemo(()=>[
    ...projects,
    { id:"Office.Absences", code:"ABS", name:"Absence", color:"#ef4444", billable:false, assigned:true },
  ], [projects])

  const getWeekDays = (date: Date) => {
    const days: Date[] = []
    const d = new Date(date)
    const day = d.getDay() === 0 ? 7 : d.getDay() // make Sunday 7
    d.setDate(d.getDate() - day + 1) // Monday
    for (let i=0;i<7;i++){ const nd = new Date(d); nd.setDate(d.getDate()+i); days.push(nd) }
    return days
  }
  // Helper utilities (restored after corruption) ---------------------------------
  const dateIso = (d: Date) => d.toISOString().slice(0,10)
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(); const month = date.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month+1, 0)
    const startDow = (first.getDay()+6)%7 // Monday=0
    const arr:(number|null)[]=[]
    for(let i=0;i<startDow;i++) arr.push(null)
    for(let d=1; d<=last.getDate(); d++) arr.push(d)
    return arr
  }

  const getEntriesForDate = (date: Date) => {
    const k = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    return entriesByDate[k] || []
  }

  // Project selection scope
  const findProject = (id: string | null) => (id ? enhancedProjects.find(p=>p.id===id) : undefined)
  const selectedProjectRaw = findProject(selectedProjectId || '')
  // Adapt BasicProject -> shape expected by ProjectDetailPanel (ensure required props present)
  const selectedProject = useMemo(()=>{
    if(!selectedProjectRaw) return undefined
    return {
      id: selectedProjectRaw.id,
      code: selectedProjectRaw.code || selectedProjectRaw.id,
      name: selectedProjectRaw.name,
  color: selectedProjectRaw.color || '#174076',
      billable: Boolean(selectedProjectRaw.billable),
      client: selectedProjectRaw.client || '',
      note: selectedProjectRaw.note,
      assigned: Boolean(selectedProjectRaw.assigned),
    }
  }, [selectedProjectRaw])
  const currentScopeEntries = useMemo(()=>{
    // All entries in current visible scope
    const inScope = viewMode==='week'
      ? getWeekDays(currentDate).flatMap(d=> getEntriesForDate(d))
      : calendarEntries.filter(e=>{
          const d = new Date(e.date)
          return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()
        })
    if(selectedProjectId) return inScope.filter(e=> e.projectId === selectedProjectId)
    return inScope
  }, [viewMode, currentDate, selectedProjectId, calendarEntries])
  // Accessibility for detail panel (Escape to close & focus management)
  useEffect(()=>{
    if(!selectedProjectId) return
    const handler = (e:KeyboardEvent)=>{ if(e.key==='Escape') setSelectedProjectId(null) }
    window.addEventListener('keydown', handler)
    return ()=> window.removeEventListener('keydown', handler)
  }, [selectedProjectId])

  const navigateWeek = (dir:"prev"|"next") => setCurrentDate(prev=>{ const d=new Date(prev); d.setDate(d.getDate() + (dir==='prev'? -7:7)); return d })
  const navigateMonth = (dir:"prev"|"next") => setCurrentDate(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth() + (dir==='prev'? -1:1)); return d })
  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

  // Live region for announcing navigation changes
  const liveRef = useRef<HTMLDivElement | null>(null)
  useEffect(()=>{
    if(!liveRef.current) return
    const label = viewMode==='week'
      ? `Week starting ${getWeekDays(currentDate)[0].toLocaleDateString()}`
      : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    liveRef.current.textContent = label
  }, [currentDate, viewMode])

  const scopeRange = useMemo(()=>{
    if(viewMode==='week') { const w=getWeekDays(currentDate); return {from:w[0], to:w[6]} }
    const y=currentDate.getFullYear(); const m=currentDate.getMonth(); return {from:new Date(y,m,1), to:new Date(y,m+1,0)}
  }, [viewMode, currentDate])
  const { isDayOff } = useDaysOff({ from: dateIso(scopeRange.from), to: dateIso(scopeRange.to) })

  // Global active range boundaries from filters (mirror logic from provider)
  const globalRange = useMemo(()=>{
    const now = new Date(); const dr=filters.dateRange; const r={start:new Date(now), end:new Date(now)}
    const startOfWeek=(b:Date)=>{const d=new Date(b); const day=d.getDay()===0?7:d.getDay(); d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d }
    if(dr==='this-week'){ r.start=startOfWeek(now); r.end=new Date(r.start); r.end.setDate(r.start.getDate()+6) }
    else if(dr==='previous-week'){ r.end=new Date(startOfWeek(now)); r.end.setDate(r.end.getDate()-1); r.start=new Date(r.end); r.start.setDate(r.end.getDate()-6) }
    else if(dr==='this-month'){ r.start=new Date(now.getFullYear(), now.getMonth(),1); r.end=new Date(now.getFullYear(), now.getMonth()+1,0) }
    else if(dr==='previous-month'||dr==='last-month'){ r.start=new Date(now.getFullYear(), now.getMonth()-1,1); r.end=new Date(now.getFullYear(), now.getMonth(),0) }
    else if(dr==='this-quarter'){ const q=Math.floor(now.getMonth()/3); r.start=new Date(now.getFullYear(), q*3,1); r.end=new Date(now.getFullYear(), q*3+3,0) }
    else if(dr==='previous-quarter'){ const q=Math.floor(now.getMonth()/3)-1; const year=q<0? now.getFullYear()-1: now.getFullYear(); const eff=q<0?3:q; r.start=new Date(year, eff*3,1); r.end=new Date(year, eff*3+3,0) }
    else if(dr==='this-year'){ r.start=new Date(now.getFullYear(),0,1); r.end=new Date(now.getFullYear(),11,31) }
    else if(dr==='previous-year'){ r.start=new Date(now.getFullYear()-1,0,1); r.end=new Date(now.getFullYear()-1,11,31) }
    else if(dr==='custom' && filters.startDate && filters.endDate){ r.start=filters.startDate; r.end=filters.endDate }
    r.start.setHours(0,0,0,0); r.end.setHours(23,59,59,999); return r
  }, [filters.dateRange, filters.startDate, filters.endDate])
  useEffect(()=>{ setCurrentDate(new Date(globalRange.start)) }, [globalRange.start.getTime()])
  const isActiveDay = (d:Date)=> d>=globalRange.start && d<=globalRange.end

  // Totals must reflect the currently visible scope (week grid or the visible month only)
  const currentScopeEntriesAll = useMemo(()=>{
    // Attach project metadata so summarize() can classify absences robustly
    if(viewMode==='week') return getWeekDays(currentDate).flatMap(d=> getEntriesForDate(d).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)})))
    const y = currentDate.getFullYear(); const m = currentDate.getMonth()
    return calendarEntries
      .filter(e=>{ const d=new Date(e.date); return d.getFullYear()===y && d.getMonth()===m })
      .map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
  }, [viewMode, currentDate, calendarEntries, enhancedProjects])
  const periodSummaryAgg = summarize(currentScopeEntriesAll as any)
  const periodSummary = {
    totalHours: periodSummaryAgg.total,
    billableHours: periodSummaryAgg.billable,
    nonBillableHours: periodSummaryAgg.nonBillable,
    absenceHours: periodSummaryAgg.absence,
  }

  // Projects breakdown for current visible scope (Option 2)
  type Breakdown = {
    project: BasicProject
    total: number
    billable: number
    nonBillable: number
    absence: number
  }
  const projectsBreakdown = useMemo<Breakdown[]>(()=>{
    const map = new Map<string, Breakdown>()
    for(const e of currentScopeEntriesAll as any[]){
      const proj: BasicProject | undefined = e.project || enhancedProjects.find((p:BasicProject)=> p.id===e.projectId)
      if(!proj) continue
      const key = proj.id
      const cur = map.get(key) || { project: proj, total: 0, billable: 0, nonBillable: 0, absence: 0 }
      const isAbs = isAbsenceProject(e.projectId, proj.code as any, proj.name as any)
      cur.total += e.hours
      if(isAbs){ cur.absence += e.hours }
      else if(e.billable){ cur.billable += e.hours }
      else { cur.nonBillable += e.hours }
      map.set(key, cur)
    }
    const arr = Array.from(map.values())
    const cmpNumDesc = (a:number,b:number)=> b-a
    switch(breakdownSort){
      case 'billable-desc':
        arr.sort((a,b)=> cmpNumDesc(a.billable, b.billable)); break
      case 'nonbillable-desc':
        arr.sort((a,b)=> cmpNumDesc(a.nonBillable, b.nonBillable)); break
      case 'absence-desc':
        arr.sort((a,b)=> cmpNumDesc(a.absence, b.absence)); break
      case 'code-asc':
        arr.sort((a,b)=> (a.project.code||'').localeCompare(b.project.code||'')); break
      case 'name-asc':
        arr.sort((a,b)=> (a.project.name||'').localeCompare(b.project.name||'')); break
      case 'total-desc':
      default:
        arr.sort((a,b)=> cmpNumDesc(a.total, b.total)); break
    }
    return arr
  }, [currentScopeEntriesAll, enhancedProjects, breakdownSort])

  // Dynamic CSS for breakdown bars and color dots (avoid inline styles)
  const breakdownCss = useMemo(()=>{
    const total = periodSummary.totalHours || 0
    const lines: string[] = []
    projectsBreakdown.forEach((b, i)=>{
      const pctB = total>0 ? (b.billable/total)*100 : 0
      const pctNB = total>0 ? (b.nonBillable/total)*100 : 0
      const pctA = total>0 ? (b.absence/total)*100 : 0
      lines.push(`#calendar-breakdown [data-brk-b="${i}"]{width:${pctB.toFixed(2)}%;}`)
      lines.push(`#calendar-breakdown [data-brk-nb="${i}"]{width:${pctNB.toFixed(2)}%;}`)
      lines.push(`#calendar-breakdown [data-brk-a="${i}"]{width:${pctA.toFixed(2)}%;}`)
    })
    return lines.join('\n')
  }, [projectsBreakdown, periodSummary.totalHours])
  useAggregatedDynamicCss('calendar-breakdown', breakdownCss)

  // Precompute dynamic CSS for week and month fills (avoid calling hooks inside render helpers)
  const weekCss = useMemo(()=>{
    const weekDays = getWeekDays(currentDate)
    return weekDays.map((day,i)=>{
      const entries = getEntriesForDate(day).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
      const agg = summarize(entries as any)
      const cap = 8
      const b = Math.min(agg.billable, cap)
      const nb = Math.min(agg.nonBillable, Math.max(0, cap - b))
      const a = Math.min(agg.absence, Math.max(0, cap - b - nb))
      const pctB = (b / cap) * 100
      const pctNB = (nb / cap) * 100
      const pctA = (a / cap) * 100
      return [
        `#calendar-week [data-week-fill-b="${i}"]{width:${pctB.toFixed(2)}%;}`,
        `#calendar-week [data-week-fill-nb="${i}"]{width:${pctNB.toFixed(2)}%;}`,
        `#calendar-week [data-week-fill-a="${i}"]{width:${pctA.toFixed(2)}%;}`,
      ].join('\n')
    }).join('\n')
  }, [currentDate, entriesByDate, enhancedProjects])
  useAggregatedDynamicCss('calendar-week', weekCss)

  // Prefetch next/previous week CSS (lightweight) to avoid layout flash on fast navigation
  const weekCssPrefetchRef = useRef<Record<string,string>>({})
  useEffect(()=>{
    const key = currentDate.toISOString().slice(0,10)+':'+viewMode
    if(!weekCssPrefetchRef.current[key]) weekCssPrefetchRef.current[key]=weekCss
    if(viewMode==='week'){
      const prev = new Date(currentDate); prev.setDate(prev.getDate()-7)
      const next = new Date(currentDate); next.setDate(next.getDate()+7)
      ;[prev,next].forEach(d=>{
        const w = getWeekDays(d)
        const css = w.map((day,i)=>{
          const entries = getEntriesForDate(day).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
          const agg = summarize(entries as any)
          const cap = 8
          const b = Math.min(agg.billable, cap)
          const nb = Math.min(agg.nonBillable, Math.max(0, cap - b))
          const a = Math.min(agg.absence, Math.max(0, cap - b - nb))
          const pctB = (b / cap) * 100
          const pctNB = (nb / cap) * 100
          const pctA = (a / cap) * 100
          return [
            `#calendar-week [data-week-fill-b="${i}"]{width:${pctB.toFixed(2)}%;}`,
            `#calendar-week [data-week-fill-nb="${i}"]{width:${pctNB.toFixed(2)}%;}`,
            `#calendar-week [data-week-fill-a="${i}"]{width:${pctA.toFixed(2)}%;}`,
          ].join('\n')
        }).join('\n')
        weekCssPrefetchRef.current[d.toISOString().slice(0,10)+':week']=css
      })
    }
  }, [currentDate, viewMode, weekCss, getWeekDays, enhancedProjects])

  const monthCss = useMemo(()=>{
    const days = getDaysInMonth(currentDate)
    const out: string[] = []
    days.forEach(d=>{
      if(d===null) return
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
      const entries = getEntriesForDate(date).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
      const agg = summarize(entries as any)
      const cap = 8
      const b = Math.min(agg.billable, cap)
      const nb = Math.min(agg.nonBillable, Math.max(0, cap - b))
      const a = Math.min(agg.absence, Math.max(0, cap - b - nb))
      const pctB = (b / cap) * 100
      const pctNB = (nb / cap) * 100
      const pctA = (a / cap) * 100
      out.push(`#calendar-month [data-month-fill-b="${d}"]{width:${pctB.toFixed(2)}%;}`)
      out.push(`#calendar-month [data-month-fill-nb="${d}"]{width:${pctNB.toFixed(2)}%;}`)
      out.push(`#calendar-month [data-month-fill-a="${d}"]{width:${pctA.toFixed(2)}%;}`)
    })
    return out.join('\n')
  }, [currentDate, entriesByDate, enhancedProjects])
  useAggregatedDynamicCss('calendar-month', monthCss)

  // Prefetch previous/next month CSS similarly (cheap computation)
  const monthCssPrefetchRef = useRef<Record<string,string>>({})
  useEffect(()=>{
    const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`
    if(!monthCssPrefetchRef.current[key]) monthCssPrefetchRef.current[key]=monthCss
    if(viewMode==='month'){
      const prev = new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1)
      const next = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1)
      ;[prev,next].forEach(m=>{
        const days = getDaysInMonth(m)
        const out: string[] = []
        days.forEach(d=>{
          if(d===null) return;
          const date=new Date(m.getFullYear(), m.getMonth(), d)
          const entries=getEntriesForDate(date).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
          const agg = summarize(entries as any)
          const cap = 8
          const b = Math.min(agg.billable, cap)
          const nb = Math.min(agg.nonBillable, Math.max(0, cap - b))
          const a = Math.min(agg.absence, Math.max(0, cap - b - nb))
          const pctB = (b / cap) * 100
          const pctNB = (nb / cap) * 100
          const pctA = (a / cap) * 100
          out.push(`#calendar-month [data-month-fill-b="${d}"]{width:${pctB.toFixed(2)}%;}`)
          out.push(`#calendar-month [data-month-fill-nb="${d}"]{width:${pctNB.toFixed(2)}%;}`)
          out.push(`#calendar-month [data-month-fill-a="${d}"]{width:${pctA.toFixed(2)}%;}`)
        })
        monthCssPrefetchRef.current[`${m.getFullYear()}-${m.getMonth()}`]=out.join('\n')
      })
    }
  }, [currentDate, viewMode, monthCss, enhancedProjects])

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)
    return (
      <div
        id="calendar-week"
        className="grid grid-cols-7 gap-2 md:gap-2 relative"
        data-compact=""
      >
        {weekDays.map(day=>{
          const entries = getEntriesForDate(day).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
          let displayEntries:DayDisplayEntry[] = entries
          if(aggregateDayEntries && entries.length>0){
            const grouped: Record<string, AggregatedDayEntry> = {}
            for(const e of entries){
              if(!grouped[e.projectId]) grouped[e.projectId] = { ...e, aggregated:true, count:1 }
              else { grouped[e.projectId].hours += e.hours; grouped[e.projectId].count += 1 }
            }
            displayEntries = Object.values(grouped).sort((a,b)=> b.hours - a.hours)
          }
          const dayAgg = summarize(entries as any)
          const total = dayAgg.total
          const billable = dayAgg.billable
          const nonBillable = dayAgg.nonBillable
          const absence = dayAgg.absence
          const reportedPct = (total/8)*100
          const isToday = day.toDateString() === new Date().toDateString()
          const isWeekend = day.getDay()===0 || day.getDay()===6
          const holiday = isDayOff(dateIso(day))
          const active = isActiveDay(day)
          // KPI coloring duplicated from month view for consistency
          const targetHours = 8
          const kpiThreshold = targetHours * 0.99
          const fillRatio = total / targetHours
          const baseHue = '#174076'
          const hexToRgba = (hex:string, alpha:number) => {
            const h = hex.replace('#','')
            const r = parseInt(h.substring(0,2),16)
            const g = parseInt(h.substring(2,4),16)
            const b = parseInt(h.substring(4,6),16)
            return `rgba(${r},${g},${b},${alpha})`
          }
          // removed unused fillColor logic (visual not applied)
          const weekdayShort = dayNames[(day.getDay()+6)%7]
          return (
            <div key={day.toISOString()} data-weekend={isWeekend || undefined} className={`p-2 h-52 border rounded-xl transition-colors overflow-hidden flex flex-col group ${active? 'bg-card dark:bg-[var(--surface-alt)] hover:bg-card/95 dark:hover:bg-[var(--surface-hover)]':'bg-muted/10 opacity-40'} ${isWeekend? 'bg-neutral-100/80 dark:!bg-[var(--surface-accent)]':''} ${holiday? 'bg-amber-50 dark:bg-amber-900/20':''} ${isToday && active? 'ring-2 ring-[#6eedd9]':''}`}>
              {/* Header (aligned with month view) */}
              <div className="flex items-start justify-between mb-1">
                <div className="leading-none">
                  <div className="text-[10px] uppercase tracking-wide text-muted-token font-medium">{weekdayShort}</div>
                  <div className={`font-bold ${isToday? 'text-lg':'text-base'}`}>{day.getDate()}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {holiday && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">OFF</span>}
                  {total>0 && active && (
                    <div className="text-[10px] text-muted-token font-medium tabular-nums">
                      {total.toFixed(1)}h
                      <span className="ml-1 text-[9px] text-muted-token opacity-70">{reportedPct.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Entries list (scrollable like month) */}
              {entries.length>0 && active ? (
                <div className="flex-1 relative overflow-y-auto hide-scrollbar pr-1 space-y-1">
                  {displayEntries.map(e=>{
                    const project = e.project as BasicProject | undefined
                    const tooltipParts = [project?.name||'Project']
                    if(project?.client) tooltipParts.push(`Client: ${project.client}`)
                    if((e as AggregatedDayEntry).aggregated){ tooltipParts.push(`Aggregated from ${(e as AggregatedDayEntry).count} entries`) }
                    const dotType = isAbsenceProject(e.projectId, project?.code, project?.name)
                      ? 'absence'
                      : e.billable
                        ? 'billable'
                        : 'nonbillable'
                    return (
            <div key={e.id} title={tooltipParts.join('\n')} className="flex items-center justify-between text-[11px] rounded-md px-1 py-0.5 bg-background/60 dark:bg-[color:var(--surface-overlay)_/_35] border border-border/40 dark:border-white/10">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 dot-${dotType}`} />
                          <button type="button" onClick={(ev)=>{ev.stopPropagation(); setSelectedProjectId(project?.id||null)}} className="truncate max-w-[74px] text-left hover:underline focus:outline-none">
                            {project?.code||e.projectId}{(e as AggregatedDayEntry).aggregated && (e as AggregatedDayEntry).count>1 ? ` (${(e as AggregatedDayEntry).count})` : ''}
                          </button>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 tabular-nums"><span>{e.hours.toFixed(1)}h</span></div>
                      </div>
                    )
                  })}
                  {!aggregateDayEntries && displayEntries.length < entries.length && <div className="text-[10px] text-muted-token">Hidden: {entries.length - displayEntries.length}</div>}
                  {/* Fade mask removed per request */}
                </div>
              ) : <div className="text-[11px] text-muted-token mt-2 flex-1 flex items-center">{active? 'No entries':'Inactive'}</div>}
              {/* Footer summary with segmented KPI progress bar (B / NB / A) */}
              <div className="pt-1 mt-1 border-t border-dashed">
                <div className="h-2 w-full rounded-full bg-muted relative overflow-hidden mb-1" title={`B ${billable.toFixed(1)}h • NB ${nonBillable.toFixed(1)}h • A ${absence.toFixed(1)}h — Total ${total.toFixed(1)}h / 8h (${reportedPct.toFixed(0)}%)`}>
                  {/* Base overlay */}
                  <div className="absolute inset-0 bg-gray-200/40 dark:bg-[color:var(--surface-overlay)_/_25]" />
                  {/* Segments container */}
                  <div className="absolute inset-y-0 left-0 right-0 flex overflow-hidden rounded-full">
                    <div className="h-full flex-none bg-[#6eedd9] transition-[width] duration-700" data-week-fill-b={weekDays.indexOf(day)} />
                    <div className="h-full flex-none bg-[#174076] transition-[width] duration-700" data-week-fill-nb={weekDays.indexOf(day)} />
                    <div className="h-full flex-none bg-[#e03768] transition-[width] duration-700" data-week-fill-a={weekDays.indexOf(day)} />
                  </div>
                  {/* Over-target visual rings */}
                  {total>targetHours && total <= targetHours*1.10 && <div className="absolute inset-0 ring-1 ring-emerald-500/30" />}
                  {total>targetHours*1.10 && total <= targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-amber-500/40" />}
                  {total>targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-red-500/50" />}
                </div>
                <div className="flex justify-between text-[9px] font-medium tabular-nums opacity-80">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#6eedd9]" />B {billable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#174076]" />NB {nonBillable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#e03768]" />A {absence.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate)
    return (
      <div id="calendar-month" className="grid grid-cols-7 gap-2">
        {days.map((d,i)=>{
          if(d===null) return <div key={`pad-${i}`} className="p-2 h-28" />
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
          const entries = getEntriesForDate(date).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
          const dayAgg = summarize(entries as any)
          const total = dayAgg.total
          const billable = dayAgg.billable
          const nonBillable = dayAgg.nonBillable
          const absence = dayAgg.absence
          const reportedPct = (total/8)*100
          const isToday = date.toDateString() === new Date().toDateString()
          const isWeekend = date.getDay()===0 || date.getDay()===6
          const holiday = isDayOff(dateIso(date))
          const active = isActiveDay(date)
          // Aggregation logic (group by projectId) if toggle enabled
          let displayEntries:DayDisplayEntry[] = entries
          if(aggregateDayEntries && entries.length>0){
            const grouped: Record<string, AggregatedDayEntry> = {}
            for(const e of entries){
              if(!grouped[e.projectId]) grouped[e.projectId] = { ...e, aggregated:true, count:1 }
              else { grouped[e.projectId].hours += e.hours; grouped[e.projectId].count += 1 }
            }
            displayEntries = Object.values(grouped).sort((a,b)=> b.hours - a.hours)
          }
          const weekdayShort = dayNames[(date.getDay()+6)%7]
          // New KPI-driven coloring: only change hue when KPI (>=99% of target) reached.
          const targetHours = 8
          const kpiThreshold = targetHours * 0.99 // 99% KPI
          const fillRatio = total / targetHours
          // Base monochrome (blue) with opacity scaling before KPI
          const baseHue = '#174076'
          // Helper to convert hex to rgba with dynamic alpha
          const hexToRgba = (hex:string, alpha:number) => {
            const h = hex.replace('#','')
            const r = parseInt(h.substring(0,2),16)
            const g = parseInt(h.substring(2,4),16)
            const b = parseInt(h.substring(4,6),16)
            return `rgba(${r},${g},${b},${alpha})`
          }
          // removed unused fillColor logic (visual not applied)
          return (
            <div key={d} className={`p-2 h-52 border rounded-xl transition-colors overflow-hidden flex flex-col group ${active? 'bg-card dark:bg-[var(--surface-alt)] hover:bg-card/95 dark:hover:bg-[var(--surface-hover)]':'bg-muted/10 opacity-40'} ${isWeekend? 'bg-neutral-100/80 dark:!bg-[var(--surface-accent)]':''} ${holiday? 'bg-amber-50 dark:bg-amber-900/20':''} ${isToday && active? 'ring-2 ring-[#6eedd9]':''}`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="leading-none">
                  <div className="text-[10px] uppercase tracking-wide text-muted-token font-medium">{weekdayShort}</div>
                  <div className={`font-bold ${isToday? 'text-lg':'text-base'}`}>{d}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {holiday && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">OFF</span>}
                  {total>0 && active && (
                    <div className="text-[10px] text-muted-token font-medium tabular-nums">
                      {total.toFixed(1)}h
                      <span className="ml-1 text-[9px] text-muted-token opacity-70">{reportedPct.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Entries list */}
              {entries.length>0 && active ? (
                <div className="flex-1 relative overflow-y-auto hide-scrollbar pr-1 space-y-1">
                  {displayEntries.map(e=>{
                    const project = e.project as BasicProject | undefined
                    const tooltipParts = [project?.name||'Project']
                    if(project?.client) tooltipParts.push(`Client: ${project.client}`)
                    if((e as AggregatedDayEntry).aggregated){ tooltipParts.push(`Aggregated from ${(e as AggregatedDayEntry).count} entries`) }
                    const dotType = isAbsenceProject(e.projectId, project?.code, project?.name)
                      ? 'absence'
                      : e.billable
                        ? 'billable'
                        : 'nonbillable'
                    return (
            <div key={e.id} title={tooltipParts.join('\n')} className="flex items-center justify-between text-[11px] rounded-md px-1 py-0.5 bg-background/60 dark:bg-[color:var(--surface-overlay)_/_35] border border-border/40 dark:border-white/10">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 dot-${dotType}`} />
                          <button type="button" onClick={(ev)=>{ev.stopPropagation(); setSelectedProjectId(project?.id||null)}} className="truncate max-w-[74px] text-left hover:underline focus:outline-none">
                            {project?.code||e.projectId}{(e as AggregatedDayEntry).aggregated && (e as AggregatedDayEntry).count>1 ? ` (${(e as AggregatedDayEntry).count})` : ''}
                          </button>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 tabular-nums"><span>{e.hours.toFixed(1)}h</span></div>
                      </div>
                    )
                  })}
                  {!aggregateDayEntries && displayEntries.length < entries.length && <div className="text-[10px] text-muted-token">Hidden: {entries.length - displayEntries.length}</div>}
                  {/* Fade mask when overflow (approx condition) */}
                  {/* Fade mask removed per request */}
                </div>
              ) : <div className="text-[11px] text-muted-token mt-2 flex-1 flex items-center">{active? 'No entries':'Inactive'}</div>}
              {/* Footer summary with segmented KPI progress bar (B / NB / A) */}
              <div className="pt-1 mt-1 border-t border-dashed">
                <div className="h-2 w-full rounded-full bg-muted relative overflow-hidden mb-1" title={`B ${billable.toFixed(1)}h • NB ${nonBillable.toFixed(1)}h • A ${absence.toFixed(1)}h — Total ${total.toFixed(1)}h / 8h (${reportedPct.toFixed(0)}%)`}>
                  {/* Base overlay */}
                  <div className="absolute inset-0 bg-gray-200/40 dark:bg-[color:var(--surface-overlay)_/_25]" />
                  {/* Segments container */}
                  <div className="absolute inset-y-0 left-0 right-0 flex overflow-hidden rounded-full">
                    <div className="h-full flex-none bg-[#6eedd9] transition-[width] duration-700" data-month-fill-b={d} />
                    <div className="h-full flex-none bg-[#174076] transition-[width] duration-700" data-month-fill-nb={d} />
                    <div className="h-full flex-none bg-[#e03768] transition-[width] duration-700" data-month-fill-a={d} />
                  </div>
                  {/* Over-target visual rings */}
                  {total>targetHours && total <= targetHours*1.10 && <div className="absolute inset-0 ring-1 ring-emerald-500/30" />}
                  {total>targetHours*1.10 && total <= targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-amber-500/40" />}
                  {total>targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-red-500/50" />}
                </div>
                <div className="flex justify-between text-[9px] font-medium tabular-nums opacity-80">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#6eedd9]" />B {billable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#174076]" />NB {nonBillable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#e03768]" />A {absence.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Mobile list fallback (grouped by day within active scope range)
  const renderMobileList = () => {
    // Determine days in current visible frame (week or month) similar to grid logic
    const days: Date[] = viewMode==='week'
      ? getWeekDays(currentDate)
      : (()=>{ const arr:Date[]=[]; const base=new Date(currentDate.getFullYear(), currentDate.getMonth(),1); const end=new Date(currentDate.getFullYear(), currentDate.getMonth()+1,0); for(let d=1; d<=end.getDate(); d++){ arr.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d)) } return arr })()
    return (
      <div className="space-y-3">
        {days.map(day=>{
          const dateKey = dateIso(day)
          const entriesRaw = (entriesByDate[dateKey]||[]).map(e=> ({...e, project: enhancedProjects.find(p=>p.id===e.projectId)}))
          const total = entriesRaw.reduce((s,e)=>s+e.hours,0)
          if(!isActiveDay(day) && total===0) return null
          // Aggregation reuse
          let displayEntries:DayDisplayEntry[] = entriesRaw
          if(aggregateDayEntries && entriesRaw.length>0){
            const grouped: Record<string, AggregatedDayEntry> = {}
            for(const e of entriesRaw){ if(!grouped[e.projectId]) grouped[e.projectId]={...e, aggregated:true, count:1}; else { grouped[e.projectId].hours+=e.hours; grouped[e.projectId].count+=1 } }
            displayEntries = Object.values(grouped).sort((a,b)=> b.hours - a.hours)
          }
          const dayAgg = summarize(entriesRaw as any)
          const absence = dayAgg.absence
          const billable = dayAgg.billable
          const nonBillable = dayAgg.nonBillable
          const weekdayShort = dayNames[(day.getDay()+6)%7]
          const isToday = day.toDateString()=== new Date().toDateString()
          return (
            <div key={dateKey} className={`border rounded-lg p-3 ${isToday? 'ring-1 ring-[#6eedd9]':''} bg-card dark:bg-[var(--surface-alt)]`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wide text-muted-token">{weekdayShort}</span>
                  <span className="font-semibold text-sm">{dateKey}</span>
                </div>
                {total>0 && <div className="text-xs font-medium tabular-nums">{total.toFixed(1)}h</div>}
              </div>
              {displayEntries.length>0 ? (
                <div className="space-y-1">
                  {displayEntries.map(e=>{
                    const project = (e as any).project as BasicProject | undefined
                    const dotType = isAbsenceProject(e.projectId, project?.code, project?.name) ? 'absence' : e.billable ? 'billable':'nonbillable'
                    return (
                      <div key={e.id} className="flex items-center justify-between text-[12px] bg-background/50 dark:bg-[color:var(--surface-overlay)_/_25] rounded-md px-2 py-1">
                        <button type="button" onClick={()=> setSelectedProjectId(project?.id||null)} className="flex items-center gap-2 truncate max-w-[180px]">
                          <span className={`w-2 h-2 rounded-full dot-${dotType}`}/>
                          <span className="truncate font-mono text-[11px]">{project?.code||e.projectId}{(e as AggregatedDayEntry).aggregated && (e as AggregatedDayEntry).count>1 ? `(${(e as AggregatedDayEntry).count})`: ''}</span>
                        </button>
                        <span className="tabular-nums">{e.hours.toFixed(1)}h</span>
                      </div>
                    )
                  })}
                </div>
              ) : <div className="text-[11px] text-muted-token">No entries</div>}
              <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-token opacity-80 tabular-nums">
                <span>B {billable.toFixed(1)}</span>
                <span>NB {nonBillable.toFixed(1)}</span>
                <span>A {absence.toFixed(1)}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Keyboard & pointer (swipe) navigation -------------------------------------
  useEffect(()=>{
    const el = gestureRef.current
    if(!el) return
    const handlePointerDown = (e:PointerEvent)=>{
      // Only primary button / touch
      if(e.isPrimary) dragStart.current = { x:e.clientX, y:e.clientY, t:Date.now() }
    }
    const handlePointerUp = (e:PointerEvent)=>{
      if(!dragStart.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      const dt = Date.now() - dragStart.current.t
      dragStart.current = null
      // Basic swipe heuristic: horizontal, short duration, sufficient distance
      const threshold = 48
      if(Math.abs(dx) > threshold && Math.abs(dy) < 80 && dt < 1000){
        if(dx < 0){
          // swipe left -> go forward
          viewMode==='week' ? navigateWeek('next') : navigateMonth('next')
        } else {
          // swipe right -> go backward
          viewMode==='week' ? navigateWeek('prev') : navigateMonth('prev')
        }
      }
    }
    el.addEventListener('pointerdown', handlePointerDown, { passive:true })
    el.addEventListener('pointerup', handlePointerUp)
    return ()=>{
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointerup', handlePointerUp)
    }
  }, [viewMode])

  const handleKeyNav = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if(e.key === 'ArrowLeft'){
      e.preventDefault(); viewMode==='week'? navigateWeek('prev'): navigateMonth('prev')
    } else if(e.key === 'ArrowRight') {
      e.preventDefault(); viewMode==='week'? navigateWeek('next'): navigateMonth('next')
    } else if(e.key === 'Home') {
      e.preventDefault(); setCurrentDate(new Date())
    }
  }

  // Integrate with MobileOptions via custom events (no prop drilling)
  useEffect(()=>{
    const toggleAgg = () => setAggregateDayEntries(a=>!a)
    const openBreakdown = () => setBreakdownOpen(true)
    const setView = (e: Event) => {
      const ce = e as CustomEvent<{ view?: 'month'|'week' }>
      if(ce.detail?.view === 'month' || ce.detail?.view === 'week') setViewMode(ce.detail.view)
    }
    const goToday = () => setCurrentDate(new Date())
    window.addEventListener('tt:calendar:toggle-aggregate', toggleAgg)
    window.addEventListener('tt:calendar:open-breakdown', openBreakdown)
    window.addEventListener('tt:calendar:set-view', setView)
    window.addEventListener('tt:calendar:go-today', goToday)
    return ()=>{
      window.removeEventListener('tt:calendar:toggle-aggregate', toggleAgg)
      window.removeEventListener('tt:calendar:open-breakdown', openBreakdown)
      window.removeEventListener('tt:calendar:set-view', setView)
      window.removeEventListener('tt:calendar:go-today', goToday)
    }
  }, [])

  return (
    <div
      ref={gestureRef}
      className="space-y-6"
      tabIndex={0}
      onKeyDown={handleKeyNav}
      aria-label="Calendar view. Use left and right arrow keys or swipe horizontally to change the visible period. Press Home to jump to today."
      role="region"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRef} />
      {projectsError && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 rounded">
          Failed to load projects: {projectsError}
        </div>
      )}
  <Card className="dark:bg-[var(--card)]">
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-4 sm:gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none tabular-nums">{periodSummary.totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Total</span><span className="hidden sm:inline">Total Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold leading-none text-billable tabular-nums">{periodSummary.billableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Billable</span><span className="hidden sm:inline">Billable Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9] tabular-nums">{periodSummary.nonBillableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token whitespace-nowrap"><span className="sm:hidden">Non‑billable</span><span className="hidden sm:inline">Non‑billable Hours</span></div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold leading-none text-absence tabular-nums">{periodSummary.absenceHours.toFixed(1)}</div>
              <div className="text-xs text-muted-token"><span className="sm:hidden">Absence</span><span className="hidden sm:inline">Absence Hours</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[var(--card)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            {/* Single row with uniform spacing between all controls */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={()=> viewMode==='week'? navigateWeek('prev'): navigateMonth('prev')} aria-label="Previous period">←</Button>
              <CardTitle className="flex items-center justify-center">
                <span className="inline-block text-center font-semibold tabular-nums w-[220px] truncate">
                  {projectsLoading ? 'Loading…' : (viewMode==='week' ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}` : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`)}
                </span>
              </CardTitle>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={()=> viewMode==='week'? navigateWeek('next'): navigateMonth('next')} aria-label="Next period">→</Button>
              {/* Hide secondary controls on mobile – available in Options drawer */}
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs hidden sm:inline-flex" onClick={()=> setCurrentDate(new Date())} title="Jump to today">Today</Button>
              <div className="hidden sm:flex gap-0 rounded-md overflow-hidden shadow-xs border bg-muted/40" role="toolbar" aria-label="Calendar view mode">
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='month'}
                  aria-pressed={viewMode==='month'}
                  onClick={()=>setViewMode('month')}
                  className="h-8 px-3 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
                >Month</Button>
                <Button
                  variant="segmented"
                  size="sm"
                  data-active={viewMode==='week'}
                  aria-pressed={viewMode==='week'}
                  onClick={()=>setViewMode('week')}
                  className="h-8 px-3 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
                >Week</Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="surface"
                data-active={aggregateDayEntries}
                aria-pressed={aggregateDayEntries}
                onClick={()=>setAggregateDayEntries(a=>!a)}
                className="h-8 px-3 text-xs hidden sm:inline-flex"
                title="Toggle aggregation of same-project entries per day"
              >
                {aggregateDayEntries ? 'Aggregated' : 'Aggregate'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="surface"
                data-active={breakdownOpen}
                aria-pressed={breakdownOpen}
                onClick={()=> setBreakdownOpen(true)}
                className="h-8 px-3 text-xs hidden sm:inline-flex"
                title="Show projects breakdown for the visible period"
              >
                Breakdown
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            renderMobileList()
          ) : viewMode==='week' ? (
            <div className="relative">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map(d=> <div key={d} className="p-2 text-center text-sm font-medium text-muted-token">{d}</div>)}
              </div>
              {renderWeekView()}
            </div>
          ) : (
            <div className="relative">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map(d=> <div key={d} className="p-2 text-center text-sm font-medium text-muted-token">{d}</div>)}
              </div>
              {renderMonthView()}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Right-side drawer with projects breakdown */}
      <Sheet open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full">
          <SheetHeader>
            <SheetTitle>Projects breakdown</SheetTitle>
            <SheetDescription>
              {viewMode==='week' ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}` : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`} • {projectsBreakdown.length} projects • {periodSummary.totalHours.toFixed(1)}h
            </SheetDescription>
            <div className="pt-1 flex items-center gap-2 text-xs">
              <span className="text-muted-token">Sort by</span>
              <Select value={breakdownSort} onValueChange={(v)=> setBreakdownSort(v as typeof breakdownSort)}>
                <SelectTrigger className="h-7 w-[200px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total-desc">Total hours (desc)</SelectItem>
                  <SelectItem value="billable-desc">Billable hours (desc)</SelectItem>
                  <SelectItem value="nonbillable-desc">Non-billable hours (desc)</SelectItem>
                  <SelectItem value="absence-desc">Absence hours (desc)</SelectItem>
                  <SelectItem value="code-asc">Code (A→Z)</SelectItem>
                  <SelectItem value="name-asc">Name (A→Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>
          <div id="calendar-breakdown" className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] text-muted-token">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6eedd9]"/>B</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#174076]"/>NB</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e03768]"/>A</span>
            </div>
            <div className="divide-y rounded-md border overflow-hidden">
              {projectsBreakdown.length === 0 ? (
                <div className="p-3 text-sm text-muted-token">No entries in this period.</div>
              ) : projectsBreakdown.map((b,i)=>{
                const share = periodSummary.totalHours>0 ? (b.total/periodSummary.totalHours)*100 : 0
                const isAbs = isAbsenceProject(b.project.id, (b.project as any).code, (b.project as any).name)
                const dotType = isAbs ? 'absence' : (b.billable >= b.nonBillable ? 'billable' : 'nonbillable')
                return (
                  <button
                    key={b.project.id}
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
                    onClick={()=>{ setSelectedProjectId(b.project.id); setBreakdownOpen(false) }}
                    title={`${b.project.name}${b.project.client? ` • ${b.project.client}`:''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full shrink-0 dot-${dotType}`} />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-semibold truncate">{b.project.code || b.project.id}</div>
                          <div className="text-[11px] text-muted-token truncate">{b.project.name}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-medium tabular-nums">{b.total.toFixed(1)}h</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 flex">
                          <span className="h-full bg-[#6eedd9]" data-brk-b={i} />
                          <span className="h-full bg-[#174076]" data-brk-nb={i} />
                          <span className="h-full bg-[#e03768]" data-brk-a={i} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-token">
                        <span title="Billable">B {b.billable.toFixed(1)}</span>
                        <span title="Non-billable">NB {b.nonBillable.toFixed(1)}</span>
                        <span title="Absence">A {b.absence.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-token">Share: {share.toFixed(1)}%</div>
                  </button>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
  {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          entries={currentScopeEntries}
          scopeLabel={`current ${viewMode==='week'? 'week':'month'} entries only`}
          onClose={()=>setSelectedProjectId(null)}
        />
      )}
    </div>
  )
}
