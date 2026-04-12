"use client"
import { useEffect, useMemo, useState } from 'react'
import { getOrLoad, peekState } from '@/lib/client-cache'
import { CACHE_TTL_MS, CACHE_STALE_WINDOW_MS } from '@/lib/constants'

export interface BasicTimeEntry { id: string; date: string; projectId: string; consultantId: string; hours: number; billable: boolean; note?: string }

interface Options { from: string; to: string; projectIds?: string[]; billable?: 'true'|'false'|'all' }

export function useTimeEntries(opts: Options) {
  const { from, to, projectIds, billable } = opts
  const [entries, setEntries] = useState<BasicTimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const projectIdsKey = useMemo(() => projectIds?.join(',') || '-', [projectIds])

  useEffect(()=>{
    let cancelled = false
    setError(null)
    const params = new URLSearchParams({ from, to })
    if (projectIds?.length) params.set('projectIds', projectIds.join(','))
    if (billable) params.set('billable', billable)
    const key = `timeEntries:v1:${from}:${to}:${projectIdsKey}:${billable||'-'}`

    const stateBefore = peekState(key)
    
    // Don't show loading spinner for cache hits
    if (stateBefore === 'fresh') {
      setLoading(false)
    } else if (stateBefore === 'stale') {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    getOrLoad<BasicTimeEntry[]>(
      key,
      async () => {
        const res = await fetch(`/api/dataverse/timeentries?${params.toString()}`)
        if(!res.ok) throw new Error('TimeEntries '+res.status)
        const json = await res.json()
        return Array.isArray(json.value)? json.value: []
      },
      {
        ttlMs: CACHE_TTL_MS,
        staleWindowMs: CACHE_STALE_WINDOW_MS,
        onBackgroundRefresh: fresh => { if(!cancelled){ setEntries(fresh); setRefreshing(false) } }
      }
    )
      .then(({ value }) => { if(!cancelled){ setEntries(value); if(stateBefore !== 'stale') setRefreshing(false); setLoading(false) } })
      .catch(e => { if(!cancelled){ setError(e.message||'Failed to load time entries'); setLoading(false); setRefreshing(false) } })

    return ()=>{ cancelled = true }
  },[from,to,projectIdsKey,billable])

  return { entries, loading, error, refreshing }
}
