"use client"
import { useEffect, useState } from 'react'

export interface BasicTimeEntry { id: string; date: string; projectId: string; consultantId: string; hours: number; billable: boolean; note?: string }

interface Options { from: string; to: string; projectIds?: string[]; billable?: 'true'|'false'|'all' }

export function useTimeEntries(opts: Options) {
  const { from, to, projectIds, billable } = opts
  const [entries, setEntries] = useState<BasicTimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  useEffect(()=>{
    let cancelled = false
    async function load(){
      setLoading(true); setError(null)
      try {
        const params = new URLSearchParams({ from, to })
        if (projectIds?.length) params.set('projectIds', projectIds.join(','))
        if (billable) params.set('billable', billable)
        const res = await fetch(`/api/dataverse/timeentries?${params.toString()}`, { cache: 'no-store' })
        if(!res.ok) throw new Error('TimeEntries '+res.status)
        const json = await res.json()
        if(!cancelled) setEntries(Array.isArray(json.value)? json.value: [])
      } catch(e:any){ if(!cancelled) setError(e.message||'Failed to load time entries') }
      finally { if(!cancelled) setLoading(false) }
    }
    load()
    return ()=>{ cancelled = true }
  },[from,to,projectIds?.join(','),billable])

  return { entries, loading, error }
}
