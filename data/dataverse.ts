import type { IDataSource } from "./interfaces"
import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"

// TODO: Implement Dataverse integration
// This is a placeholder for future Dataverse implementation

export class DataverseDataSource implements IDataSource {
  async getConsultants(): Promise<Consultant[]> {
    // TODO: Implement Dataverse query
    // Table: ts_Consultant
    // Fields: fullname, internalemailaddress, avatar (optional)
    // Query: SELECT fullname, internalemailaddress FROM ts_consultant WHERE statecode = 0
    throw new Error("Dataverse integration not implemented yet")
  }

  async getProjects(): Promise<Project[]> {
    // TODO: Implement Dataverse query
    // Table: ts_Project
    // Fields: ts_code, ts_client, ts_name, ts_meta, ts_note, ts_billable
    // Query: SELECT ts_code, ts_client, ts_name, ts_meta, ts_note, ts_billable FROM ts_project WHERE statecode = 0
    throw new Error("Dataverse integration not implemented yet")
  }

  async getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> {
    // TODO: Implement Dataverse query with filters
    // Table: ts_TimeEntry
    // Fields: ts_date, ts_hours, ts_billable, ts_note
    // Lookups: ts_Project (ts_project), ts_Consultant (ts_consultant)
    // Query with $select, $expand, $filter for date range, consultant, projects, billable status
    // Example: GET /api/data/v9.2/ts_timeentries?$select=ts_date,ts_hours,ts_billable,ts_note&$expand=ts_project,ts_consultant&$filter=ts_date ge '2024-01-01' and ts_date le '2024-01-31'
    throw new Error("Dataverse integration not implemented yet")
  }
}

// Mapper functions for future implementation
export function mapDataverseConsultant(record: any): Consultant {
  // TODO: Map Dataverse consultant record to Consultant interface
  return {
    id: record.ts_consultantid,
    name: record.fullname,
    email: record.internalemailaddress,
    avatarUrl: record.avatar || undefined,
  }
}

export function mapDataverseProject(record: any): Project {
  // TODO: Map Dataverse project record to Project interface
  return {
    id: record.ts_projectid,
    code: record.ts_code,
    client: record.ts_client,
    name: record.ts_name,
    meta: record.ts_meta,
    note: record.ts_note,
    billable: record.ts_billable,
    assigned: true, // TODO: Determine from relationship
    color: "#01EED4", // TODO: Generate or store color
  }
}

export function mapDataverseTimeEntry(record: any): TimeEntry {
  // TODO: Map Dataverse time entry record to TimeEntry interface
  return {
    id: record.ts_timeentryid,
    date: record.ts_date,
    consultantId: record._ts_consultant_value,
    projectId: record._ts_project_value,
    hours: record.ts_hours,
    billable: record.ts_billable,
    note: record.ts_note,
  }
}
