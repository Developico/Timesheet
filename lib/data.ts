// Mock data for timesheet application
export interface TimesheetEntry {
  id: string
  date: string
  project: string
  task: string
  hours: number
  status: "approved" | "pending" | "rejected"
  employee: string
  description?: string
}

export interface TimeEntry {
  id: string
  date: string
  projectId: string
  consultantId: string
  hours: number
  billable: boolean
  description?: string
  task?: string
}

export interface Consultant {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface Project {
  id: string
  name: string
  client: string
  code: string
  color: string
  status: "active" | "completed" | "on-hold"
  totalHours: number
  budget: number
  progress: number
  startDate: string
  endDate?: string
  billable: boolean
  assigned: boolean
  metaproject?: string
  note?: string
}

export interface KPIData {
  totalHours: number
  totalProjects: number
  activeEmployees: number
  pendingApprovals: number
  weeklyHours: number[]
  monthlyRevenue: number[]
}

export const mockConsultants: Consultant[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@company.com",
    avatar: "/professional-male-avatar.png",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@company.com",
    avatar: "/professional-female-avatar.png",
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike.johnson@company.com",
    avatar: "/professional-male-avatar.png",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah.wilson@company.com",
    avatar: "/professional-female-avatar.png",
  },
  {
    id: "5",
    name: "Alex Chen",
    email: "alex.chen@company.com",
    avatar: "/professional-male-avatar.png",
  },
]

export const mockTimeEntries: TimeEntry[] = [
  {
    id: "1",
    date: "2024-01-15",
    projectId: "1",
    consultantId: "1",
    hours: 8,
    billable: true,
    description: "Frontend development work",
    task: "Development",
  },
  {
    id: "2",
    date: "2024-01-15",
    projectId: "2",
    consultantId: "2",
    hours: 6,
    billable: true,
    description: "UI design and wireframes",
    task: "Design",
  },
  {
    id: "3",
    date: "2024-01-16",
    projectId: "3",
    consultantId: "3",
    hours: 7.5,
    billable: true,
    description: "Backend API development",
    task: "Development",
  },
  {
    id: "4",
    date: "2024-01-16",
    projectId: "1",
    consultantId: "4",
    hours: 4,
    billable: false,
    description: "Testing and QA",
    task: "Testing",
  },
  {
    id: "5",
    date: "2024-01-17",
    projectId: "2",
    consultantId: "1",
    hours: 6.5,
    billable: true,
    description: "Mobile app development",
    task: "Development",
  },
  {
    id: "6",
    date: "2024-01-17",
    projectId: "4",
    consultantId: "5",
    hours: 8,
    billable: true,
    description: "Data analytics implementation",
    task: "Analytics",
  },
  {
    id: "7",
    date: "2024-01-18",
    projectId: "1",
    consultantId: "2",
    hours: 5,
    billable: true,
    description: "UI/UX improvements",
    task: "Design",
  },
  {
    id: "8",
    date: "2024-01-18",
    projectId: "3",
    consultantId: "3",
    hours: 7,
    billable: true,
    description: "Database optimization",
    task: "Development",
  },
]

// Mock data
export const mockTimesheetEntries: TimesheetEntry[] = [
  {
    id: "1",
    date: "2024-01-15",
    project: "Website Redesign",
    task: "Frontend Development",
    hours: 8,
    status: "approved",
    employee: "John Doe",
    description: "Implemented responsive navigation component",
  },
  {
    id: "2",
    date: "2024-01-15",
    project: "Mobile App",
    task: "UI Design",
    hours: 6,
    status: "pending",
    employee: "Jane Smith",
    description: "Created wireframes for user dashboard",
  },
  {
    id: "3",
    date: "2024-01-16",
    project: "E-commerce Platform",
    task: "Backend Development",
    hours: 7.5,
    status: "approved",
    employee: "Mike Johnson",
    description: "Implemented payment gateway integration",
  },
  {
    id: "4",
    date: "2024-01-16",
    project: "Website Redesign",
    task: "Testing",
    hours: 4,
    status: "rejected",
    employee: "Sarah Wilson",
    description: "Cross-browser compatibility testing",
  },
]

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Website Redesign",
    client: "TechCorp Inc.",
    code: "WR-2024",
    color: "#3b82f6",
    status: "active",
    totalHours: 120,
    budget: 15000,
    progress: 75,
    startDate: "2024-01-01",
    endDate: "2024-02-28",
    billable: true,
    assigned: true,
    metaproject: "Digital Transformation",
    note: "High priority client project",
  },
  {
    id: "2",
    name: "Mobile App",
    client: "StartupXYZ",
    code: "MA-2024",
    color: "#10b981",
    status: "active",
    totalHours: 80,
    budget: 12000,
    progress: 45,
    startDate: "2024-01-10",
    billable: true,
    assigned: true,
    metaproject: "Mobile Solutions",
  },
  {
    id: "3",
    name: "E-commerce Platform",
    client: "RetailCo",
    code: "EC-2023",
    color: "#f59e0b",
    status: "completed",
    totalHours: 200,
    budget: 25000,
    progress: 100,
    startDate: "2023-11-01",
    endDate: "2024-01-15",
    billable: true,
    assigned: false,
    metaproject: "E-commerce Suite",
    note: "Successfully delivered on time",
  },
  {
    id: "4",
    name: "Data Analytics Dashboard",
    client: "DataTech Solutions",
    code: "DA-2024",
    color: "#8b5cf6",
    status: "on-hold",
    totalHours: 40,
    budget: 8000,
    progress: 20,
    startDate: "2024-01-05",
    billable: true,
    assigned: true,
    metaproject: "Analytics Platform",
    note: "Waiting for client requirements",
  },
]

export const mockKPIData: KPIData = {
  totalHours: 440,
  totalProjects: 4,
  activeEmployees: 12,
  pendingApprovals: 3,
  weeklyHours: [32, 38, 42, 35, 40, 36, 44],
  monthlyRevenue: [45000, 52000, 48000, 58000, 62000, 55000],
}

// Data layer abstraction for easy switching to Dataverse
export class DataService {
  private useMock: boolean

  constructor() {
    // Legacy flag: real Dataverse integration for UI moved to /api/dataverse + dedicated hooks.
    // Keep DataService always using mock data for now to avoid runtime throws when flag toggled.
    // Once all components are migrated off DataService we can delete it.
    const raw = process.env.NEXT_PUBLIC_USE_MOCK
    this.useMock = true
    if (raw === 'false') {
      // Provide a dev console hint so testers know why data still appears.
      if (typeof window !== 'undefined') {
        console.warn('[DataService] Dataverse path not implemented; still serving mock data.')
      }
    }
  }

  async getTimeEntries(): Promise<TimeEntry[]> {
  return Promise.resolve(mockTimeEntries)
  }

  getConsultants(): Consultant[] {
  return mockConsultants
  }

  getProjects(): Project[] {
  return mockProjects
  }

  async getTimesheetEntries(): Promise<TimesheetEntry[]> {
  return Promise.resolve(mockTimesheetEntries)
  }

  async getKPIData(): Promise<KPIData> {
  return Promise.resolve(mockKPIData)
  }
}

export const dataService = new DataService()
