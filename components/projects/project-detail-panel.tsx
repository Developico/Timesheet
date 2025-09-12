"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { createPortal } from "react-dom"
import { useNewProjects } from "@/lib/use-new-projects"
import { toast } from "@/hooks/use-toast"
import type { Project } from "@/lib/data"
import { useFilters } from "@/lib/filter-context"
import { useConsultants } from "@/hooks/use-consultants"
import { useAuth } from "@/lib/auth-client"
import { useViewingScope } from "@/lib/viewing-scope"
import { Copy as CopyIcon } from "lucide-react"

interface EntryLike { id?: string; date?: string; consultantId?: string; hours: number; billable: boolean; isAbsence?: boolean; note?: string; task?: string; description?: string }

interface ProjectDetailPanelProps {
  project: Project | (Partial<Project> & { id: string; code: string; name: string; color: string; billable: boolean; allUsers?: boolean })
  entries?: EntryLike[]
  scopeLabel?: string
  onClose: () => void
}

export function ProjectDetailPanel({ project, entries, scopeLabel = "Current scope", onClose }: ProjectDetailPanelProps) {
  const hasAllUsers = (p: ProjectDetailPanelProps['project']): p is Project & { allUsers: boolean } => {
    return (p as { allUsers?: unknown }).allUsers === true
  }
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const { markViewed } = useNewProjects()
  const [copied, setCopied] = useState(false)
  const [showReports, setShowReports] = useState(true)
  const [showAllTeam, setShowAllTeam] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Pull global filtered entries and scope to this project, fallback to provided entries if any
  const { filteredTimeEntries } = useFilters()
  const projectEntriesAll = useMemo(() => filteredTimeEntries.filter(e => e.projectId === project.id), [filteredTimeEntries, project.id])
  const scopedEntries: EntryLike[] = useMemo(() => entries && entries.length ? entries : projectEntriesAll, [entries, projectEntriesAll])

  // Resolve consultants and current user
  const { consultants } = useConsultants()
  const { user } = useAuth()
  const { consultantId: viewingConsultantId } = useViewingScope()
  const currentConsultant = useMemo(() => {
    if (!consultants?.length) return null
    if (user?.email) {
      const lower = user.email.toLowerCase()
      const found = consultants.find(c => c.email?.toLowerCase() === lower)
      if (found) return found
    }
    return consultants[0]
  }, [consultants, user?.email])

  // Entries are already scoped by FilterProvider (date range + ViewingScope). Don't re-filter by consultant to avoid mismatches.
  const myEntries = useMemo(() => scopedEntries.filter(e => !e.isAbsence), [scopedEntries])

  const myEntriesSorted = useMemo(() => {
    return [...myEntries].sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0
      const bd = b.date ? new Date(b.date).getTime() : 0
      return bd - ad // newest first
    })
  }, [myEntries])

  // Full team independent of date filters: fetch from API using ProjectUser relation.
  const [teamIds, setTeamIds] = useState<string[] | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  useEffect(() => {
    let ignore = false
    setTeamError(null)
    setTeamIds(null)
    fetch(`/api/dataverse/project-team?projectId=${project.id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('project-team ' + r.status)))
      .then(json => { if (!ignore && json?.value) setTeamIds(json.value as string[]) })
      .catch(err => { if (!ignore) setTeamError(err?.message || 'Failed to load team') })
    return () => { ignore = true }
  }, [project.id])

  const teamByConsultant = useMemo(() => {
    // Build a map seeded with team members (zero hours by default), then add scoped entries hours breakdown.
    const map = new Map<string, { consultantId: string; hours: number; billable: number; nonBillable: number }>()
    const baseIds = teamIds && teamIds.length ? teamIds : Array.from(new Set(scopedEntries.map(e => e.consultantId || (currentConsultant?.id || 'unknown'))))
    for (const id of baseIds) {
      if (!id) continue
      map.set(id, { consultantId: id, hours: 0, billable: 0, nonBillable: 0 })
    }
    for (const e of scopedEntries) {
      const cid = e.consultantId || (currentConsultant?.id || 'unknown')
      const cur = map.get(cid) || { consultantId: cid, hours: 0, billable: 0, nonBillable: 0 }
      cur.hours += e.hours
      if (e.billable) cur.billable += e.hours
      else cur.nonBillable += e.hours
      map.set(cid, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [scopedEntries, currentConsultant?.id, teamIds])

  // Simplified summary
  const total = scopedEntries.reduce((s, e) => s + e.hours, 0)
  const myHours = myEntries.reduce((s, e) => s + e.hours, 0)
  const mySharePct = total ? (myHours / total) * 100 : 0
  const projectTypeLabel = project.billable ? 'Billable' : 'Non-billable'

  useEffect(() => {
    markViewed(project.id)
    setMounted(true)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, markViewed, project.id])

  // Dynamic CSS for project color & share width
  useAggregatedDynamicCss(`project-panel-${project.id}`, `#project-panel-${project.id} [data-project-color]{background:${project.color};} #project-panel-${project.id} [data-share]{width:${mySharePct.toFixed(2)}%;}`)
  const content = (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div id={`project-panel-${project.id}`} ref={panelRef} className="fixed top-0 right-0 h-full w-[400px] bg-background border-l shadow-xl flex flex-col z-50 animate-in slide-in-from-right duration-200 outline-none" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line */}
              <span
                className="w-4 h-4 rounded-full shrink-0"
                data-project-color
                aria-hidden="true"
              />
              <span id="project-detail-title" className="font-mono text-sm font-semibold truncate">{project.code}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(project.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); markViewed(project.id); toast({ title: 'Copied', description: `${project.code} copied to clipboard` }); }); }}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                title="Copy project code"
                aria-label="Copy project code"
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <h2 className="font-semibold leading-tight break-words">{project.name}</h2>
            {"client" in project && (project as Project).client && <p className="text-xs text-muted-foreground truncate">{(project as Project).client}</p>}
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60" aria-label="Close project details">✕</button>
        </div>
  <div className="p-5 flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Simplified summary */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-medium ${project.billable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>{projectTypeLabel}</span>
              <span className="text-muted-foreground">•</span>
              <span>Total: <span className="font-semibold">{total.toFixed(1)}h</span></span>
              <span className="text-muted-foreground">•</span>
              <span>Your: <span className="font-semibold">{myHours.toFixed(1)}h</span></span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1 text-xs"><span>Your share</span><span className="font-medium">{mySharePct.toFixed(1)}%</span></div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                {/* eslint-disable-next-line */}
                <div
                  className="h-full bg-[#6eedd9]"
                  data-share
                  aria-label="Your share percentage"
                />
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Team{hasAllUsers(project) ? '' : ` (${teamByConsultant.length})`}
              </h3>
              {!hasAllUsers(project) && teamByConsultant.length > 8 && (
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={()=>setShowAllTeam(s=>!s)}>
                  {showAllTeam ? 'Pokaż mniej' : 'Pokaż wszystkich'}
                </button>
              )}
            </div>
             {hasAllUsers(project) ? (
               <div className="text-sm text-muted-foreground">All Users — wszyscy użytkownicy mają dostęp do tego projektu.</div>
             ) : (
               (teamIds && teamIds.length === 0) ? (
                 <div className="text-sm text-muted-foreground">No team members assigned.</div>
               ) : teamError ? (
                 <div className="text-sm text-muted-foreground">Team error: {teamError}. Showing only members with hours in current scope.</div>
               ) : (
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {(showAllTeam ? teamByConsultant : teamByConsultant.slice(0,8)).map(t => {
                     const c = consultants.find(cc => cc.id === t.consultantId)
                     return (
                       <div key={t.consultantId} className="flex items-center text-sm">
                         <div className="flex items-center gap-2 min-w-0">
                           <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                             {c?.avatarUrl ? (
                               // eslint-disable-next-line @next/next/no-img-element
                               <img src={c.avatarUrl} alt={c.name} className="w-6 h-6 object-cover" />
                             ) : (
                               (c?.name ? c.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase() : '•')
                             )}
                           </div>
                           <div className="truncate">
                             <div className="font-medium truncate">{c?.name || 'Unknown'}</div>
                             {c?.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
                           </div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               )
             )}
           </div>

      {/* Reports */}
      <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Reports</h3>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowReports(s => !s)}>{showReports ? 'Hide' : 'Show'}</button>
            </div>
            {showReports && (
              myEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No personal entries in this scope.</div>
              ) : (
        <div className="space-y-1 flex-1 min-h-0 overflow-auto pr-1">
                  {myEntriesSorted.slice(0, 30).map(e => {
                    const taskText = (e as EntryLike & { Task?: string }).Task ?? e.task ?? e.note ?? e.description ?? '(no task name)'
                    return (
                      <div key={e.id || Math.random().toString(36)} className="flex items-center justify-between text-[12px] rounded-md px-2 py-1 bg-background/60 dark:bg-white/8 border border-border/50 dark:border-white/10">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] px-1 py-0.5 rounded ${e.billable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>{e.billable ? 'B' : 'NB'}</span>
                          <div className="min-w-0">
                            <div className="text-[11px] text-muted-foreground">{e.date ? new Date(e.date).toLocaleDateString() : ''}</div>
                            <div className="truncate">{taskText}</div>
                          </div>
                        </div>
                        <div className="shrink-0 tabular-nums">{e.hours.toFixed(1)}h</div>
                      </div>
                    )
                  })}
                  {myEntriesSorted.length > 30 && <div className="text-xs text-muted-foreground">Showing 30 of {myEntriesSorted.length} entries…</div>}
                </div>
              )
            )}
          </div>

      {"note" in project && (project as Project).note && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{(project as Project).note}</p>
            </div>
          )}

          <div className="pt-2 border-t" />
          <div className="text-[11px] text-muted-foreground">Scope: {scopeLabel}</div>
        </div>
      </div>
    </>
  )

  if (!mounted) return null
  return createPortal(content, document.body)
}
