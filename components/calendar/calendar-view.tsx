"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  // Default to month view
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const { filteredTimeEntries } = useFilters()
  const projects = dataService.getProjects()

  // Dynamic sample entries for the current month (deterministic pattern)
  interface SampleEntry {
    id: string
    date: string
    projectId: string
    hours: number
    billable: boolean
    description: string
    isAbsence?: boolean
  }

  const sampleTimeEntries: SampleEntry[] = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() // 0-based
    const lastDay = new Date(year, month + 1, 0).getDate()
    const entries: SampleEntry[] = []
    let idCounter = 1

    const pickProject = (day: number) => {
      const projectIds = ["1", "2", "4"] // existing active-ish sample projects
      return projectIds[day % projectIds.length]
    }

    for (let day = 1; day <= lastDay; day++) {
      const dateObj = new Date(year, month, day)
      const dow = dateObj.getDay() // 0 Sun ... 6 Sat
      if (dow === 0 || dow === 6) continue // skip weekends

      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

      // Occasional absence (every 2nd Wednesday if exists)
      if (dow === 3 && (Math.floor(day / 7) % 2 === 0)) {
        entries.push({
          id: String(idCounter++),
            date: dateStr,
            projectId: "vac", // vacation placeholder
            hours: 8,
            billable: false,
            description: "Vacation",
            isAbsence: true,
        })
        continue
      }

      // Main billable block
      const baseHours = 5 + ((day * 37) % 4) // 5..8
      entries.push({
        id: String(idCounter++),
        date: dateStr,
        projectId: pickProject(day),
        hours: baseHours,
        billable: true,
        description: "Billable work",
      })

      // Meeting / internal (some days)
      if (day % 5 === 0) {
        entries.push({
          id: String(idCounter++),
          date: dateStr,
          projectId: "4", // training / dashboard project
          hours: 1.5,
          billable: false,
          description: "Internal meeting",
        })
      }

      // Occasional sickness day (rare)
      if (dow === 2 && day % 9 === 0) {
        entries.push({
          id: String(idCounter++),
          date: dateStr,
          projectId: "sick",
          hours: 8,
          billable: false,
          description: "Sick leave",
          isAbsence: true,
        })
      }
    }
    return entries
  }, [currentDate])

  const enhancedProjects = [
    ...projects,
    { id: "vac", code: "VAC", name: "Vacation", color: "#f59e0b", billable: false, assigned: true },
    { id: "sick", code: "SICK", name: "Sick Leave", color: "#ef4444", billable: false, assigned: true },
  ]

  const getWeekDays = (date: Date) => {
    const days: Date[] = []
    const d = new Date(date)
    // normalize to Monday
    const day = d.getDay() // 0..6 (Sun..Sat)
    const delta = (day + 6) % 7 // convert so Monday=0
    d.setDate(d.getDate() - delta)
    for (let i = 0; i < 7; i++) {
      const nd = new Date(d)
      nd.setDate(d.getDate() + i)
      days.push(nd)
    }
    return days
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const total = lastDay.getDate()
    const startDow = (firstDay.getDay() + 6) % 7 // Monday=0
    const arr: (number|null)[] = []
    for (let i=0;i<startDow;i++) arr.push(null)
    for (let d=1; d<= total; d++) arr.push(d)
    return arr
  }

  const getEntriesForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    return sampleTimeEntries.filter((entry) => entry.date === dateStr)
  }

  // Selection + metrics (must be after getEntriesForDate)
  const findProject = (id: string | null) => enhancedProjects.find(p=>p.id===id)
  const selectedProject = findProject(selectedProjectId || '') as any
  const currentScopeEntries = useMemo(()=>{
    if(!selectedProjectId) return []
    const all = viewMode==='week'
      ? getWeekDays(currentDate).flatMap(d=>getEntriesForDate(d))
      : sampleTimeEntries
    return all.filter(e=>e.projectId===selectedProjectId)
  },[selectedProjectId, viewMode, currentDate, sampleTimeEntries])
  const projectMetrics = useMemo(()=>{
    if(!selectedProjectId) return null
    const total = currentScopeEntries.reduce((s,e)=>s+e.hours,0)
    const billable = currentScopeEntries.filter(e=>e.billable && !e.isAbsence).reduce((s,e)=>s+e.hours,0)
    const absence = currentScopeEntries.filter(e=>e.isAbsence).reduce((s,e)=>s+e.hours,0)
    const nonBillable = total - billable - absence
    return { total, billable, nonBillable, absence, billablePct: total? (billable/total)*100:0 }
  },[currentScopeEntries, selectedProjectId])

  // Accessibility: close on ESC, focus trap, auto-focus
  useEffect(()=>{
    if(!selectedProjectId) return
    const handleKey = (e: KeyboardEvent) => {
      if(e.key === 'Escape') {
        setSelectedProjectId(null)
      } else if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el=>!el.hasAttribute('disabled'))
        if(focusable.length===0) return
        const first = focusable[0]
        const last = focusable[focusable.length-1]
        if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    // focus close button
    closeBtnRef.current?.focus()
    return ()=> window.removeEventListener('keydown', handleKey)
  },[selectedProjectId])

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction === "prev" ? -7 : 7))
      return newDate
    })
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)
    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day=>{
          const entries = getEntriesForDate(day)
          const total = entries.reduce((s,e)=>s+e.hours,0)
          const absence = entries.filter(e=>e.isAbsence).reduce((s,e)=>s+e.hours,0)
          const billable = entries.filter(e=>e.billable && !e.isAbsence).reduce((s,e)=>s+e.hours,0)
          const nonBillable = total - billable - absence
          const reportedPct = (total/8)*100
          const isToday = day.toDateString() === new Date().toDateString()
          const isWeekend = day.getDay()===0 || day.getDay()===6
          return (
            <div key={day.toISOString()} className={`p-3 h-44 border rounded-lg flex flex-col overflow-hidden transition-colors ${isWeekend? 'bg-muted/40':''} ${isToday? 'ring-2 ring-[#6eedd9]':''}`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">{dayNames[(day.getDay()+6)%7]}</div>
                  <div className="text-base font-semibold">{day.getDate()}</div>
                </div>
                {total>0 && <div className="text-[11px] text-muted-foreground font-medium text-right leading-tight">{total.toFixed(1)}h<br/>{reportedPct.toFixed(0)}%</div>}
              </div>
              {entries.length>0 ? (
                <div className="space-y-1 flex-1 overflow-hidden">
                  {entries.slice(0,4).map(e=>{
                    const project = enhancedProjects.find(p=>p.id===e.projectId) as any
                    const pct = total>0? (e.hours/total)*100:0
                    const tooltipParts = [project?.name||'Project']
                    if (project?.client) tooltipParts.push(`Client: ${project.client}`)
                    if (typeof project?.progress === 'number') tooltipParts.push(`Progress: ${project.progress}%`)
                    const tooltip = tooltipParts.join('\n')
                    return (
                      <div key={e.id} className="flex items-center justify-between text-[11px] rounded px-1 py-0.5 bg-background/40 border border-dashed" title={tooltip}> 
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-2 h-2 rounded-full" style={{backgroundColor: project?.color||'#999'}} />
                          <button type="button" onClick={(ev)=>{ev.stopPropagation(); setSelectedProjectId(project?.id||null)}} className="truncate max-w-[110px] text-left hover:underline focus:outline-none">
                            {project?.name || project?.code || e.projectId}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{e.hours.toFixed(1)}h</span>
                          <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                  {entries.length>4 && <div className="text-[10px] text-muted-foreground">+{entries.length-4} more</div>}
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5"><span className="font-medium">B</span> {billable.toFixed(1)}h</div>
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5"><span className="font-medium">NB</span> {nonBillable.toFixed(1)}h</div>
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5 text-red-600"><span className="font-medium">A</span> {absence.toFixed(1)}h</div>
                  </div>
                </div>
              ) : <div className="text-[11px] text-muted-foreground mt-2">No entries</div>}
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate)
    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          if (d === null) return <div key={`pad-${i}`} className="p-2 h-28" />
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
          const entries = getEntriesForDate(date)
          const total = entries.reduce((s,e)=>s+e.hours,0)
          const absence = entries.filter(e=>e.isAbsence).reduce((s,e)=>s+e.hours,0)
          const billable = entries.filter(e=>e.billable && !e.isAbsence).reduce((s,e)=>s+e.hours,0)
          const nonBillable = total - billable - absence
          const reportedPct = (total/8)*100
          const isToday = date.toDateString() === new Date().toDateString()
          const isWeekend = date.getDay()===0 || date.getDay()===6
          return (
            <div
              key={d}
              className={`p-2 h-28 border rounded-lg hover:bg-muted/50 transition-colors overflow-hidden flex flex-col ${isWeekend? 'bg-muted/40':''} ${isToday? 'ring-2 ring-[#6eedd9]':''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">{d}</div>
                {total>0 && <div className="text-[10px] text-muted-foreground font-medium">{total.toFixed(1)}h • {reportedPct.toFixed(0)}%</div>}
              </div>
              {entries.length>0 ? (
                <div className="space-y-1 flex-1 overflow-hidden">
                  {entries.slice(0,3).map(e=>{
                    const project = enhancedProjects.find(p=>p.id===e.projectId) as any
                    const pct = total>0? (e.hours/total)*100:0
                    const tooltipParts = [project?.name||'Project']
                    if (project?.client) tooltipParts.push(`Client: ${project.client}`)
                    if (typeof project?.progress === 'number') tooltipParts.push(`Progress: ${project.progress}%`)
                    const tooltip = tooltipParts.join('\n')
                    return (
                      <div key={e.id} className="flex items-center justify-between text-[11px] rounded px-1 py-0.5 bg-background/40 border border-dashed" title={tooltip}> 
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-2 h-2 rounded-full" style={{backgroundColor: project?.color||'#999'}} />
                          <button type="button" onClick={(ev)=>{ev.stopPropagation(); setSelectedProjectId(project?.id||null)}} className="truncate max-w-[70px] text-left hover:underline focus:outline-none">
                            {project?.code||e.projectId}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{e.hours.toFixed(1)}h</span>
                          <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                  {entries.length>3 && <div className="text-[10px] text-muted-foreground">+{entries.length-3} more</div>}
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5"><span className="font-medium">B</span> {billable.toFixed(1)}h</div>
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5"><span className="font-medium">NB</span> {nonBillable.toFixed(1)}h</div>
                    <div className="text-[10px] text-center bg-gray-100 dark:bg-gray-800 rounded py-0.5 text-red-600"><span className="font-medium">A</span> {absence.toFixed(1)}h</div>
                  </div>
                </div>
              ) : <div className="text-[11px] text-muted-foreground mt-2">No entries</div>}
            </div>
          )
        })}
      </div>
    )
  }

  const currentWeekEntries = viewMode === "week"
    ? getWeekDays(currentDate).flatMap((day) => getEntriesForDate(day))
    : sampleTimeEntries // already current month generated

  const periodSummary = {
    totalHours: currentWeekEntries.reduce((sum, entry) => sum + entry.hours, 0),
    billableHours: currentWeekEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0),
    nonBillableHours: currentWeekEntries
      .filter((entry) => !entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0),
    absenceHours: currentWeekEntries.filter((entry) => entry.isAbsence).reduce((sum, entry) => sum + entry.hours, 0),
  }

  return (
  <div className="space-y-6">
      {/* Horizontal Summary Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-700">{periodSummary.billableHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Billable Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: "#174076" }}>
                {periodSummary.nonBillableHours.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Non-billable Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{periodSummary.absenceHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Absence Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{periodSummary.totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                {viewMode === "week"
                  ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString()}`
                  : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              </CardTitle>
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="h-7 px-3 text-xs"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="h-7 px-3 text-xs"
                >
                  Week
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (viewMode === "week" ? navigateWeek("prev") : navigateMonth("prev"))}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (viewMode === "week" ? navigateWeek("next") : navigateMonth("next"))}
              >
                →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "week" ? (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              {renderWeekView()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
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
