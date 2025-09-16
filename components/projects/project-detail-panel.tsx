"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAggregatedDynamicCss } from "@/lib/dynamic-styles"
import { createPortal } from "react-dom"
import { useNewProjects } from "@/lib/use-new-projects"
import { toast } from "@/hooks/use-toast"
import type { Project } from "@/lib/data"
import { useFilters } from "@/lib/filter-context"
import { useConsultants } from "@/hooks/use-consultants"
import { InactiveMembers, InactiveResolvedItem } from './inactive-members'
import { useAuth } from "@/lib/auth-client"
import { useViewingScope } from "@/lib/viewing-scope"
import { Copy as CopyIcon, ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react"

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
  // Accordion open states
  const [openSections, setOpenSections] = useState<{team:boolean;reports:boolean;notes:boolean}>({team:true,reports:true,notes:true})
  const [showAllTeam, setShowAllTeam] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)

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

  // Restrict personal entries strictly to current (viewing scope or resolved) consultant for Reports.
  const effectiveConsultantId = viewingConsultantId || currentConsultant?.id || null
  const myEntries = useMemo(() => scopedEntries.filter(e => !e.isAbsence && (!effectiveConsultantId || e.consultantId === effectiveConsultantId)), [scopedEntries, effectiveConsultantId])

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

  // Hydrate persisted UI state
  useEffect(()=>{
    try {
      if(typeof window === 'undefined') return
      const rawExp = localStorage.getItem('tt_panel_expanded')
      if(rawExp) setExpanded(rawExp === '1')
      const rawSec = localStorage.getItem('tt_panel_sections')
      if(rawSec){
        const parsed = JSON.parse(rawSec)
        setOpenSections(o=> ({...o, ...parsed}))
      }
    } catch {/* ignore */}
  },[])

  useEffect(()=>{ try { if(typeof window!=='undefined') localStorage.setItem('tt_panel_expanded', expanded ? '1':'0') } catch {/* ignore */} },[expanded])
  useEffect(()=>{ try { if(typeof window!=='undefined') localStorage.setItem('tt_panel_sections', JSON.stringify(openSections)) } catch {/* ignore */} },[openSections])

  useEffect(() => {
    markViewed(project.id)
    setMounted(true)
    // store opener for focus return
    openerRef.current = document.activeElement as HTMLElement | null
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
    return () => {
      window.removeEventListener('keydown', handleKey)
      // Restore focus
      if(openerRef.current && document.contains(openerRef.current)) {
        openerRef.current.focus()
      }
    }
  }, [onClose, markViewed, project.id])

  // Dynamic CSS for project color & share width
  useAggregatedDynamicCss(`project-panel-${project.id}`, `#project-panel-${project.id} [data-project-color]{background:${project.color};} #project-panel-${project.id} [data-share]{width:${mySharePct.toFixed(2)}%;}`)
  const content = (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} aria-hidden="true" />
  <div
    id={`project-panel-${project.id}`}
    ref={panelRef}
    className={`fixed top-0 right-0 h-full w-full sm:w-[400px] ${expanded ? 'sm:w-[560px]' : ''} bg-white dark:bg-[oklch(0.18_0_0)] supports-[backdrop-filter]:backdrop-blur border-l sm:border-l shadow-xl flex flex-col z-50 animate-in slide-in-from-right duration-200 outline-none overflow-y-auto`}
    role="dialog"
    aria-modal="true"
    aria-labelledby="project-detail-title"
  >
          <div className="sticky top-0 z-10 p-5 border-b flex items-start justify-between gap-4 bg-white/95 dark:bg-[oklch(0.18_0_0)/95] backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-[oklch(0.18_0_0)/85]">
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={()=> setExpanded(e=> !e)}
              className="text-xs px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted transition-colors flex items-center gap-1"
              aria-label={expanded ? 'Collapse panel width' : 'Expand panel width'}
            >
              {expanded ? <Minimize2 className="h-3 w-3"/> : <Maximize2 className="h-3 w-3"/>}
              <span className="hidden sm:inline">{expanded ? 'Shrink' : 'Expand'}</span>
            </button>
          <button ref={closeBtnRef} onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60" aria-label="Close project details">✕</button>
          </div>
        </div>
  <div className="p-5 flex-1 flex flex-col gap-6">
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

          {/* Accordion: Team */}
          <div className="border rounded-md overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
              aria-controls="panel-team"
              data-state={openSections.team ? 'open':'closed'}
              onClick={()=> setOpenSections(s=> ({...s, team: !s.team}))}
            >
              <span className="flex items-center gap-1">{openSections.team ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>} Team{hasAllUsers(project) ? ' (All)' : ` (${teamByConsultant.length})`}</span>
              {!hasAllUsers(project) && teamByConsultant.length > 8 && (
                <span className="text-[10px] opacity-70">{showAllTeam ? 'FULL' : 'PARTIAL'}</span>
              )}
            </button>
            {openSections.team && (
              <div id="panel-team" className="px-3 pb-3 pt-1 space-y-2 text-sm">
                {hasAllUsers(project) ? (
                  <div className="text-muted-foreground text-xs leading-relaxed">All Users — wszyscy użytkownicy mają dostęp do tego projektu.</div>
                ) : (
                  (teamIds && teamIds.length === 0) ? (
                    <div className="text-muted-foreground">No team members assigned.</div>
                  ) : teamError ? (
                    <div className="text-muted-foreground">Team error: {teamError}. Showing only members with hours in current scope.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                      {(() => {
                        const resolvedFull = teamByConsultant.map(t => ({ t, c: consultants.find(cc => cc.id === t.consultantId) }))
                        const inactive = resolvedFull.filter(i => i.c && (i.c as any).isActive === false)
                        const activeAll = resolvedFull.filter(i => i.c && (i.c as any).isActive !== false)
                        const activeVisible = showAllTeam ? activeAll : activeAll.slice(0,8)
                        return (
                          <>
                            <div className="flex flex-col gap-1">
                              {activeVisible.map(({ t, c }) => (
                                <div key={t.consultantId} className="flex items-center text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                                      {c && (c as any).avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={(c as any).avatarUrl} alt={c.name} className="w-6 h-6 object-cover" />
                                      ) : (
                                        (c?.name ? c.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase() : '•')
                                      )}
                                    </div>
                                    <div className="truncate">
                                      <div className="font-medium truncate">{c?.name || 'Unknown'}</div>
                                      {c?.email && <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {inactive.length > 0 && (
                              <InactiveMembers items={inactive as InactiveResolvedItem[]} />
                            )}
                            {!hasAllUsers(project) && teamByConsultant.length > 8 && (
                              <button type="button" onClick={()=> setShowAllTeam(s=> !s)} className="text-[10px] text-muted-foreground hover:text-foreground mt-1">
                                {showAllTeam ? 'Show less' : 'Show all'}
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

      {/* Accordion: Reports */}
      <div className="border rounded-md overflow-hidden flex-1 min-h-0 flex flex-col">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
          aria-controls="panel-reports"
          data-state={openSections.reports ? 'open':'closed'}
          onClick={()=> setOpenSections(s=> ({...s, reports: !s.reports}))}
        >
          <span className="flex items-center gap-1">{openSections.reports ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>} Reports</span>
          <span className="text-[10px] opacity-60">{myEntries.length}</span>
        </button>
        {openSections.reports && (
          <div id="panel-reports" className="px-3 pt-1 pb-3 flex-1 min-h-0 flex flex-col gap-2">
            {myEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground">No personal entries in this scope.</div>
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
            )}
          </div>
        )}
      </div>

      {/* Accordion: Notes */}
      {"note" in project && (project as Project).note && (
        <div className="border rounded-md overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
            aria-controls="panel-notes"
            data-state={openSections.notes ? 'open':'closed'}
            onClick={()=> setOpenSections(s=> ({...s, notes: !s.notes}))}
          >
            <span className="flex items-center gap-1">{openSections.notes ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>} Notes</span>
          </button>
          {openSections.notes && (
            <div id="panel-notes" className="px-3 pb-3 pt-1 text-sm leading-relaxed whitespace-pre-wrap">
              {(project as Project).note}
            </div>
          )}
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

// InactiveMembers moved to separate file
