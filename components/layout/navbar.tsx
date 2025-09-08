"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import { useFilters } from "@/lib/filter-context"

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const { filters, updateFilter } = useFilters()

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="flex h-16 items-center justify-between gap-6">
        {/* Logo section */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">D</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Developico</span>
            <span className="text-xs text-muted-foreground">Timesheet</span>
          </div>
        </div>

  <div className="flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative">
            <Input
              placeholder="Search timesheets..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
              className="h-9 pl-4 pr-4 rounded-lg border bg-muted/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 rounded-full p-0 hover:bg-muted"
          >
            <span className="text-sm">{theme === "dark" ? "☀" : "🌙"}</span>
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Avatar className="h-8 w-8">
            <AvatarImage src="/professional-avatar.png" alt="User avatar" />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">JK</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
