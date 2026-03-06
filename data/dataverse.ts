import type { IDataSource } from './interfaces'
import type { Consultant, Project, TimeEntry, TimeEntryFilters } from '@/types'
import { getConsultants } from './dataverse-consultants'
import { getProjects } from './dataverse-projects'
import { getTimeEntries, getProjectAssignments, getProjectTeam, getDaysOff } from './dataverse-time-entries'

export class DataverseDataSource implements IDataSource {
  getConsultants(): Promise<Consultant[]> { return getConsultants() }
  getProjects(currentConsultantId?: string): Promise<Project[]> { return getProjects(currentConsultantId) }
  getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> { return getTimeEntries(params) }
  getProjectAssignments(consultantId: string): Promise<string[]> { return getProjectAssignments(consultantId) }
  getProjectTeam(projectId: string): Promise<string[]> { return getProjectTeam(projectId) }
  getDaysOff(from: string, to: string): Promise<{ date: string; name?: string }[]> { return getDaysOff(from, to) }
}

