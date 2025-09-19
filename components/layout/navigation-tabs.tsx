"use client"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFilters } from "@/lib/filter-context"

interface NavigationTabsProps {
  activeTab: "dashboard" | "calendar" | "projects"
  onTabChange: (tab: "dashboard" | "calendar" | "projects") => void
}

export function NavigationTabs({ activeTab, onTabChange }: NavigationTabsProps) {
  const { filters, updateFilter } = useFilters()

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard" },
    { id: "calendar" as const, label: "Calendar" },
    { id: "projects" as const, label: "Projects" },
  ]

  const dateRangeOptions = [
    { value: "this-week", label: "This Week" },
    { value: "this-month", label: "This Month" },
    { value: "this-quarter", label: "This Quarter" },
    { value: "this-year", label: "This Year" },
    { value: "previous-week", label: "Previous Week" },
    { value: "previous-month", label: "Previous Month" },
    { value: "previous-quarter", label: "Previous Quarter" },
    { value: "previous-year", label: "Previous Year" },
  ]

  return (
    <div className="border-b bg-background">
      <div className="container px-6">
        <nav className="flex justify-between items-center" aria-label="Tabs">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-[#01EED4] text-teal-400 dark:text-teal-300 font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="py-2">
            {(() => {
              // Compute current date range boundaries to show in native tooltip
              const now = new Date()
              let start: Date | undefined
              let end: Date | undefined
              const dr = filters.dateRange
              const startOfWeek = (base: Date) => {
                const d = new Date(base)
                // Make Monday the first day (ISO week)
                const day = d.getDay() === 0 ? 7 : d.getDay() // Sunday -> 7
                d.setDate(d.getDate() - day + 1)
                d.setHours(0,0,0,0)
                return d
              }
              if (dr === 'this-week') {
                start = startOfWeek(now)
                end = new Date(start)
                end.setDate(start.getDate() + 6)
              } else if (dr === 'previous-week') {
                end = new Date(startOfWeek(now))
                end.setDate(end.getDate() - 1)
                start = new Date(end)
                start.setDate(end.getDate() - 6)
              } else if (dr === 'this-month') {
                start = new Date(now.getFullYear(), now.getMonth(), 1)
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
              } else if (dr === 'previous-month' || dr === 'last-month') {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                end = new Date(now.getFullYear(), now.getMonth(), 0)
              } else if (dr === 'this-quarter') {
                const q = Math.floor(now.getMonth() / 3)
                start = new Date(now.getFullYear(), q * 3, 1)
                end = new Date(now.getFullYear(), q * 3 + 3, 0)
              } else if (dr === 'previous-quarter') {
                const q = Math.floor(now.getMonth() / 3) - 1
                const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
                const effectiveQ = q < 0 ? 3 : q
                start = new Date(year, effectiveQ * 3, 1)
                end = new Date(year, effectiveQ * 3 + 3, 0)
              } else if (dr === 'this-year') {
                start = new Date(now.getFullYear(), 0, 1)
                end = new Date(now.getFullYear(), 11, 31)
              } else if (dr === 'previous-year') {
                start = new Date(now.getFullYear() - 1, 0, 1)
                end = new Date(now.getFullYear() - 1, 11, 31)
              } else if (dr === 'custom' && filters.startDate && filters.endDate) {
                start = filters.startDate
                end = filters.endDate
              }
              const fmt = (d?: Date) => d ? d.toISOString().slice(0,10) : ''
              const title = start && end ? `${fmt(start)} – ${fmt(end)}` : 'Select date range'
              return (
                <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                  {/* Pill style trigger (using existing SelectTrigger component) */}
                  <SelectTrigger
                    title={title}
                    className="h-8 px-4 rounded-full border-0 bg-muted/70 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring text-sm font-medium shadow-xs data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-colors"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[12rem]">
                    {dateRangeOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="data-[state=checked]:font-medium"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })()}
          </div>
        </nav>
      </div>
    </div>
  )
}
