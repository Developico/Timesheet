"use client"

import { useEffect } from 'react'

// Legacy simple injector (kept for backward compatibility in case some code still calls it directly)
export function useDynamicStyles(styleId: string, css: string) {
  useEffect(()=>{
    if(!css) return
    let tag = document.getElementById(styleId) as HTMLStyleElement | null
    if(!tag){
      tag = document.createElement('style')
      tag.id = styleId
      document.head.appendChild(tag)
    }
    tag.textContent = css
  }, [styleId, css])
}

// Central aggregated style tag to reduce DOM nodes.
const AGG_ID = 'app-dynamic-styles'
let aggregated: Record<string,string> = {}

export function useAggregatedDynamicCss(key: string, css: string){
  useEffect(()=>{
    aggregated[key] = css || ''
    let tag = document.getElementById(AGG_ID) as HTMLStyleElement | null
    if(!tag){
      tag = document.createElement('style')
      tag.id = AGG_ID
      document.head.appendChild(tag)
    }
    tag.textContent = Object.entries(aggregated)
      .filter(([,v])=> v && v.trim().length>0)
      .map(([k,v])=>`/* ${k} */\n${v}`)
      .join('\n')
    return () => {
      // clean key (leave tag for reuse)
      delete aggregated[key]
      if(tag){
        tag.textContent = Object.entries(aggregated)
          .filter(([,v])=> v && v.trim().length>0)
          .map(([k,v])=>`/* ${k} */\n${v}`)
          .join('\n')
      }
    }
  }, [key, css])
}
