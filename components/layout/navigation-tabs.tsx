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
                    ? "border-[#01EED4] text-teal-700 dark:text-teal-300 font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="py-2">
            <Select value={filters.dateRange} onValueChange={(value) => updateFilter("dateRange", value)}>
              <SelectTrigger className="w-auto h-9 rounded-lg border bg-muted/50 hover:bg-background transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </nav>
      </div>
    </div>
  )
}
