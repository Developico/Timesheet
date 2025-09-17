"use client"

import { useEffect, useMemo, useState } from 'react'
import { useViewingScope } from '@/lib/viewing-scope'
import { useAuth } from '@/lib/auth-client'

interface GraphMember { aadObjectId: string; name: string; email?: string; upn?: string; consultantId?: string }

export function ViewingScopeSwitcher() {
  const { consultantId, setConsultant, recent } = useViewingScope()
  const { user } = useAuth()
  const [members, setMembers] = useState<GraphMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const isAdmin = user?.role === 'Administrator' || user?.roles?.includes('Administrator')

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/graph/consultants', { cache: 'no-store' })
        if (!res.ok) throw new Error('Graph list failed')
        const json = await res.json()
        if (!cancelled) setMembers(Array.isArray(json.value) ? json.value : [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load users')
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [isAdmin])

  const filtered = useMemo(() => {
    const arr = [...members]
    arr.sort((a, b) => a.name.localeCompare(b.name))
    const query = q.trim().toLowerCase()
    if (!query) return arr
    return arr.filter(m =>
      m.name.toLowerCase().includes(query) ||
      (m.email?.toLowerCase().includes(query)) ||
      (m.upn?.toLowerCase().includes(query))
    )
  }, [members, q])

  if (!isAdmin) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">Viewing as</label>
      <div className="relative">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search user…"
          className="text-sm border rounded px-2 py-1 bg-background w-56"
        />
        {q && (
          <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto bg-[var(--surface-overlay)] text-[var(--text-primary)] border rounded shadow">
            <div className="text-[11px] text-muted-foreground px-2 py-1">{filtered.length} results</div>
            {filtered.map(m => (
              <button
                key={m.aadObjectId}
                className="w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-accent"
                onClick={()=>{ setConsultant(m.consultantId || null); setQ('') }}
              >
                <img
                  src={`/api/graph/users/${encodeURIComponent(m.aadObjectId)}/photo`}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                  onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }}
                />
                <div className="truncate">
                  <div className="text-sm leading-5 truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.email || m.upn}</div>
                </div>
                {!m.consultantId && <span className="ml-auto text-[10px] text-amber-600">no DV link</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <select
        className="text-sm border rounded px-2 py-1 bg-background"
        value={consultantId || ''}
        onChange={(e) => setConsultant(e.target.value || null)}
        aria-label="Select consultant viewing scope"
      >
        <option value="">— Myself —</option>
        {members.sort((a,b)=>a.name.localeCompare(b.name)).map((m) => (
          <option key={m.aadObjectId} value={m.consultantId || ''}>
            {m.name}{m.consultantId ? '' : ' (no DV link)'}
          </option>
        ))}
      </select>
      {recent?.length ? (
        <div className="text-[11px] text-muted-foreground">Recent: {recent.slice(0,3).join(', ')}</div>
      ) : null}
      {loading && <span className="text-[11px] text-muted-foreground">Loading…</span>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  )
}
