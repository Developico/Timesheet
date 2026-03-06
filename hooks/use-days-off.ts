"use client"
import { useEffect, useState } from "react"
import { getOrLoad, peekState } from '@/lib/client-cache'
import { CACHE_DAYS_OFF_TTL_MS, CACHE_DAYS_OFF_STALE_WINDOW_MS } from '@/lib/constants'

export interface DayOff { date: string; name?: string }

interface Options { from: string; to: string; enabled?: boolean }

export function useDaysOff({ from, to, enabled = true }: Options) {
  const [data, setData] = useState<DayOff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setError(null)
    const key = `daysoff:v1:${from}:${to}`
    const stateBefore = peekState(key)
    if (stateBefore === 'stale') setRefreshing(true)
    getOrLoad<DayOff[]>(
      key,
      async () => {
        const r = await fetch(`/api/dataverse/days-off?from=${from}&to=${to}`)
        if(!r.ok) throw new Error(String(r.status))
        const json = await r.json()
        return Array.isArray(json.value)? json.value: []
      },
      {
        ttlMs: CACHE_DAYS_OFF_TTL_MS,
        staleWindowMs: CACHE_DAYS_OFF_STALE_WINDOW_MS,
        onBackgroundRefresh: fresh => { if(!cancelled){ setData(fresh); setRefreshing(false) } }
      }
    )
      .then(({ value }) => { if(!cancelled){ setData(value); if(stateBefore !== 'stale') setRefreshing(false); setLoading(false) } })
      .catch(e => { if(!cancelled){ setError(e.message); setLoading(false); setRefreshing(false) } })

    return () => { cancelled = true }
  }, [from, to, enabled])

  const set = new Set(data.map(d=>d.date))
  return { daysOff: data, isDayOff: (iso:string)=> set.has(iso), loading, error, refreshing }
}
