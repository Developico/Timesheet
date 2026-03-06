"use client"
import { useEffect, useState } from 'react'
import { getOrLoad, peekState } from '@/lib/client-cache'
import { CACHE_TTL_MS, CACHE_STALE_WINDOW_MS } from '@/lib/constants'

export interface BasicConsultant { id: string; name: string; email?: string; avatarUrl?: string; isActive?: boolean }

export function useConsultants() {
  const [consultants, setConsultants] = useState<BasicConsultant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(()=>{
    let cancelled = false
    setError(null)
    const key = 'consultants:v1'
    const stateBefore = peekState(key)
    if (stateBefore === 'stale') setRefreshing(true)
    getOrLoad<BasicConsultant[]>(
      key,
      async () => {
        const res = await fetch('/api/dataverse/consultants')
        if(!res.ok) throw new Error('Consultants '+res.status)
        const json = await res.json()
        return Array.isArray(json.value)? json.value: []
      },
      {
        ttlMs: CACHE_TTL_MS,
        staleWindowMs: CACHE_STALE_WINDOW_MS,
        onBackgroundRefresh: fresh => { if(!cancelled){ setConsultants(fresh); setRefreshing(false) } }
      }
    )
      .then(({ value }) => { if(!cancelled){ setConsultants(value); if(stateBefore !== 'stale') setRefreshing(false); setLoading(false) } })
      .catch(e => { if(!cancelled){ setError(e.message||'Failed to load consultants'); setLoading(false); setRefreshing(false) } })

    return () => { cancelled = true }
  },[])

  return { consultants, loading, error, refreshing }
}
