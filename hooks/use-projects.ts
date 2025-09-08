"use client"

import { useEffect, useState } from 'react'

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

  useEffect(()=>{
    let cancelled = false
    async function load(){
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/dataverse/projects', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Projects ${res.status}`)
        const json = await res.json()
        if (!cancelled) setProjects(Array.isArray(json.value)? json.value: [])
      } catch(e: any) {
        if (!cancelled) setError(e.message || 'Failed to load projects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  },[])

  return { projects, loading, error }
}
