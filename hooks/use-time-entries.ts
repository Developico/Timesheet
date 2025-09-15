"use client"
import { useEffect, useState } from 'react'
import { getOrLoad, peekState } from '@/lib/client-cache'

export interface BasicTimeEntry { id: string; date: string; projectId: string; consultantId: string; hours: number; billable: boolean; note?: string }

interface Options { from: string; to: string; projectIds?: string[]; billable?: 'true'|'false'|'all' }

export function useTimeEntries(opts: Options) {
  const { from, to, projectIds, billable } = opts
  const [entries, setEntries] = useState<BasicTimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(()=>{
    let cancelled = false
    setError(null)
    const params = new URLSearchParams({ from, to })
    if (projectIds?.length) params.set('projectIds', projectIds.join(','))
    if (billable) params.set('billable', billable)
    const key = `timeEntries:v1:${from}:${to}:${projectIds?.join(',')||'-'}:${billable||'-'}`

    const stateBefore = peekState(key)
    if (stateBefore === 'stale') setRefreshing(true)
    getOrLoad<BasicTimeEntry[]>(
      key,
      async () => {
        const res = await fetch(`/api/dataverse/timeentries?${params.toString()}`)
        if(!res.ok) throw new Error('TimeEntries '+res.status)
        const json = await res.json()
        return Array.isArray(json.value)? json.value: []
      },
      {
        ttlMs: 30_000,            // 30s fresh
        staleWindowMs: 5 * 60_000, // 5 min stale
        onBackgroundRefresh: fresh => { if(!cancelled){ setEntries(fresh); setRefreshing(false) } }
      }
    )
      .then(({ value }) => { if(!cancelled){ setEntries(value); if(stateBefore !== 'stale') setRefreshing(false); setLoading(false) } })
      .catch(e => { if(!cancelled){ setError(e.message||'Failed to load time entries'); setLoading(false); setRefreshing(false) } })

    return ()=>{ cancelled = true }
  },[from,to,projectIds?.join(','),billable])

  return { entries, loading, error, refreshing }
}
