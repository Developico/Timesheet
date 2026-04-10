"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, Calendar, FolderKanban, FileBarChart } from "lucide-react"
import { useAuth } from "@/lib/auth-client"
import type { TabId } from "./navigation-tabs"

const iconMap = {
  dashboard: LayoutDashboard,
  calendar: Calendar,
  projects: FolderKanban,
  reports: FileBarChart,
} as const

interface MobileBottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { user } = useAuth()

  const tabs: { id: TabId; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "calendar", label: "Calendar" },
    { id: "projects", label: "Projects" },
    ...(user?.role === "Administrator" ? [{ id: "reports" as TabId, label: "Reports" }] : []),
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 h-16">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id]
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 min-w-[4rem] transition-colors",
                isActive
                  ? "bg-[#01EED4] text-[#064e3b]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className={cn("text-[10px] leading-tight", isActive && "font-semibold")}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
