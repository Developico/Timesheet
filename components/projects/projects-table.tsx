"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Eye, ChevronUp, ChevronDown } from "lucide-react"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"
import type { Project } from "@/lib/data"

export function ProjectsTable() {
  const { filteredProjects, filteredTimeEntries } = useFilters()
  const [sortField, setSortField] = useState<keyof Project>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [localSearch, setLocalSearch] = useState("")

  const consultants = dataService.getConsultants()

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
    .filter((project) => {
      if (!localSearch) return true
      const searchLower = localSearch.toLowerCase()
      return (
        project.name.toLowerCase().includes(searchLower) ||
        project.client.toLowerCase().includes(searchLower) ||
        project.code.toLowerCase().includes(searchLower)
      )
    })
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
            <CardTitle>Projects ({filteredAndSortedProjects.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox disabled />
                  </TableHead>
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
                {filteredAndSortedProjects.map((project) => (
                  <TableRow key={project.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox checked={project.assigned} disabled />
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.billable ? "default" : "secondary"} className="text-xs">
                        {project.billable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="font-mono text-sm">{project.code}</span>
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
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(project)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-96">
                          <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
                              {project.code}
                            </SheetTitle>
                            <SheetDescription>{project.name}</SheetDescription>
                          </SheetHeader>
                          <div className="mt-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Client</label>
                                <p className="text-sm">{project.client}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Status</label>
                                <Badge className={getStatusColor(project.status)} variant="secondary">
                                  {project.status.replace("-", " ")}
                                </Badge>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Billable</label>
                                <p className="text-sm">{project.billable ? "Yes" : "No"}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Assigned</label>
                                <p className="text-sm">{project.assigned ? "Yes" : "No"}</p>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Hours Summary</label>
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>Total Hours:</span>
                                  <span className="font-medium">{project.actualHours.toFixed(1)}h</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Billable Hours:</span>
                                  <span className="font-medium text-teal-600">{project.billableHours.toFixed(1)}h</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Billable %:</span>
                                  <span className="font-medium">{project.billablePercentage.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Assigned Consultants</label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {project.assignedConsultants.map((consultantId) => {
                                  const consultant = consultants.find((c) => c.id === consultantId)
                                  return (
                                    <Badge key={consultantId} variant="outline" className="text-xs">
                                      {consultant?.name || consultantId}
                                    </Badge>
                                  )
                                })}
                                {project.assignedConsultants.length === 0 && (
                                  <span className="text-sm text-muted-foreground">No consultants assigned</span>
                                )}
                              </div>
                            </div>

                            {project.note && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                                <p className="text-sm mt-1">{project.note}</p>
                              </div>
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
