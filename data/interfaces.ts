import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"

export interface IDataSource {
  getConsultants(): Promise<Consultant[]>
  getProjects(): Promise<Project[]>
  getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]>
  // Returns array of project IDs the consultant is assigned to (ProjectUser relation)
  getProjectAssignments?(consultantId: string): Promise<string[]>
}
