'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Hook to maintain stable panel/drawer state that doesn't reset on window focus changes
 */
export function useStablePanelState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState)
  const stateRef = useRef<T>(state)
  const isWindowEventInProgress = useRef(false)
  const lastUserAction = useRef(Date.now())
  
  // Update ref when state changes normally (from user actions)
  useEffect(() => {
    if (!isWindowEventInProgress.current) {
      stateRef.current = state
      lastUserAction.current = Date.now()
    }
  }, [state])
  
  // Track window focus/visibility changes and block state changes during these events
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('🚨 WINDOW EVENT: visibilitychange')
      isWindowEventInProgress.current = true
      // Extended delay to cover all related events
      setTimeout(() => {
        isWindowEventInProgress.current = false
      }, 500)
    }
    
    const handleFocus = () => {
      console.log('🚨 WINDOW EVENT: focus')
      isWindowEventInProgress.current = true
      setTimeout(() => {
        isWindowEventInProgress.current = false
      }, 500)
    }
    
    const handleBlur = () => {
      console.log('🚨 WINDOW EVENT: blur')
      isWindowEventInProgress.current = true
      setTimeout(() => {
        isWindowEventInProgress.current = false
      }, 200)
    }
    
    // Also listen for page show/hide events
    const handlePageShow = () => {
      isWindowEventInProgress.current = true
      setTimeout(() => {
        isWindowEventInProgress.current = false
      }, 500)
    }
    
    const handlePageHide = () => {
      isWindowEventInProgress.current = true
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])
  
  // Stable setter that completely ignores changes during window events
  const stableSetState = useCallback((newState: T | ((prev: T) => T)) => {
    // If a window event is in progress, completely ignore the state change
    if (isWindowEventInProgress.current) {
      console.log('🔒 BLOCKED: Ignoring state change during window event', newState)
      // Restore the last known stable state instead
      setState(stateRef.current)
      return
    }
    
    // Check if this is too soon after a window event (additional protection)
    const now = Date.now()
    if (now - lastUserAction.current < 100) {
      console.log('🔒 BLOCKED: State change too soon after window event', newState)
      setState(stateRef.current)
      return
    }
    
    console.log('✅ ALLOWED: State change', newState)
    // Normal state update
    setState(newState)
  }, [])
  
  return [state, stableSetState] as const
}