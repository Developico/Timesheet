'use client'

import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook that detects and blocks state changes specifically for browser tab switches
 */
export function useBrowserTabProtection() {
  const isTabSwitching = useRef(false)
  const tabSwitchTimeoutRef = useRef<NodeJS.Timeout>()
  
  const blockForTabSwitch = useCallback(() => {
    isTabSwitching.current = true
    
    if (tabSwitchTimeoutRef.current) {
      clearTimeout(tabSwitchTimeoutRef.current)
    }
    
    tabSwitchTimeoutRef.current = setTimeout(() => {
      isTabSwitching.current = false
    }, 3000) // 3 second protection for tab switches
  }, [])
  
  useEffect(() => {
    // Specific handling for browser tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        blockForTabSwitch()
      } else if (document.visibilityState === 'visible') {
        blockForTabSwitch()
      }
    }
    
    // Browser-specific tab focus events
    const handleWindowBlur = () => {
      blockForTabSwitch()
    }
    
    const handleWindowFocus = () => {
      blockForTabSwitch()
    }
    
    // Page navigation events that might affect tab switching
    const handlePageHide = () => {
      blockForTabSwitch()
    }
    
    const handlePageShow = () => {
      blockForTabSwitch()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      
      if (tabSwitchTimeoutRef.current) {
        clearTimeout(tabSwitchTimeoutRef.current)
      }
    }
  }, [blockForTabSwitch])
  
  return {
    isTabSwitching: () => isTabSwitching.current,
    blockForTabSwitch
  }
}