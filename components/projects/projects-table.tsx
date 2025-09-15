"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Sheet removed in favor of shared ProjectDetailPanel
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, ChevronUp, ChevronDown, Copy as CopyIcon } from "lucide-react"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useFilters } from "@/lib/filter-context"
import { useConsultants } from "@/hooks/use-consultants"
import { useViewingScope } from "@/lib/viewing-scope"
import type { Project } from "@/lib/data"
import { useNewProjects, NEW_DAYS } from "@/lib/use-new-projects"
import { useAuth } from "@/lib/auth-client"
import { toast } from "@/hooks/use-toast"

export function ProjectsTable() {
  const { filteredProjects, filteredTimeEntries, filters } = useFilters()
  const { newProjects, isNew, markViewed } = useNewProjects()
  // Sortable fields per requirement: Hours (computed), Name, Client, Code. Others static.
  const [sortField, setSortField] = useState<keyof Project | 'hours'>("hours")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectScope, setProjectScope] = useState<"my"|"all">("my")
  const [billableFilter, setBillableFilter] = useState<'all'|'yes'|'no'>('all')
  const [onlyReported, setOnlyReported] = useState<boolean>(false)
  const [assignedIds, setAssignedIds] = useState<Set<string>|null>(null)
  const { consultants } = useConsultants()
  const { consultantId: scopedConsultant } = useViewingScope()
  const { user } = useAuth()

  // Persist toggle state between date range changes / navigation
  useEffect(()=>{
    try {
      const raw = localStorage.getItem('projectsTablePrefsV1')
      if(raw){
        const parsed = JSON.parse(raw)
        if(parsed.projectScope === 'my' || parsed.projectScope === 'all') setProjectScope(parsed.projectScope)
        if(parsed.billableFilter === 'all' || parsed.billableFilter === 'yes' || parsed.billableFilter === 'no') setBillableFilter(parsed.billableFilter)
        if(typeof parsed.onlyReported === 'boolean') setOnlyReported(parsed.onlyReported)
        const allowedSortFields: Array<keyof Project | 'hours'> = ['name','client','code','hours']
        if(parsed.sortField && allowedSortFields.includes(parsed.sortField)) {
          setSortField(parsed.sortField)
        } else {
          setSortField('hours')
        }
  if(parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') setSortDirection(parsed.sortDirection)
      } else {
        setSortField('hours')
        setSortDirection('desc')
      }
    } catch { /* ignore */ }
  },[])
  useEffect(()=>{
    const store = { projectScope, billableFilter, onlyReported, sortField, sortDirection }
    try { localStorage.setItem('projectsTablePrefsV1', JSON.stringify(store)) } catch {/* ignore */}
  },[projectScope,billableFilter,onlyReported,sortField,sortDirection])
  useEffect(()=>{
    let ignore = false
    const id = scopedConsultant
    // Reset previous user's assignments immediately to avoid stale 'My Projects'
    setAssignedIds(null)
    if(!id) return () => { ignore = true }
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if(!guidRegex.test(id)) {
      // Likely mock or unmapped user; skip assignment fetch
      return () => { ignore = true }
    }
    // Debug info in console to trace chosen consultant
    console.log('[projects-table] fetching assignments for consultant', { id })
    fetch(`/api/dataverse/project-assignments?consultantId=${id}`)
      .then(r=> r.ok? r.json(): Promise.reject(new Error('assignments '+r.status)))
      .then(json=>{ if(!ignore && json?.value) setAssignedIds(new Set(json.value)); })
      .catch(err=>{ if(!ignore) { console.warn('assignments fetch failed', err?.message) } })
    return ()=>{ ignore = true }
  }, [scopedConsultant])
  

  type PExt = Project & { allUsers?: boolean }
  // Determine effective user for per-project hour aggregation (match summary logic)
  const primaryConsultantId = useMemo(()=>{
    if(!consultants?.length) return null as string | null
    if(user?.email){
      const lower = user.email.toLowerCase()
      const found = consultants.find(c=> c.email?.toLowerCase() === lower)
      if(found) return found.id
    }
    return consultants[0]?.id ?? null
  }, [consultants, user?.email])
  const currentUserId = scopedConsultant || primaryConsultantId || undefined
  const projectsWithMetrics = useMemo(()=> (filteredProjects as PExt[]).map((project) => {
  const allProjectEntries = filteredTimeEntries.filter((entry) => entry.projectId === project.id)
  // Aggregate hours for effective user (scoped or primary). If still none, fallback to 0.
  const userEntries = currentUserId ? allProjectEntries.filter(e=> e.consultantId === currentUserId) : []
    const userHours = userEntries.reduce((sum,e)=> sum + e.hours, 0)
    const userBillableHours = userEntries.filter(e=>e.billable).reduce((sum,e)=> sum + e.hours, 0)
    const assignedConsultants = [...new Set(allProjectEntries.map(e=>e.consultantId))]
    return {
      ...project,
      actualHours: userHours,
      billableHours: userBillableHours,
      assignedConsultants,
      billablePercentage: userHours > 0 ? (userBillableHours / userHours) * 100 : 0,
    }
  }), [filteredProjects, filteredTimeEntries, currentUserId])

  // Precompute count of projects where current user has >0h in current filtered window
  const reportedProjectsCount = useMemo(()=> projectsWithMetrics.filter(p=> p.actualHours > 0).length, [projectsWithMetrics])
  // Count of projects that would appear under 'my' scope (ignoring search so it stays stable while typing)
  const myProjectsCount = useMemo(()=>{
    const effectiveUserId = currentUserId || null
    const myProjectIds = assignedIds
      ? assignedIds
      : effectiveUserId
        ? new Set(filteredTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
        : new Set(filteredTimeEntries.map(e=> e.projectId))
    // Include projects marked allUsers explicitly or belonging to user via assignments/time entries
    return projectsWithMetrics.filter(p=> p.allUsers || myProjectIds.has(p.id)).length
  }, [assignedIds, filteredTimeEntries, projectsWithMetrics, currentUserId])
  // allProjectsCount computed after filteredAndSortedProjects is defined (placeholder, will set later)
  let allProjectsCount = 0

  const filteredAndSortedProjects = useMemo(()=>{
    const arr = [...projectsWithMetrics]
    const direction = sortDirection === 'asc' ? 1 : -1
    arr.sort((a,b)=>{
      if (sortField === 'hours') return (a.actualHours - b.actualHours) * direction
      const aValue = a[sortField]
      const bValue = b[sortField]
      if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue) * direction
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction
      return 0
    })
    return arr
  }, [projectsWithMetrics, sortField, sortDirection])
  allProjectsCount = filteredAndSortedProjects.length

  const handleSort = (field: keyof Project | 'hours') => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Status column removed per requirement; helper no longer needed.

  const SortButton = ({ field, children }: { field: keyof Project | 'hours'; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium hover:bg-transparent"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </Button>
  )

  // Totals for summary bar (current filtered time entries for user)
  // Scope summary to active consultant: ViewingScope overrides; else current user detected by email; else first consultant; else all
  // primaryConsultantId already computed above for per-project aggregation

  const userEntries = useMemo(()=>{
    if(scopedConsultant) return filteredTimeEntries.filter(e=> e.consultantId === scopedConsultant)
    if(primaryConsultantId) return filteredTimeEntries.filter(e=> e.consultantId === primaryConsultantId)
    return filteredTimeEntries
  }, [filteredTimeEntries, scopedConsultant, primaryConsultantId])
  const totalUserHours = userEntries.reduce((s,e)=>s+e.hours,0)
  const totalBillableUserHours = userEntries.filter(e=>e.billable).reduce((s,e)=>s+e.hours,0)
  const totalNonBillableUserHours = totalUserHours - totalBillableUserHours
  // Absence hours: project code exactly 'Office.Absences' (or name containing 'absence')
  const absenceProjectIds = filteredProjects.filter(p=> p.code === 'Office.Absences' || p.name?.toLowerCase().includes('absence')).map(p=>p.id)
  const absenceUserHours = userEntries.filter(e=> absenceProjectIds.includes(e.projectId)).reduce((s,e)=>s+e.hours,0)

  return (
    <div className="space-y-6">
      {/* Summary metrics card (analogous to calendar view) */}
  <Card className="dark:bg-[oklch(0.18_0_0)]">
  <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-8 items-center">
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-purple-600 leading-none">{totalUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-400 leading-none">{totalBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              {/* eslint-disable-next-line */}
              <div className="text-2xl font-bold leading-none text-[#174076] dark:text-[#6e93c9]">{totalNonBillableUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Non-billable Hours</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div className="text-2xl font-bold text-red-600 leading-none">{absenceUserHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Absence Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>
  <Card className="dark:bg-[oklch(0.18_0_0)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <CardTitle>Projects ({filteredAndSortedProjects.length})</CardTitle>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='my'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('my')}
                  title={assignedIds ? 'Assigned projects (plus ALL flagged)' : 'Projects you have time entries on (plus ALL flagged)'}
                >My Projects ({myProjectsCount})</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='all'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('all')}
                  title="All filtered projects"
                >All ({allProjectsCount})</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='all'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('all')}
                >Billable: All</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='yes'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('yes')}
                >Yes</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={billableFilter==='no'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setBillableFilter('no')}
                >No</Button>
              </div>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={onlyReported? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setOnlyReported(o=>!o)}
                  title={`Projects with your hours in range: ${reportedProjectsCount}`}
                >Only Reported ({reportedProjectsCount})</Button>
              </div>
            </div>
            <div />
          </div>
        </CardHeader>
        <CardContent>
          {/* (Summary moved to top card) */}
          <div className="rounded-md border bg-card dark:bg-[oklch(0.19_0_0)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="mobile-hidden">Billable</TableHead>
                  <TableHead>
                    <SortButton field="code">Code</SortButton>
                  </TableHead>
                  <TableHead className="mobile-hidden">
                    <SortButton field="client">Client</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="name">Name</SortButton>
                  </TableHead>
                  <TableHead className="mobile-hidden">All Users</TableHead>
                  <TableHead>
                    <SortButton field="hours">Hrs</SortButton>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Derive set of project IDs considered "mine":
                  // 1. If assignments loaded => those IDs (assignment semantics independent of date range)
                  // 2. Else if we know effective user => projects with that user's time entries in current filtered range
                  // 3. Else fallback to all reported projects in range
                  const effectiveUserId = currentUserId || null
                  const myProjectIds = assignedIds
                    ? assignedIds
                    : effectiveUserId
                      ? new Set(filteredTimeEntries.filter(e=> e.consultantId === effectiveUserId).map(e=> e.projectId))
                      : new Set(filteredTimeEntries.map(e=> e.projectId))
                  // If searching, show all filtered projects to present full results regardless of assignment scope
                  const searching = (filters.searchQuery || '').trim().length > 0
                  // Base set: if scope = 'my' limit to assignment / participation; if 'all' show every filtered project (no hidden constraint)
                  let base = (projectScope==='my' && !searching)
                    ? filteredAndSortedProjects.filter(p=> p.allUsers || myProjectIds.has(p.id))
                    : filteredAndSortedProjects
                  if(billableFilter==='yes') base = base.filter(p=>p.billable)
                  else if(billableFilter==='no') base = base.filter(p=>!p.billable)
                  if(onlyReported) {
                    // Only projects where current user has reported hours (>0) in current filtered window
                    base = base.filter(p=> p.actualHours > 0)
                  }
                  const visible = base
                  if(visible.length===0) {
                    return (
                      <TableRow>
        <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                          {projectScope==='my' ? (assignedIds? 'No assigned projects' : 'No projects with your recent time entries – switch to All to browse all codes.') : 'No projects'}
                        </TableCell>
                      </TableRow>
                    )
                  }
                  return visible.map(project => {
                    const newForUser = isNew(project.id)
                    return (
                      <TableRow key={project.id} className={`hover:bg-muted/50 transition-colors ${newForUser?'ring-1 ring-[#6eedd9]':''}`}>
                    <TableCell className="mobile-hidden">
                      <Badge variant={project.billable ? "default" : "secondary"} className="text-[10px]">
                        {project.billable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[110px]">
                        {(() => {
                          const isAbsence = project.code === 'Office.Absences' || project.name?.toLowerCase().includes('absence')
                          // Use same palette as summary bar
                          const color = isAbsence ? '#dc2626' : (project.billable ? '#14b8a6' : '#174076')
                          const label = isAbsence ? 'Absence' : (project.billable ? 'Billable' : 'Non-billable')
                          {/* eslint-disable-next-line */}
                          return <div className="w-3 h-3 rounded-full" data-color={color} title={label} aria-label={label} />
                        })()}
                        <span className="font-mono text-sm flex items-center gap-1">
                          {project.code}
                          {newForUser && <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-[#6eedd9]/20 text-teal-700 border border-teal-300">NEW</span>}
                        </span>
                        <button
                          type="button"
                          onClick={()=>{navigator.clipboard?.writeText(project.code).then(()=> toast({ title: 'Copied', description: `${project.code} copied to clipboard` })).catch(()=>{}); markViewed(project.id)}}
                          className="p-1 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-border"
                          title="Copy project code"
                        >
                          <CopyIcon className="h-3 w-3" />
                          <span className="sr-only">Copy code {project.code}</span>
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium mobile-hidden">{project.client}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>{project.name}</span>
                        <span className="text-[10px] text-muted-foreground sm:hidden">{project.client}</span>
                        {project.allUsers && <span className="sm:hidden text-[10px] text-teal-600 dark:text-teal-400">ALL USERS</span>}
                      </div>
                    </TableCell>
                    <TableCell className="mobile-hidden">
                      { project.allUsers ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0.5 bg-teal-600/10 border-teal-600/40 text-teal-700 dark:text-teal-400">ALL</Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span> }
                    </TableCell>
                    <TableCell>
                      <div className="text-sm" title={`Your hours: ${project.actualHours.toFixed(1)}h (B ${project.billableHours.toFixed(1)} / NB ${(project.actualHours - project.billableHours).toFixed(1)})`}>
                        <div>{project.actualHours.toFixed(1)}h</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedProject(project); markViewed(project.id) }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                    )
                  })
                })()}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 ring-1 ring-[#6eedd9] rounded-sm" /> <span>Recently added (&lt;={NEW_DAYS} days)</span>
            </div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-teal-500"></span> Billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-[#174076]"></span> Non-billable</span>
              {/* eslint-disable-next-line */}
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-600"></span> Absence</span>
            </div>
            {newProjects.length>0 && <div className="text-teal-600">New for you: {newProjects.length}</div>}
            <div>Scope: {projectScope==='my' ? (assignedIds? 'projects you are assigned to' : 'projects you have time entries on (current filters applied)') : 'all filtered projects'}</div>
          </div>
        </CardContent>
      </Card>
  {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
            entries={filteredTimeEntries.filter(e=>e.projectId===selectedProject.id)}
            scopeLabel="filtered entries"
            onClose={()=>setSelectedProject(null)}
        />
      )}
    </div>
  )
}
