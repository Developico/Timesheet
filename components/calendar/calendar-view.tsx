"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useProjects, type BasicProject } from "@/hooks/use-projects"
import { useConsultants, type BasicConsultant } from "@/hooks/use-consultants"
import { useAuth } from "@/lib/auth-client"
import { useViewingScope } from "@/lib/viewing-scope"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useDaysOff } from "../../hooks/use-days-off"
import { useFilters } from "@/lib/filter-context"

interface CalendarEntry { id:string; date:string; projectId:string; hours:number; billable:boolean; description?:string }
interface AggregatedDayEntry extends CalendarEntry { aggregated: true; count: number; project?: BasicProject }
type DayDisplayEntry = CalendarEntry & { project?: BasicProject } | AggregatedDayEntry

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
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
    id:e.id, date:e.date, projectId:e.projectId, hours:e.hours, billable:e.billable, description:e.description
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
    if(viewMode==='week') return getWeekDays(currentDate).flatMap(d=>getEntriesForDate(d))
    const y = currentDate.getFullYear(); const m = currentDate.getMonth()
    return calendarEntries.filter(e=>{ const d=new Date(e.date); return d.getFullYear()===y && d.getMonth()===m })
  }, [viewMode, currentDate, calendarEntries])
  const periodSummary = {
    totalHours: currentScopeEntriesAll.reduce((s,e)=>s+e.hours,0),
    billableHours: currentScopeEntriesAll.filter(e=>e.billable).reduce((s,e)=>s+e.hours,0),
    nonBillableHours: currentScopeEntriesAll.filter(e=>!e.billable).reduce((s,e)=>s+e.hours,0),
    absenceHours: currentScopeEntriesAll.filter(e=>e.projectId==='Office.Absences').reduce((s,e)=>s+e.hours,0),
  }

  // Precompute dynamic CSS for week and month fills (avoid calling hooks inside render helpers)
  const weekCss = useMemo(()=>{
    const weekDays = getWeekDays(currentDate)
    return weekDays.map((day,i)=>{
      const entries = getEntriesForDate(day)
      const total = entries.reduce((s,e)=>s+e.hours,0)
      const pct = Math.min((total/8)*100,125)
      return `#calendar-week [data-week-fill="${i}"]{width:${pct.toFixed(2)}%;}`
    }).join('\n')
  }, [currentDate, entriesByDate])
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
          const entries = getEntriesForDate(day)
          const total = entries.reduce((s,e)=>s+e.hours,0)
          const pct = Math.min((total/8)*100,125)
          return `#calendar-week [data-week-fill="${i}"]{width:${pct.toFixed(2)}%;}`
        }).join('\n')
        weekCssPrefetchRef.current[d.toISOString().slice(0,10)+':week']=css
      })
    }
  }, [currentDate, viewMode, weekCss, getWeekDays])

  const monthCss = useMemo(()=>{
    const days = getDaysInMonth(currentDate)
    const out: string[] = []
    days.forEach(d=>{
      if(d===null) return
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
      const entries = getEntriesForDate(date)
      const total = entries.reduce((s,e)=>s+e.hours,0)
      const pct = Math.min((total/8)*100,125)
      out.push(`#calendar-month [data-month-fill="${d}"]{width:${pct.toFixed(2)}%;}`)
    })
    return out.join('\n')
  }, [currentDate, entriesByDate])
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
        days.forEach(d=>{ if(d===null) return; const date=new Date(m.getFullYear(), m.getMonth(), d); const entries=getEntriesForDate(date); const total=entries.reduce((s,e)=>s+e.hours,0); const pct=Math.min((total/8)*100,125); out.push(`#calendar-month [data-month-fill="${d}"]{width:${pct.toFixed(2)}%;}`) })
        monthCssPrefetchRef.current[`${m.getFullYear()}-${m.getMonth()}`]=out.join('\n')
      })
    }
  }, [currentDate, viewMode, monthCss])

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
          const total = entries.reduce((s,e)=>s+e.hours,0)
          const absence = entries.filter(e=>e.projectId==='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const billable = entries.filter(e=>e.billable && e.projectId!=='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const nonBillable = total - billable - absence
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
            <div key={day.toISOString()} data-weekend={isWeekend || undefined} className={`p-2 h-52 border rounded-xl transition-colors overflow-hidden flex flex-col group ${active? 'bg-card dark:bg-[oklch(0.19_0_0)] hover:bg-card/95 dark:hover:bg-[oklch(0.21_0_0)]':'bg-muted/10 opacity-40'} ${isWeekend? 'bg-neutral-100/80 dark:!bg-[oklch(0.26_0_0)]':''} ${holiday? 'bg-amber-50 dark:bg-amber-900/20':''} ${isToday && active? 'ring-2 ring-[#6eedd9]':''}`}> 
              {/* Header (aligned with month view) */}
              <div className="flex items-start justify-between mb-1">
                <div className="leading-none">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{weekdayShort}</div>
                  <div className={`font-bold ${isToday? 'text-lg':'text-base'}`}>{day.getDate()}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {holiday && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">OFF</span>}
                  {total>0 && active && (
                    <div className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      {total.toFixed(1)}h
                      <span className="ml-1 text-[9px] text-muted-foreground/70">{reportedPct.toFixed(0)}%</span>
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
                    const dotType = project?.id === 'Office.Absences' || project?.code === 'ABS' || project?.name?.toLowerCase().includes('absence')
                      ? 'absence'
                      : e.billable
                        ? 'billable'
                        : 'nonbillable'
                    return (
            <div key={e.id} title={tooltipParts.join('\n')} className="flex items-center justify-between text-[11px] rounded-md px-1 py-0.5 bg-background/60 dark:bg-white/8 border border-border/40 dark:border-white/10">
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
                  {!aggregateDayEntries && displayEntries.length < entries.length && <div className="text-[10px] text-muted-foreground">Hidden: {entries.length - displayEntries.length}</div>}
                  {/* Fade mask removed per request */}
                </div>
              ) : <div className="text-[11px] text-muted-foreground mt-2 flex-1 flex items-center">{active? 'No entries':'Inactive'}</div>}
              {/* Footer summary with KPI progress bar */}
              <div className="pt-1 mt-1 border-t border-dashed">
                <div className="h-2 w-full rounded-full bg-muted relative overflow-hidden mb-1" title={`${total.toFixed(1)}h / 8h (${reportedPct.toFixed(0)}%)`}>
                  <div className="h-full transition-all bg-gray-200/40 dark:bg-white/10 relative overflow-hidden rounded-full">
                    <div data-week-fill={weekDays.indexOf(day)} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#174076] to-[#174076]/80 transition-all duration-700" />
                  </div>
                  {total>targetHours && total <= targetHours*1.10 && <div className="absolute inset-0 ring-1 ring-emerald-500/30" />}
                  {total>targetHours*1.10 && total <= targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-amber-500/40" />}
                  {total>targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-red-500/50" />}
                </div>
                <div className="flex justify-between text-[9px] font-medium tabular-nums opacity-80">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-600" />B {billable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#174076]" />NB {nonBillable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />A {absence.toFixed(1)}</span>
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
          const total = entries.reduce((s,e)=>s+e.hours,0)
          const absence = entries.filter(e=>e.projectId==='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const billable = entries.filter(e=>e.billable && e.projectId!=='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const nonBillable = total - billable - absence
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
            <div key={d} className={`p-2 h-52 border rounded-xl transition-colors overflow-hidden flex flex-col group ${active? 'bg-card dark:bg-[oklch(0.19_0_0)] hover:bg-card/95 dark:hover:bg-[oklch(0.21_0_0)]':'bg-muted/10 opacity-40'} ${isWeekend? 'bg-neutral-100/80 dark:!bg-[oklch(0.26_0_0)]':''} ${holiday? 'bg-amber-50 dark:bg-amber-900/20':''} ${isToday && active? 'ring-2 ring-[#6eedd9]':''}`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="leading-none">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{weekdayShort}</div>
                  <div className={`font-bold ${isToday? 'text-lg':'text-base'}`}>{d}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {holiday && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">OFF</span>}
                  {total>0 && active && (
                    <div className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      {total.toFixed(1)}h
                      <span className="ml-1 text-[9px] text-muted-foreground/70">{reportedPct.toFixed(0)}%</span>
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
                    const dotType = project?.id === 'Office.Absences' || project?.code === 'ABS' || project?.name?.toLowerCase().includes('absence')
                      ? 'absence'
                      : e.billable
                        ? 'billable'
                        : 'nonbillable'
                    return (
            <div key={e.id} title={tooltipParts.join('\n')} className="flex items-center justify-between text-[11px] rounded-md px-1 py-0.5 bg-background/60 dark:bg-white/8 border border-border/40 dark:border-white/10">
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
                  {!aggregateDayEntries && displayEntries.length < entries.length && <div className="text-[10px] text-muted-foreground">Hidden: {entries.length - displayEntries.length}</div>}
                  {/* Fade mask when overflow (approx condition) */}
                  {/* Fade mask removed per request */}
                </div>
              ) : <div className="text-[11px] text-muted-foreground mt-2 flex-1 flex items-center">{active? 'No entries':'Inactive'}</div>}
              {/* Footer summary */}
              <div className="pt-1 mt-1 border-t border-dashed">
                <div className="h-2 w-full rounded-full bg-muted relative overflow-hidden mb-1" title={`${total.toFixed(1)}h / 8h (${reportedPct.toFixed(0)}%)`}>
                  <div className="h-full transition-all bg-gray-200/40 dark:bg-white/10 relative overflow-hidden rounded-full">
                    <div data-month-fill={d} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#174076] to-[#174076]/80 transition-all duration-700" />
                  </div>
                  {total>targetHours && total <= targetHours*1.10 && <div className="absolute inset-0 ring-1 ring-emerald-500/30" />}
                  {total>targetHours*1.10 && total <= targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-amber-500/40" />}
                  {total>targetHours*1.25 && <div className="absolute inset-0 ring-1 ring-red-500/50" />}
                </div>
                <div className="flex justify-between text-[9px] font-medium tabular-nums opacity-80">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-600" />B {billable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#174076]" />NB {nonBillable.toFixed(1)}</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />A {absence.toFixed(1)}</span>
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
          const absence = entriesRaw.filter(e=>e.projectId==='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const billable = entriesRaw.filter(e=>e.billable && e.projectId!=='Office.Absences').reduce((s,e)=>s+e.hours,0)
          const nonBillable = total - billable - absence
          const weekdayShort = dayNames[(day.getDay()+6)%7]
          const isToday = day.toDateString()=== new Date().toDateString()
          return (
            <div key={dateKey} className={`border rounded-lg p-3 ${isToday? 'ring-1 ring-[#6eedd9]':''} bg-card dark:bg-[oklch(0.19_0_0)]`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{weekdayShort}</span>
                  <span className="font-semibold text-sm">{dateKey}</span>
                </div>
                {total>0 && <div className="text-xs font-medium tabular-nums">{total.toFixed(1)}h</div>}
              </div>
              {displayEntries.length>0 ? (
                <div className="space-y-1">
                  {displayEntries.map(e=>{
                    const project = (e as any).project as BasicProject | undefined
                    const dotType = project?.id === 'Office.Absences' || project?.code==='ABS' || project?.name?.toLowerCase().includes('absence') ? 'absence' : e.billable ? 'billable':'nonbillable'
                    return (
                      <div key={e.id} className="flex items-center justify-between text-[12px] bg-background/50 dark:bg-white/10 rounded-md px-2 py-1">
                        <button type="button" onClick={()=> setSelectedProjectId(project?.id||null)} className="flex items-center gap-2 truncate max-w-[180px]">
                          <span className={`w-2 h-2 rounded-full dot-${dotType}`}/>
                          <span className="truncate font-mono text-[11px]">{project?.code||e.projectId}{(e as AggregatedDayEntry).aggregated && (e as AggregatedDayEntry).count>1 ? `(${(e as AggregatedDayEntry).count})`: ''}</span>
                        </button>
                        <span className="tabular-nums">{e.hours.toFixed(1)}h</span>
                      </div>
                    )
                  })}
                </div>
              ) : <div className="text-[11px] text-muted-foreground">No entries</div>}
              <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/80 tabular-nums">
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
  <Card className="dark:bg-[oklch(0.18_0_0)]">
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none">{periodSummary.totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-teal-700 leading-none">{periodSummary.billableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9]">{periodSummary.nonBillableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Non-billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-red-600 leading-none">{periodSummary.absenceHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Absence Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[oklch(0.18_0_0)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                {projectsLoading ? 'Loading projects…' : (viewMode==='week' ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}` : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`)}
              </CardTitle>
              <div className="flex gap-2 items-center">
                <div className="flex gap-0 rounded-md overflow-hidden shadow-xs border bg-muted/40" role="toolbar" aria-label="Calendar view mode">
                  <Button
                    variant="segmented"
                    size="sm"
                    data-active={viewMode==='month'}
                    aria-pressed={viewMode==='month'}
                    onClick={()=>setViewMode('month')}
                    className="h-7 px-3 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
                  >Month</Button>
                  <Button
                    variant="segmented"
                    size="sm"
                    data-active={viewMode==='week'}
                    aria-pressed={viewMode==='week'}
                    onClick={()=>setViewMode('week')}
                    className="h-7 px-3 text-xs rounded-none first:rounded-l-md last:rounded-r-md"
                  >Week</Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={aggregateDayEntries? 'default':'outline'}
                  onClick={()=>setAggregateDayEntries(a=>!a)}
                  className="h-7 px-3 text-xs"
                  title="Toggle aggregation of same-project entries per day"
                >
                  {aggregateDayEntries ? 'Aggregated' : 'Aggregate'}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={()=> viewMode==='week'? navigateWeek('prev'): navigateMonth('prev')}>←</Button>
              <Button variant="outline" size="sm" onClick={()=> viewMode==='week'? navigateWeek('next'): navigateMonth('next')}>→</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            renderMobileList()
          ) : viewMode==='week' ? (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map(d=> <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>)}
              </div>
              {renderWeekView()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map(d=> <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>)}
              </div>
              {renderMonthView()}
            </>
          )}
        </CardContent>
      </Card>
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
