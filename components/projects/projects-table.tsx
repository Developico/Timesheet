"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Sheet removed in favor of shared ProjectDetailPanel
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, ChevronUp, ChevronDown } from "lucide-react"
import { ProjectDetailPanel } from "@/components/projects/project-detail-panel"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"
import type { Project } from "@/lib/data"
import { useNewProjects, NEW_DAYS } from "@/lib/use-new-projects"
import { toast } from "@/hooks/use-toast"

export function ProjectsTable() {
  const { filteredProjects, filteredTimeEntries } = useFilters()
  const { newProjects, isNew, markViewed } = useNewProjects()
  const [sortField, setSortField] = useState<keyof Project>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectScope, setProjectScope] = useState<"my"|"all">("my")
  const [assignedIds, setAssignedIds] = useState<Set<string>|null>(null)
  const consultants = dataService.getConsultants()
  const primaryConsultant = consultants[0] // TODO: replace with authenticated user principal

  useEffect(()=>{
    let ignore = false
    if(!primaryConsultant) return
    fetch(`/api/dataverse/project-assignments?consultantId=${primaryConsultant.id}`)
      .then(r=> r.ok? r.json(): Promise.reject())
      .then(json=>{ if(!ignore && json?.value) setAssignedIds(new Set(json.value)) })
      .catch(()=>{})
    return ()=>{ ignore = true }
  }, [primaryConsultant?.id])
  

  const projectsWithMetrics = filteredProjects.map((project) => {
    const projectEntries = filteredTimeEntries.filter((entry) => entry.projectId === project.id)
    const totalHours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0)
    const billableHours = projectEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0)
    const assignedConsultants = [...new Set(projectEntries.map((entry) => entry.consultantId))]

    return {
      ...project,
      actualHours: totalHours,
      billableHours,
      assignedConsultants,
      billablePercentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
    }
  })

  const filteredAndSortedProjects = projectsWithMetrics
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      const direction = sortDirection === "asc" ? 1 : -1

      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction
      }
      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction
      }
      return 0
    })

  const handleSort = (field: keyof Project) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      case "on-hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  const SortButton = ({ field, children }: { field: keyof Project; children: React.ReactNode }) => (
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Projects ({filteredAndSortedProjects.length})</CardTitle>
              <div className="flex items-center rounded-lg border p-1 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='my'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('my')}
                >My Projects</Button>
                <Button
                  type="button"
                  size="sm"
                  variant={projectScope==='all'? 'default':'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={()=>setProjectScope('all')}
                >All</Button>
              </div>
            </div>
            <div />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-card dark:bg-[oklch(0.14_0_0)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton field="billable">Billable</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="code">Code</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="client">Client</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="name">Name</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="metaproject">Metaproject</SortButton>
                  </TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const myProjectIds = assignedIds || new Set(filteredTimeEntries.map(e=>e.projectId))
                  const msPerDay = 1000*60*60*24
                  const now = Date.now()
                  const NEW_DAYS = 30
      const visible = (projectScope==='my')
                    ? filteredAndSortedProjects.filter(p=> myProjectIds.has(p.id))
                    : filteredAndSortedProjects
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
                    <TableCell>
                      <Badge variant={project.billable ? "default" : "secondary"} className="text-xs">
                        {project.billable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="font-mono text-sm flex items-center gap-1">
                          {project.code}
                          {newForUser && <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-[#6eedd9]/20 text-teal-700 border border-teal-300">NEW</span>}
                        </span>
                        <button
                          type="button"
                          onClick={()=>{navigator.clipboard?.writeText(project.code).then(()=> toast({ title: 'Copied', description: `${project.code} copied to clipboard` })).catch(()=>{}); markViewed(project.id)}}
                          className="text-[10px] px-1 py-0.5 rounded border bg-muted/40 hover:bg-muted transition-colors"
                          title="Copy project code"
                        >Copy</button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{project.client}</TableCell>
                    <TableCell>{project.name}</TableCell>
                    <TableCell className="text-muted-foreground">{project.metaproject || "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{project.actualHours.toFixed(1)}h</div>
                        {project.billableHours > 0 && (
                          <div className="text-xs text-teal-600">{project.billableHours.toFixed(1)}h billable</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status)} variant="secondary">
                        {project.status.replace("-", " ")}
                      </Badge>
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
