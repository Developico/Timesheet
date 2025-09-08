import type { IDataSource } from "./interfaces"
import type { Consultant, Project, TimeEntry, TimeEntryFilters } from "@/types"

export class MockDataSource implements IDataSource {
  private consultants: Consultant[] = [
    {
      id: "1",
      name: "Jan Kowalski",
      email: "jan.kowalski@developico.com",
      avatarUrl: "/professional-avatar.png",
    },
    {
      id: "2",
      name: "Anna Nowak",
      email: "anna.nowak@developico.com",
      avatarUrl: "/professional-female-avatar.png",
    },
    {
      id: "3",
      name: "Piotr Wiśniewski",
      email: "piotr.wisniewski@developico.com",
      avatarUrl: "/professional-male-avatar.png",
    },
  ]

  private projects: Project[] = [
    {
      id: "proj-1",
      code: "DEV-001",
      client: "Acme Corp",
      name: "E-commerce Platform",
      meta: "Web Development",
      note: "React + Node.js application",
      billable: true,
      assigned: true,
      color: "#01EED4",
    },
    {
      id: "proj-2",
      code: "DEV-002",
      client: "TechStart Inc",
      name: "Mobile App Development",
      meta: "Mobile",
      note: "React Native cross-platform app",
      billable: true,
      assigned: true,
      color: "#6B7280",
    },
    {
      id: "proj-3",
      code: "INT-001",
      client: "Internal",
      name: "Team Training",
      meta: "Internal",
      note: "Skills development and training",
      billable: false,
      assigned: true,
      color: "#f59e0b",
    },
    {
      id: "proj-4",
      code: "DEV-003",
      client: "FinTech Solutions",
      name: "Banking Dashboard",
      meta: "Finance",
      note: "Secure financial data visualization",
      billable: true,
      assigned: true,
      color: "#dc2626",
    },
    {
      id: "proj-5",
      code: "DEV-004",
      client: "HealthCare Plus",
      name: "Patient Management System",
      meta: "Healthcare",
      note: "HIPAA compliant patient portal",
      billable: true,
      assigned: false,
      color: "#6366f1",
    },
  ]

  private generateTimeEntries(): TimeEntry[] {
    const entries: TimeEntry[] = []
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30) // Last 30 days

    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + i)

      // Skip weekends
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        continue
      }

      const dateStr = currentDate.toISOString().split("T")[0]

      // Generate 1-3 entries per working day
      const entriesPerDay = Math.floor(Math.random() * 3) + 1

      for (let j = 0; j < entriesPerDay; j++) {
        const consultant = this.consultants[Math.floor(Math.random() * this.consultants.length)]
        const project = this.projects[Math.floor(Math.random() * this.projects.length)]
        const hours = Math.round((Math.random() * 4 + 1) * 2) / 2 // 1-5 hours in 0.5 increments

        entries.push({
          id: `entry-${i}-${j}-${consultant.id}`,
          date: dateStr,
          consultantId: consultant.id,
          projectId: project.id,
          hours,
          billable: project.billable,
          note: `Work on ${project.name} - ${this.getRandomTaskNote()}`,
        })
      }
    }

    return entries
  }

  private getRandomTaskNote(): string {
    const notes = [
      "Development work",
      "Code review and testing",
      "Client meeting and planning",
      "Bug fixes and optimization",
      "Feature implementation",
      "Documentation update",
      "System integration",
      "Performance tuning",
    ]
    return notes[Math.floor(Math.random() * notes.length)]
  }

  async getConsultants(): Promise<Consultant[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100))
    return [...this.consultants]
  }

  async getProjects(): Promise<Project[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100))
    return [...this.projects]
  }

  async getTimeEntries(params: TimeEntryFilters): Promise<TimeEntry[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    let entries = this.generateTimeEntries()

    // Apply filters
    entries = entries.filter((entry) => {
      const entryDate = new Date(entry.date)
      const fromDate = new Date(params.from)
      const toDate = new Date(params.to)

      if (entryDate < fromDate || entryDate > toDate) {
        return false
      }

      if (params.consultantId && entry.consultantId !== params.consultantId) {
        return false
      }

      if (params.projectIds && params.projectIds.length > 0 && !params.projectIds.includes(entry.projectId)) {
        return false
      }

      if (params.billable !== "all" && params.billable !== undefined && entry.billable !== params.billable) {
        return false
      }

      return true
    })

    return entries
  }

  async getProjectAssignments(consultantId: string): Promise<string[]> {
    // Simple mock: user 1 & 2 assigned to first three projects, others to first two
    if (consultantId === "1" || consultantId === "2") return this.projects.slice(0, 3).map(p=>p.id)
    return this.projects.slice(0, 2).map(p=>p.id)
  }

  async getDaysOff(from: string, to: string): Promise<{ date: string; name?: string }[]> {
    // simple deterministic mock: every 2nd Friday is day off
    const out: { date: string; name: string }[] = []
    const start = new Date(from)
    const end = new Date(to)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      if (d.getDay() === 5 && Math.floor(d.getDate()/7)%2===0) {
        out.push({ date: d.toISOString().substring(0,10), name: 'Company Day Off' })
      }
    }
    return out
  }
}
