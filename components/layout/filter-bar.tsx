"use client"

import { Badge } from "@/components/ui/badge"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"

export function FilterBar() {
  const { filters, updateFilter } = useFilters()
  const projects = dataService.getProjects()
  const consultants = dataService.getConsultants()

  return (
    <div className="border-b bg-background">
      <div className="container px-6 py-4">
        {/* Filter chips row */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.selectedConsultants.map((consultantId) => {
            const consultant = consultants.find((c) => c.id === consultantId)
            return (
              <Badge key={consultantId} variant="secondary" className="h-8 rounded-full px-3 flex items-center gap-1">
                {consultant?.name}
                <span
                  className="text-xs cursor-pointer hover:text-destructive"
                  onClick={() =>
                    updateFilter(
                      "selectedConsultants",
                      filters.selectedConsultants.filter((id) => id !== consultantId),
                    )
                  }
                >
                  ×
                </span>
              </Badge>
            )
          })}

          {filters.selectedProjects.map((projectId) => {
            const project = projects.find((p) => p.id === projectId)
            return (
              <Badge key={projectId} variant="secondary" className="h-8 rounded-full px-3 flex items-center gap-1">
                {project?.code}
                <span
                  className="text-xs cursor-pointer hover:text-destructive"
                  onClick={() =>
                    updateFilter(
                      "selectedProjects",
                      filters.selectedProjects.filter((id) => id !== projectId),
                    )
                  }
                >
                  ×
                </span>
              </Badge>
            )
          })}

          {filters.entryType !== "all" && (
            <Badge variant="secondary" className="h-8 rounded-full px-3 flex items-center gap-1">
              {filters.entryType === "billable" ? "Billable" : "Non-billable"}
              <span
                className="text-xs cursor-pointer hover:text-destructive"
                onClick={() => updateFilter("entryType", "all")}
              >
                ×
              </span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
