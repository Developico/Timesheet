"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useFilters } from "@/lib/filter-context"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useTheme } from "next-themes"

type Tab = "dashboard" | "calendar" | "projects"

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
      <SheetContent side="bottom" className="sm:hidden p-0">
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
  // Calendar-specific toggles will be wired in CalendarView state via custom events to avoid prop drilling
  return (
    <div className="space-y-4">
      <ThemeToggleRow />
      <DateRangePicker value={filters.dateRange} onChange={(v)=> updateFilter('dateRange', v)} />
      <SearchField value={filters.searchQuery} onChange={(v)=> updateFilter('searchQuery', v)} />
      <div className="pt-1 border-t" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:toggle-aggregate')); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Aggregation</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:open-breakdown')); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Breakdown</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:set-view', { detail: { view: 'month' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Month</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:set-view', { detail: { view: 'week' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Week</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:calendar:go-today')); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Today</button>
      </div>
    </div>
  )
}

function ProjectsOptions() {
  const { filters, updateFilter } = useFilters()
  return (
    <div className="space-y-4">
      <ThemeToggleRow />
      <DateRangePicker value={filters.dateRange} onChange={(v)=> updateFilter('dateRange', v)} />
      <SearchField value={filters.searchQuery} onChange={(v)=> updateFilter('searchQuery', v)} />
      <div className="pt-1 border-t" />
      {/* Project filters moved here for mobile – events update ProjectsTable local state */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:set-scope', { detail: { scope: 'my' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>My Projects</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:set-scope', { detail: { scope: 'all' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>All</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'all' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Billable: All</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'yes' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Yes</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:set-billable', { detail: { billable: 'no' }})); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>No</button>
        <button type="button" className="h-9 rounded-md border px-3 text-left" onClick={()=> { window.dispatchEvent(new CustomEvent('tt:projects:toggle-only-reported')); window.dispatchEvent(new CustomEvent('tt:close-options')) }}>Only Reported</button>
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
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={`h-9 rounded-md border px-3 text-sm ${theme==='light'? 'bg-muted':''}`}
          onClick={()=> setTheme('light')}
        >Light</button>
        <button
          type="button"
          className={`h-9 rounded-md border px-3 text-sm ${theme==='dark'? 'bg-muted':''}`}
          onClick={()=> setTheme('dark')}
        >Dark</button>
        <button
          type="button"
          className={`h-9 rounded-md border px-3 text-sm ${theme!=='light' && theme!=='dark'? 'bg-muted':''}`}
          onClick={()=> setTheme('system')}
        >System</button>
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
          <input type="checkbox" checked={cols.billable} onChange={e=> update({ billable: e.target.checked })} /> Billable
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={cols.client} onChange={e=> update({ client: e.target.checked })} /> Client
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={cols.allUsers} onChange={e=> update({ allUsers: e.target.checked })} /> All Users
        </label>
        <div className="flex justify-end">
          <button type="button" className="h-8 rounded-md border px-3 text-xs" onClick={reset}>Reset</button>
        </div>
      </div>
    </div>
  )
}
