"use client"

import { useEffect, useState } from 'react'
import { getOrLoad, peekState } from '@/lib/client-cache'
import { CACHE_TTL_MS, CACHE_STALE_WINDOW_MS } from '@/lib/constants'

export interface BasicProject {
  id: string
  code?: string
  name: string
  client?: string
  color?: string
  billable?: boolean
  assigned?: boolean
  note?: string
}

export function useProjects() {
  const [projects, setProjects] = useState<BasicProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(()=>{
    let cancelled = false
    setError(null)
    // Attempt to get or load with cache (fresh 15m, stale window 2h)
    const key = 'projects:v1'
    const stateBefore = peekState(key)
    if (stateBefore === 'stale') setRefreshing(true)
    getOrLoad<BasicProject[]>(
      key,
      async () => {
        const res = await fetch('/api/dataverse/projects')
        if (!res.ok) throw new Error(`Projects ${res.status}`)
        const json = await res.json()
        return Array.isArray(json.value) ? json.value : []
      },
      {
        ttlMs: CACHE_TTL_MS,
        staleWindowMs: CACHE_STALE_WINDOW_MS,
        onBackgroundRefresh: (fresh) => { if(!cancelled){ setProjects(fresh); setRefreshing(false) } }
      }
    )
      .then(({ value, from }) => {
        if (cancelled) return
        setProjects(value)
        if(stateBefore !== 'stale') setRefreshing(false)
        setLoading(false)
      })
      .catch(e => { if(!cancelled){ setError(e.message||'Failed to load projects'); setLoading(false) } })

    return () => { cancelled = true }
  },[])

  return { projects, loading, error, refreshing }
}
