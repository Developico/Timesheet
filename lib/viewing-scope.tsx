"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"

interface ViewingScopeContextValue {
  consultantId: string | null
  setConsultant: (id: string | null) => void
  recent: string[]
  clear: () => void
}

const ViewingScopeContext = createContext<ViewingScopeContextValue | undefined>(undefined)

const STORAGE_KEY = "viewingScope.consultantId"
const RECENT_KEY = "viewingScope.recent"

export function ViewingScopeProvider({ children }: { children: ReactNode }) {
  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) setConsultantId(stored)
      const r = sessionStorage.getItem(RECENT_KEY)
      if (r) setRecent(JSON.parse(r))
    } catch {}
  }, [])

  const persist = (id: string | null, nextRecent: string[]) => {
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id)
      else sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent.slice(0, 5)))
    } catch {}
  }

  const setConsultant = useCallback((id: string | null) => {
    setConsultantId(id)
    setRecent((prev) => {
      const next = id ? [id, ...prev.filter((p) => p !== id)] : prev
      persist(id, next)
      return next
    })
  }, [])

  const clear = useCallback(() => setConsultant(null), [setConsultant])

  return (
    <ViewingScopeContext.Provider value={{ consultantId, setConsultant, recent, clear }}>
      {children}
    </ViewingScopeContext.Provider>
  )
}

export function useViewingScope() {
  const ctx = useContext(ViewingScopeContext)
  if (!ctx) throw new Error("useViewingScope must be used within ViewingScopeProvider")
  return ctx
}
