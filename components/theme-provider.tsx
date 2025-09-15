'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

interface HCContextValue { highContrast: boolean; toggleHighContrast: () => void }
const HighContrastContext = React.createContext<HCContextValue | null>(null)
export function useHighContrast(){
  const ctx = React.useContext(HighContrastContext)
  if(!ctx) return { highContrast:false, toggleHighContrast: ()=>{} }
  return ctx
}

interface ThemeProviderWrapperProps extends ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children, ...props }: ThemeProviderWrapperProps) {
  const [highContrast, setHighContrast] = React.useState<boolean>(false)
  // hydrate from localStorage
  React.useEffect(()=>{
    try { const raw = localStorage.getItem('tt_high_contrast'); if(raw==='1') setHighContrast(true) } catch {/* ignore */}
  },[])
  React.useEffect(()=>{
    try { localStorage.setItem('tt_high_contrast', highContrast? '1':'0') } catch {/* ignore */}
    if(typeof document !== 'undefined'){
      const html = document.documentElement
      if(highContrast) html.setAttribute('data-high-contrast',''); else html.removeAttribute('data-high-contrast')
    }
  },[highContrast])
  const toggleHighContrast = React.useCallback(()=> setHighContrast(h=> !h),[])
  return (
    <NextThemesProvider {...props}>
      <HighContrastContext.Provider value={{ highContrast, toggleHighContrast }}>
        {children}
      </HighContrastContext.Provider>
    </NextThemesProvider>
  )
}
