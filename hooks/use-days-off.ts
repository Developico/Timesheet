"use client"
import { useEffect, useState } from "react"

export interface DayOff { date: string; name?: string }

interface Options { from: string; to: string; enabled?: boolean }

export function useDaysOff({ from, to, enabled = true }: Options) {
  const [data, setData] = useState<DayOff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let abort = false
    setLoading(true)
    setError(null)
    fetch(`/api/dataverse/days-off?from=${from}&to=${to}`)
      .then(r => { if(!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(json => { if(!abort) setData(Array.isArray(json.value)? json.value:[]) })
      .catch(e => { if(!abort) setError(e.message) })
      .finally(()=> { if(!abort) setLoading(false) })
    return () => { abort = true }
  }, [from, to, enabled])

  const set = new Set(data.map(d=>d.date))
  return { daysOff: data, isDayOff: (iso:string)=> set.has(iso), loading, error }
}
