"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useFilters } from "@/lib/filter-context"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useTheme } from "next-themes"

type Tab = "dashboard" | "calendar" | "projects" | "reports"

export function MobileOptions({ activeTab }: { activeTab: Tab }) {
  const [open, setOpen] = useState(false)
  const [mountedOnce, setMountedOnce] = useState(false)
  useEffect(() => { if (open && !mountedOnce) setMountedOnce(true) }, [open, mountedOnce])
  // Listen for the global header trigger
  useEffect(() => {
    const handler = () => setOpen(true)
    const closeHandler = () => setOpen(false)
    window.addEventListener("tt:open-options", handler)
    window.addEventListener("snippetlib:open-options", handler)
    window.addEventListener("tt:close-options", closeHandler)
    return () => {
      window.removeEventListener("tt:open-options", handler)
      window.removeEventListener("snippetlib:open-options", handler)
      window.removeEventListener("tt:close-options", closeHandler)
    }
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Add a class scope to style controls inside the sheet */}
      <SheetContent side="bottom" className="sm:hidden p-0 tt-mobile-sheet">
        {/* Top grabber for mobile feel */}
        <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="text-sm">
            {activeTab === 'dashboard' && 'Options: Dashboard'}
            {activeTab === 'calendar' && 'Options: Calendar'}
            {activeTab === 'projects' && 'Options: Projects'}
          </SheetTitle>
        </SheetHeader>
        {/* Lazy mount to avoid cost until first open */}
        {mountedOnce && (
          <Suspense>
            {activeTab === "dashboard" && <DashboardOptions />}
            {activeTab === "calendar" && <CalendarOptions />}
            {activeTab === "projects" && <ProjectsOptions />}
          </Suspense>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DashboardOptions() {
  const { filters, updateFilter } = useFilters()
  return (
    <div className="space-y-4">
  <ThemeToggleRow />
  <DateRangePicker value={filters.dateRange} onChange={(v)=> updateFilter('dateRange', v)} />
  <SearchField value={filters.searchQuery} onChange={(v)=> updateFilter('searchQuery', v)} />
    </div>
  )
}

function CalendarOptions() {
  const { filters, updateFilter } = useFilters()
  // Mirror CalendarView state to show active highlights in the sheet
  const [aggregate, setAggregate] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<'month'|'week'>('month')
  useEffect(()=>{
    const toggleAgg = () => setAggregate(a=>!a)
    const openBreakdown = () => {/* action button only; no persistent highlight */}
    const setView = (e: Event) => { const ce = e as CustomEvent<{ view?: 'month'|'week' }>; if(ce.detail?.view) setViewMode(ce.detail.view) }
    const hydrate = (e: Event) => { const ce = e as CustomEvent<{ aggregate?: boolean; view?: 'month'|'week' }>; if(typeof ce.detail?.aggregate==='boolean') setAggregate(ce.detail.aggregate); if(ce.detail?.view) setViewMode(ce.detail.view) }
    window.addEventListener('tt:calendar:toggle-aggregate', toggleAgg)
    window.addEventListener('tt:calendar:open-breakdown', openBreakdown)
    window.addEventListener('tt:calendar:set-view', setView)
    window.addEventListener('tt:calendar:state', hydrate)
    // Request current state on mount so our highlights rehydrate
    try{ window.dispatchEvent(new CustomEvent('tt:calendar:request-state')) }catch{}
    return ()=>{
      window.removeEventListener('tt:calendar:toggle-aggregate', toggleAgg)
      window.removeEventListener('tt:calendar:open-breakdown', openBreakdown)
      window.removeEventListener('tt:calendar:set-view', setView)
      window.removeEventListener('tt:calendar:state', hydrate)
    }
  }, [])
  return (
    <div className="space-y-4">
      <ThemeToggleRow />
      <DateRangePicker value={filters.dateRange} onChange={(v)=> updateFilter('dateRange', v)} />
      <SearchField value={filters.searchQuery} onChange={(v)=> updateFilter('searchQuery', v)} />
      <div className="pt-1 border-t" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          type="button"
          data-active={aggregate}
          className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
          onClick={()=> { setAggregate(a=>!a); window.dispatchEvent(new CustomEvent('tt:calendar:toggle-aggregate')) }}
        >Aggregation</button>
        <button
          type="button"
          className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15"
          onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:open-breakdown')) }}
        >Breakdown</button>
        <button
          type="button"
          data-active={viewMode==='month'}
          className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
          onClick={()=> { setViewMode('month'); window.dispatchEvent(new CustomEvent('tt:calendar:set-view', { detail: { view: 'month' }})) }}
        >Month</button>
        <button
          type="button"
          data-active={viewMode==='week'}
          className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
          onClick={()=> { setViewMode('week'); window.dispatchEvent(new CustomEvent('tt:calendar:set-view', { detail: { view: 'week' }})) }}
        >Week</button>
        <button
          type="button"
          className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15"
          onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:go-today')) }}
        >Today</button>
      </div>
    </div>
  )
}

function ProjectsOptions() {
  const { filters, updateFilter } = useFilters()
  // Mirror ProjectsTable local filters to provide visual feedback in the sheet
  const [projectScope, setProjectScope] = useState<"my"|"all">("my")
  const [billableFilter, setBillableFilter] = useState<'all'|'yes'|'no'>('all')
  const [onlyReported, setOnlyReported] = useState<boolean>(false)
  const [projectCount, setProjectCount] = useState<number>(0)
  // Keep in sync with the events ProjectsTable listens to
  useEffect(()=>{
    const setScope = (e: Event) => {
      const ce = e as CustomEvent<{ scope?: 'my'|'all' }>
      if(ce.detail?.scope) setProjectScope(ce.detail.scope)
    }
    const setBillable = (e: Event) => {
      const ce = e as CustomEvent<{ billable?: 'all'|'yes'|'no' }>
      if(ce.detail?.billable) setBillableFilter(ce.detail.billable)
    }
    const toggleReported = () => setOnlyReported(o=>!o)
  window.addEventListener('tt:projects:set-scope', setScope)
    window.addEventListener('tt:projects:set-billable', setBillable)
    window.addEventListener('tt:projects:toggle-only-reported', toggleReported)
    const hydrate = (e: Event) => {
      const ce = e as CustomEvent<{ scope?: 'my'|'all'; billable?: 'all'|'yes'|'no'; onlyReported?: boolean; projectCount?: number }>
      if (ce.detail?.scope) setProjectScope(ce.detail.scope)
      if (ce.detail?.billable) setBillableFilter(ce.detail.billable)
      if (typeof ce.detail?.onlyReported === 'boolean') setOnlyReported(ce.detail.onlyReported)
      if (typeof ce.detail?.projectCount === 'number') setProjectCount(ce.detail.projectCount)
    }
    window.addEventListener('tt:projects:state', hydrate)
    // Ask for current state on mount so our buttons reflect existing filters
    try { window.dispatchEvent(new CustomEvent('tt:projects:request-state')) } catch {}
    return ()=>{
      window.removeEventListener('tt:projects:set-scope', setScope)
      window.removeEventListener('tt:projects:set-billable', setBillable)
      window.removeEventListener('tt:projects:toggle-only-reported', toggleReported)
      window.removeEventListener('tt:projects:state', hydrate)
    }
  }, [])
  return (
    <div className="space-y-4">
      <ThemeToggleRow />
      <DateRangePicker value={filters.dateRange} onChange={(v)=> updateFilter('dateRange', v)} />
      <SearchField value={filters.searchQuery} onChange={(v)=> updateFilter('searchQuery', v)} />
      <div className="pt-1 border-t" />
      {/* Project filters moved here for mobile – show active state with teal */}
      <div className="space-y-2 text-sm">
        {/* Project count for mobile */}
        <div className="text-xs text-muted-foreground text-center py-1">
          {projectCount} {projectCount === 1 ? 'project' : 'projects'}
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-active={projectScope==='my'}
            className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
            onClick={()=> {
              setProjectScope('my')
              window.dispatchEvent(new CustomEvent('tt:projects:set-scope', { detail: { scope: 'my' }}))
            }}
          >My Projects</button>
          <button
            type="button"
            data-active={projectScope==='all'}
            className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
            onClick={()=> {
              setProjectScope('all')
              window.dispatchEvent(new CustomEvent('tt:projects:set-scope', { detail: { scope: 'all' }}))
            }}
          >All</button>
        </div>
        <div>
          <div className="text-[11px] text-muted-token mb-1">Billable</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-active={billableFilter==='yes'}
              className="h-9 rounded-md border px-2 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
              onClick={()=> {
                setBillableFilter('yes')
                window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'yes' }}))
              }}
            >Yes</button>
            <button
              type="button"
              data-active={billableFilter==='no'}
              className="h-9 rounded-md border px-2 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
              onClick={()=> {
                setBillableFilter('no')
                window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'no' }}))
              }}
            >No</button>
            <button
              type="button"
              data-active={billableFilter==='all'}
              className="h-9 rounded-md border px-2 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
              onClick={()=> {
                setBillableFilter('all')
                window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'all' }}))
              }}
            >Both</button>
          </div>
        </div>
        <div className="grid grid-cols-1">
          <button
            type="button"
            data-active={onlyReported}
            className="h-9 rounded-md border px-3 text-left active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
            onClick={()=> {
              setOnlyReported(o=>!o)
              window.dispatchEvent(new CustomEvent('tt:projects:toggle-only-reported'))
            }}
          >Only Reported</button>
        </div>
        
        {/* Reset filters button for mobile */}
        {(projectScope !== 'my' || billableFilter !== 'all' || onlyReported !== false) && (
          <div className="pt-2 border-t">
            <button
              type="button"
              className="w-full h-9 rounded-md border px-3 text-center text-sm text-muted-foreground hover:bg-muted/50"
              onClick={() => {
                setProjectScope('my')
                setBillableFilter('all') 
                setOnlyReported(false)
                window.dispatchEvent(new CustomEvent('tt:projects:set-scope', { detail: { scope: 'my' }}))
                window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'all' }}))
                // Only toggle if currently true
                if (onlyReported) {
                  window.dispatchEvent(new CustomEvent('tt:projects:toggle-only-reported'))
                }
              }}
            >
              Reset Project Filters
            </button>
          </div>
        )}
      </div>
      <div className="pt-2 border-t" />
      <ProjectsColumnsControls />
    </div>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string)=>void }){
  return (
    <div>
      <label className="text-[11px] text-muted-token block mb-1">Search</label>
      <div className="relative">
        <Input value={value} onChange={(e)=> onChange(e.target.value)} placeholder="Search…" className="pl-3" />
      </div>
    </div>
  )
}

function DateRangePicker({ value, onChange }: { value: string; onChange: (v: string)=>void }){
  const options = useMemo(()=>[
    { value: "this-week", label: "This Week" },
    { value: "this-month", label: "This Month" },
    { value: "this-quarter", label: "This Quarter" },
    { value: "this-year", label: "This Year" },
    { value: "previous-week", label: "Previous Week" },
    { value: "previous-month", label: "Previous Month" },
    { value: "previous-quarter", label: "Previous Quarter" },
    { value: "previous-year", label: "Previous Year" },
  ], [])
  return (
    <div>
  <label className="text-[11px] text-muted-token block mb-1">Date range</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o=> <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function ThemeToggleRow(){
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <label className="text-[11px] text-muted-token block mb-1">Theme</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-active={theme==='light'}
          className="h-9 rounded-md border px-3 text-sm active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
          onClick={()=> setTheme('light')}
        >Light</button>
        <button
          type="button"
          data-active={theme==='dark'}
          className="h-9 rounded-md border px-3 text-sm active:bg-[#14b8a6]/15 data-[active=true]:bg-[#14b8a6]/20 data-[active=true]:border-[#14b8a6]/50 data-[active=true]:text-[#0f766e]"
          onClick={()=> setTheme('dark')}
        >Dark</button>
      </div>
    </div>
  )
}

function ProjectsColumnsControls(){
  const [cols, setCols] = useState<{billable:boolean; client:boolean; allUsers:boolean}>({ billable: true, client: true, allUsers: true })
  // hydrate from localStorage to mirror desktop Columns menu
  useEffect(()=>{
    try{
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tt_project_table_cols') : null
      if(raw){ const parsed = JSON.parse(raw); setCols(c=> ({...c, ...parsed})) }
    }catch{ /* ignore */ }
  }, [])
  const update = (patch: Partial<typeof cols>)=>{
    setCols(c=>{ const next = { ...c, ...patch }; try{ window.localStorage.setItem('tt_project_table_cols', JSON.stringify(next)) }catch{}; return next })
    window.dispatchEvent(new CustomEvent('tt:projects:set-columns', { detail: patch }))
  }
  const reset = ()=>{ const deflt = { billable:true, client:true, allUsers:true }; setCols(deflt); try{ window.localStorage.setItem('tt_project_table_cols', JSON.stringify(deflt)) }catch{}; window.dispatchEvent(new CustomEvent('tt:projects:set-columns', { detail: { reset: true } })) }
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-token">Columns</div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-[#14b8a6]" checked={cols.billable} onChange={e=> update({ billable: e.target.checked })} /> Billable
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-[#14b8a6]" checked={cols.client} onChange={e=> update({ client: e.target.checked })} /> Client
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-[#14b8a6]" checked={cols.allUsers} onChange={e=> update({ allUsers: e.target.checked })} /> All Users
        </label>
        <div className="flex justify-end">
          <button type="button" className="h-8 rounded-md border px-3 text-xs active:bg-[#14b8a6]/15" onClick={reset}>Reset</button>
        </div>
      </div>
    </div>
  )
}
