"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { TimeEntry, Project } from "@/lib/data"

export interface FilterState {
  dateRange: string
  startDate?: Date
  endDate?: Date
  selectedProjects: string[]
  selectedConsultants: string[]
  entryType: "all" | "billable" | "non-billable"
  searchQuery: string
  topN: number
}

interface FilterContextType {
  filters: FilterState
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  filteredTimeEntries: TimeEntry[]
  filteredProjects: Project[]
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

const defaultFilters: FilterState = {
  dateRange: "this-week",
  selectedProjects: [],
  selectedConsultants: [],
  entryType: "all",
  searchQuery: "",
  topN: 5,
}

export function FilterProvider({
  children,
  timeEntries,
  projects,
}: {
  children: ReactNode
  timeEntries: TimeEntry[]
  projects: Project[]
}) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  // Apply filters to time entries
  const filteredTimeEntries = timeEntries.filter((entry) => {
    // Date range filter
    const entryDate = new Date(entry.date)
    const now = new Date()

    if (filters.dateRange === "this-week") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

      if (entryDate < startOfWeek || entryDate > endOfWeek) return false
    } else if (filters.dateRange === "this-month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      if (entryDate < startOfMonth || entryDate > endOfMonth) return false
    } else if (filters.dateRange === "this-quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1)
      const endOfQuarter = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0)

      if (entryDate < startOfQuarter || entryDate > endOfQuarter) return false
    } else if (filters.dateRange === "this-year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      const endOfYear = new Date(now.getFullYear(), 11, 31)

      if (entryDate < startOfYear || entryDate > endOfYear) return false
    } else if (filters.dateRange === "previous-week") {
      const startOfPrevWeek = new Date(now)
      startOfPrevWeek.setDate(now.getDate() - now.getDay() + 1 - 7) // Previous Monday
      const endOfPrevWeek = new Date(startOfPrevWeek)
      endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6) // Previous Sunday

      if (entryDate < startOfPrevWeek || entryDate > endOfPrevWeek) return false
    } else if (filters.dateRange === "previous-month") {
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      if (entryDate < startOfPrevMonth || entryDate > endOfPrevMonth) return false
    } else if (filters.dateRange === "previous-quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const prevQuarter = currentQuarter - 1 < 0 ? 3 : currentQuarter - 1
      const prevQuarterYear = currentQuarter - 1 < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const startOfPrevQuarter = new Date(prevQuarterYear, prevQuarter * 3, 1)
      const endOfPrevQuarter = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0)

      if (entryDate < startOfPrevQuarter || entryDate > endOfPrevQuarter) return false
    } else if (filters.dateRange === "previous-year") {
      const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1)
      const endOfPrevYear = new Date(now.getFullYear() - 1, 11, 31)

      if (entryDate < startOfPrevYear || entryDate > endOfPrevYear) return false
    } else if (filters.dateRange === "last-month") {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      if (entryDate < startOfLastMonth || entryDate > endOfLastMonth) return false
    } else if (filters.dateRange === "custom" && filters.startDate && filters.endDate) {
      if (entryDate < filters.startDate || entryDate > filters.endDate) return false
    }

    // Project filter
    if (filters.selectedProjects.length > 0 && !filters.selectedProjects.includes(entry.projectId)) {
      return false
    }

    // Consultant filter
    if (filters.selectedConsultants.length > 0 && !filters.selectedConsultants.includes(entry.consultantId)) {
      return false
    }

    // Entry type filter
    if (filters.entryType === "billable" && !entry.billable) return false
    if (filters.entryType === "non-billable" && entry.billable) return false

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const project = projects.find((p) => p.id === entry.projectId)
      const searchText = `${project?.name || ""} ${project?.client || ""} ${entry.description || ""}`.toLowerCase()
      if (!searchText.includes(query)) return false
    }

    return true
  })

  // Apply filters to projects
  const filteredProjects = projects.filter((project) => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchText = `${project.name} ${project.client} ${project.code}`.toLowerCase()
      if (!searchText.includes(query)) return false
    }
    return true
  })

  return (
    <FilterContext.Provider
      value={{
        filters,
        updateFilter,
        resetFilters,
        filteredTimeEntries,
        filteredProjects,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error("useFilters must be used within a FilterProvider")
  }
  return context
}
