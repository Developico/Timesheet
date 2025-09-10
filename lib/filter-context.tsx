"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import { useViewingScope } from "./viewing-scope"
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
  setTimeEntries: (entries: TimeEntry[]) => void
  effectiveRange: { start: Date; end: Date }
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

const defaultFilters: FilterState = {
  dateRange: "this-month",
  selectedProjects: [],
  selectedConsultants: [],
  entryType: "all",
  searchQuery: "",
  topN: 5,
}

export function FilterProvider({ children, initialTimeEntries, projects }: { children: ReactNode; initialTimeEntries: TimeEntry[]; projects: Project[] }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [timeEntriesState, setTimeEntriesState] = useState<TimeEntry[]>(initialTimeEntries)
  const didHydrateFromCookie = useRef(false)

  // Cookie helpers
  const COOKIE_NAME = "tt_filters"
  const readCookie = (name: string) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\/+^]/g, '\\$&') + '=([^;]*)'))
    return match ? match[1] : null
  }
  const writeCookie = (name: string, value: string, days = 180) => {
    if (typeof document === 'undefined') return
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    const expires = "; expires=" + date.toUTCString()
    document.cookie = `${name}=${value}${expires}; path=/; SameSite=Lax`
  }

  // On mount: hydrate filters from cookie
  useEffect(() => {
    if (didHydrateFromCookie.current) return
    const raw = readCookie(COOKIE_NAME)
    if (!raw) { didHydrateFromCookie.current = true; return }
    try {
      const decoded = decodeURIComponent(raw)
      const obj = JSON.parse(decoded)
      const hydrated: FilterState = {
        ...defaultFilters,
        ...obj,
        startDate: obj.startDate ? new Date(obj.startDate) : undefined,
        endDate: obj.endDate ? new Date(obj.endDate) : undefined,
      }
      setFilters(hydrated)
    } catch {
      // ignore parse errors
    } finally {
      didHydrateFromCookie.current = true
    }
  }, [])

  // Persist filters to cookie when they change
  useEffect(() => {
    // Avoid writing before initial hydration attempt
    if (!didHydrateFromCookie.current) return
    const payload = {
      ...filters,
      startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
      endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
    }
    try {
      writeCookie(COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)))
    } catch {
      // ignore write errors
    }
  }, [filters])
  let viewingScope: ReturnType<typeof useViewingScope> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    viewingScope = useViewingScope()
  } catch {
    // context not mounted yet (e.g. during tests) – ignore
  }

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  // Helper: compute effective date range boundaries ONCE per render based on filters
  const computeEffectiveRange = (): { start: Date; end: Date } => {
    const now = new Date()
    const dr = filters.dateRange
    const r = { start: new Date(now), end: new Date(now) }
    const startOfWeek = (b: Date) => {
      const d = new Date(b)
      const day = d.getDay() === 0 ? 7 : d.getDay()
      d.setDate(d.getDate() - day + 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    if (dr === "this-week") { r.start = startOfWeek(now); r.end = new Date(r.start); r.end.setDate(r.start.getDate() + 6) }
    else if (dr === "previous-week") { r.end = startOfWeek(now); r.end.setDate(r.end.getDate() - 1); r.start = new Date(r.end); r.start.setDate(r.end.getDate() - 6) }
    else if (dr === "this-month") { r.start = new Date(now.getFullYear(), now.getMonth(), 1); r.end = new Date(now.getFullYear(), now.getMonth() + 1, 0) }
    else if (dr === "previous-month" || dr === "last-month") { r.start = new Date(now.getFullYear(), now.getMonth() - 1, 1); r.end = new Date(now.getFullYear(), now.getMonth(), 0) }
    else if (dr === "this-quarter") { const q = Math.floor(now.getMonth() / 3); r.start = new Date(now.getFullYear(), q * 3, 1); r.end = new Date(now.getFullYear(), q * 3 + 3, 0) }
    else if (dr === "previous-quarter") { const q = Math.floor(now.getMonth() / 3) - 1; const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear(); const eff = q < 0 ? 3 : q; r.start = new Date(year, eff * 3, 1); r.end = new Date(year, eff * 3 + 3, 0) }
    else if (dr === "this-year") { r.start = new Date(now.getFullYear(), 0, 1); r.end = new Date(now.getFullYear(), 11, 31) }
    else if (dr === "previous-year") { r.start = new Date(now.getFullYear() - 1, 0, 1); r.end = new Date(now.getFullYear() - 1, 11, 31) }
    else if (dr === "custom" && filters.startDate && filters.endDate) { r.start = filters.startDate; r.end = filters.endDate }
    r.start.setHours(0,0,0,0)
    r.end.setHours(23,59,59,999)
    return r
  }
  const effectiveRange = computeEffectiveRange()

  // Apply filters to time entries (date check uses effectiveRange)
  const effectiveConsultant = viewingScope?.consultantId || null
  const filteredTimeEntries = timeEntriesState.filter((entry) => {
    const entryDate = new Date(entry.date)
    if (entryDate < effectiveRange.start || entryDate > effectiveRange.end) return false

    // Project filter
    if (filters.selectedProjects.length > 0 && !filters.selectedProjects.includes(entry.projectId)) {
      return false
    }

    // Consultant filter
    if (effectiveConsultant) {
      if (entry.consultantId !== effectiveConsultant) return false
    } else if (filters.selectedConsultants.length > 0 && !filters.selectedConsultants.includes(entry.consultantId)) {
      return false
    }

    // Entry type filter
    if (filters.entryType === "billable" && !entry.billable) return false
    if (filters.entryType === "non-billable" && entry.billable) return false

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const project = projects.find((p) => p.id === entry.projectId)
      const fields = [
        project?.name,
        project?.client,
        project?.code,
        (project as any)?.note,
        (project as any)?.metaproject,
        entry.description,
      ]
      const searchText = fields.filter(Boolean).join(' ').toLowerCase()
      if (!searchText.includes(query)) return false
    }

    return true
  })

  // Apply filters to projects
  // When searching, include projects that either:
  // - match by project fields (client, code, name, note/metaproject), OR
  // - have at least one filtered time entry whose description matches the query
  const filteredProjects = projects.filter((project) => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const fields = [
        project.name,
        project.client,
        project.code,
        (project as any)?.note,
        (project as any)?.metaproject,
      ]
      const searchText = fields.filter(Boolean).join(" ").toLowerCase()
      const projectFieldsMatch = searchText.includes(query)
      const entryDescriptionMatch = filteredTimeEntries.some(
        (e) => e.projectId === project.id && (e.description || "").toLowerCase().includes(query)
      )
      if (!(projectFieldsMatch || entryDescriptionMatch)) return false
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
  setTimeEntries: setTimeEntriesState,
  effectiveRange,
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
