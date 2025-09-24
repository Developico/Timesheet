'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useBrowserTabProtection } from './use-browser-tab-protection'

/**
 * Hook that completely blocks state changes during window focus events
 */
export function useUltraStablePanelState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState)
  const isBlocked = useRef(false)
  const lastValidState = useRef<T>(initialState)
  const { isTabSwitching } = useBrowserTabProtection()
  
  // Block all state changes for a period after window events
  const blockStateChanges = useCallback(() => {
    isBlocked.current = true
    setTimeout(() => {
      isBlocked.current = false
    }, 1000) // Extended block period
  }, [])
  
  // Listen for ALL possible window events
  useEffect(() => {
    const events = [
      'focus', 'blur', 'visibilitychange', 
      'pageshow', 'pagehide', 'load', 'unload',
      'beforeunload', 'resize', 'scroll'
    ]
    
    const eventHandler = (event: Event) => {
      blockStateChanges()
    }
    
    events.forEach(event => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, eventHandler)
      } else {
        window.addEventListener(event, eventHandler)
      }
    })
    
    return () => {
      events.forEach(event => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, eventHandler)
        } else {
          window.removeEventListener(event, eventHandler)
        }
      })
    }
  }, [blockStateChanges])
  
  // Ultra-stable setter
  const setStateStable = useCallback((newState: T | ((prev: T) => T)) => {
    // Double protection: both our block and tab switching
    if (isBlocked.current || isTabSwitching()) {
      setState(lastValidState.current)
      return
    }
    
    const finalState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(state)
      : newState
    
    lastValidState.current = finalState
    setState(finalState)
  }, [state, isTabSwitching])
  
  // Update last valid state when state changes normally
  useEffect(() => {
    if (!isBlocked.current) {
      lastValidState.current = state
    }
  }, [state])
  
  return [state, setStateStable] as const
}