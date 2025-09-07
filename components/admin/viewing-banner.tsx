"use client"

import { X } from "lucide-react"
import { useViewingScope } from "@/lib/viewing-scope"
import { dataService } from "@/lib/data"
import { useAuth } from "@/lib/auth-client"

export function ViewingBanner() {
  const { consultantId, clear } = useViewingScope()
  const { user } = useAuth()
  const isAdmin = user?.role === "Administrator"
  if (!isAdmin || !consultantId) return null
  const c = dataService.getConsultants().find(c=>c.id===consultantId)
  if (!c) return null
  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs tracking-wide flex items-center justify-center gap-2 py-1 px-4">
      <span>Filtering data by: <strong className="font-semibold">{c.name}</strong></span>
      <button onClick={clear} className="inline-flex items-center gap-1 hover:underline">
        <X className="h-3 w-3" /> Clear
      </button>
    </div>
  )
}
