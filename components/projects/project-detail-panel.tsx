"use client"

import { useEffect, useRef } from "react"
import type { Project } from "@/lib/data"

interface EntryLike { hours: number; billable: boolean; isAbsence?: boolean }

interface ProjectDetailPanelProps {
  project: Project | (Partial<Project> & { id: string; code: string; name: string; color: string; billable: boolean })
  entries: EntryLike[]
  scopeLabel?: string
  onClose: () => void
}

export function ProjectDetailPanel({ project, entries, scopeLabel = "Current scope", onClose }: ProjectDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  const total = entries.reduce((s,e)=>s+e.hours,0)
  const absence = entries.filter(e=>e.isAbsence).reduce((s,e)=>s+e.hours,0)
  const billable = entries.filter(e=>e.billable && !e.isAbsence).reduce((s,e)=>s+e.hours,0)
  const nonBillable = total - billable - absence
  const billablePct = total? (billable/total)*100:0

  useEffect(()=>{
    const handleKey = (e: KeyboardEvent) => {
      if(e.key==='Escape') onClose()
      else if(e.key==='Tab' && panelRef.current){
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el=>!el.hasAttribute('disabled'))
        if(focusable.length===0) return
        const first = focusable[0]
        const last = focusable[focusable.length-1]
        if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus() }
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    closeBtnRef.current?.focus()
    return ()=> window.removeEventListener('keydown', handleKey)
  },[onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="fixed top-0 right-0 h-full w-[380px] bg-background border-l shadow-xl flex flex-col z-50 animate-in slide-in-from-right duration-200 outline-none" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full" style={{backgroundColor: project.color}} />
              <span id="project-detail-title" className="font-mono text-sm font-semibold">{project.code}</span>
            </div>
            <h2 className="font-semibold leading-tight">{project.name}</h2>
            {"client" in project && (project as any).client && <p className="text-xs text-muted-foreground">{(project as any).client}</p>}
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60" aria-label="Close project details">✕</button>
        </div>
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div><div className="font-semibold text-sm">{total.toFixed(1)}h</div></div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Billable</div><div className="font-semibold text-sm text-teal-700">{billable.toFixed(1)}h</div></div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Non-Billable</div><div className="font-semibold text-sm" style={{color:'#174076'}}>{nonBillable.toFixed(1)}h</div></div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Absence</div><div className="font-semibold text-sm text-red-600">{absence.toFixed(1)}h</div></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1 text-xs"><span>Billable %</span><span className="font-medium">{billablePct.toFixed(1)}%</span></div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden"><div className="h-full bg-teal-500" style={{width:`${billablePct}%`}} /></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Status & Budget</h3>
            <div className="text-sm grid grid-cols-2 gap-2">
              {"status" in project && (
                <div>
                  <div className="text-[11px] text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{(project as any).status?.replace('-', ' ') || '—'}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] text-muted-foreground">Billable</div>
                <div className="font-medium">{project.billable? 'Yes':'No'}</div>
              </div>
              {"budget" in project && (project as any).budget!==undefined && (
                <div>
                  <div className="text-[11px] text-muted-foreground">Budget</div>
                  <div className="font-medium">{(project as any).budget.toLocaleString()} USD</div>
                </div>) }
              {"progress" in project && (project as any).progress!==undefined && (
                <div>
                  <div className="text-[11px] text-muted-foreground">Progress</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded bg-muted overflow-hidden"><div className="h-full bg-[#6eedd9]" style={{width:`${(project as any).progress}%`}} /></div>
                    <span className="text-[11px] font-medium">{(project as any).progress}%</span>
                  </div>
                </div>) }
            </div>
          </div>

          {"note" in project && (project as any).note && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{(project as any).note}</p>
            </div>
          )}

          <div className="pt-2 border-t" />
          <div className="text-[11px] text-muted-foreground">Scope: {scopeLabel}</div>
        </div>
      </div>
    </>
  )
}
