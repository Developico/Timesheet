"use client"

import { X } from "lucide-react"
import { useViewingScope } from "@/lib/viewing-scope"
import { useAuth } from "@/lib/auth-client"
import { useConsultants } from "@/hooks/use-consultants"

export function ViewingBanner() {
  // All hooks at top-level (no conditional early returns before hooks) to satisfy rules-of-hooks lint
  const { consultantId, clear } = useViewingScope()
  const { user } = useAuth()
  const { consultants } = useConsultants()
  const isAdmin = user?.role === "Administrator"
  const consultant = consultantId ? consultants.find(c => c.id === consultantId) : undefined
  if (!isAdmin || !consultantId || !consultant) return null
  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs tracking-wide flex items-center justify-center gap-2 py-1 px-4">
      <span>Filtering data by: <strong className="font-semibold">{consultant.name}</strong></span>
      <button onClick={clear} className="inline-flex items-center gap-1 hover:underline">
        <X className="h-3 w-3" /> Clear
      </button>
    </div>
  )
}
