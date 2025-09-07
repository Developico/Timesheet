"use client"

import { useState, useEffect, useMemo } from "react"
import { User, X, Search, ArrowLeft } from "lucide-react"
import { useViewingScope } from "@/lib/viewing-scope"
import { dataService } from "@/lib/data"
import { useAuth } from "@/lib/auth-client"

export function ConsultantDock() {
  const { user } = useAuth()
  const isAdmin = user?.role === "Administrator"
  const { consultantId, setConsultant, recent, clear } = useViewingScope()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  // keyboard shortcut Ctrl+Shift+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  if (!isAdmin) return null

  const consultants = dataService.getConsultants()
  const active = consultants.find((c) => c.id === consultantId)

  const filtered = useMemo(() => {
    if (!query.trim()) return consultants
    const q = query.toLowerCase()
    return consultants.filter((c) => c.name.toLowerCase().includes(q))
  }, [consultants, query])

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={consultantId ? `Filtering by ${active?.name}. Change` : "Open consultant filter"}
        aria-pressed={open}
        className={`fixed z-50 bottom-6 right-6 h-12 w-12 rounded-full flex items-center justify-center border backdrop-blur-md bg-background/70 shadow-md transition-all hover:shadow-lg hover:scale-105 focus:outline-none focus-visible:ring-2 ring-offset-2 ring-[#6eedd9] ${consultantId ? "ring-2 ring-[#6eedd9]" : ""}`}
      >
        <div className="relative">
          <User className="h-6 w-6 text-foreground" />
          {consultantId && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#6eedd9] shadow" />
          )}
        </div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Consultant filter"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-md bg-background border rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <button
                className="p-2 rounded-md hover:bg-muted transition-colors"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search consultant..."
                  className="pl-8 pr-3 py-2 w-full text-sm rounded-md bg-muted/50 focus:bg-background border focus:outline-none focus:ring-2 focus:ring-[#6eedd9]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {consultantId && (
                <button
                  className="p-2 rounded-md hover:bg-muted transition-colors" aria-label="Clear selection"
                  onClick={() => { clear(); setOpen(false) }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {recent.length > 0 && !query && (
              <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-muted-foreground">Recent</div>
            )}
            {recent.length > 0 && !query && (
              <div className="px-2 flex flex-wrap gap-2">
                {recent.filter(r => consultants.some(c=>c.id===r)).map((id) => {
                  const c = consultants.find(c=>c.id===id)!;
                  return (
                    <button key={id} onClick={()=>{ setConsultant(id); setOpen(false) }}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors hover:bg-muted ${consultantId===id? 'bg-[#6eedd9]/20 border-[#6eedd9]' : 'bg-muted/40'}`}
                    >{c.name}</button>
                  )
                })}
              </div>
            )}
            <div className="overflow-y-auto max-h-[60vh] p-2">
              {filtered.map((c) => {
                const activeRow = c.id === consultantId
                return (
                  <button
                    key={c.id}
                    onClick={() => { setConsultant(c.id); setOpen(false) }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border bg-background/60 hover:bg-muted/70 transition-colors mb-1 ${activeRow ? 'border-[#6eedd9] ring-1 ring-[#6eedd9]' : 'border-transparent'}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-200 to-teal-500 text-teal-900 font-semibold flex items-center justify-center text-xs">
                      {c.name.split(' ').map(p=>p[0]).slice(0,2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">Consultant</div>
                    </div>
                    {activeRow && <span className="text-[10px] uppercase tracking-wide text-teal-600">Active</span>}
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">No consultants match.</div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
              <div className="text-[11px] text-muted-foreground">Ctrl+Shift+F</div>
              <div className="flex gap-2">
                {consultantId && (
                  <button
                    onClick={() => clear()}
                    className="text-xs px-3 py-1 rounded-md border hover:bg-muted transition-colors"
                  >Clear</button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs px-3 py-1 rounded-md border hover:bg-muted transition-colors"
                >Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
