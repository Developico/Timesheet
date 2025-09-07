import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"

export interface IDataSource {
  getConsultants(): Promise<Consultant[]>
  getProjects(): Promise<Project[]>
  getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]>
}
