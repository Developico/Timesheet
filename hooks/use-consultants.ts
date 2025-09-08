"use client"
import { useEffect, useState } from 'react'

export interface BasicConsultant { id: string; name: string; email?: string; avatarUrl?: string }

export function useConsultants() {
  const [consultants, setConsultants] = useState<BasicConsultant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(()=>{
    let cancelled = false
    async function load(){
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/dataverse/consultants', { cache: 'no-store' })
        if(!res.ok) throw new Error('Consultants '+res.status)
        const json = await res.json()
        if(!cancelled) setConsultants(Array.isArray(json.value)? json.value: [])
      } catch(e:any) {
        if(!cancelled) setError(e.message||'Failed to load consultants')
      } finally { if(!cancelled) setLoading(false) }
    }
    load();
    return ()=>{ cancelled = true }
  },[])

  return { consultants, loading, error }
}
