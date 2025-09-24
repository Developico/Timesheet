'use client'

import { useCallback, useRef } from 'react'
import { useBrowserTabProtection } from './use-browser-tab-protection'

/**
 * Ultra-protective backdrop close hook - blocks ALL close events during focus changes
 */
export function useUltraBackdropClose(onClose: () => void) {
  const isBlocked = useRef(false)
  const blockTimeoutRef = useRef<NodeJS.Timeout>()
  const { isTabSwitching } = useBrowserTabProtection()
  
  const blockAllCloseEvents = useCallback(() => {
    isBlocked.current = true
    
    // Clear any existing timeout
    if (blockTimeoutRef.current) {
      clearTimeout(blockTimeoutRef.current)
    }
    
    // Block for extended period
    blockTimeoutRef.current = setTimeout(() => {
      isBlocked.current = false
    }, 2000) // 2 second block
  }, [])
  
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (isBlocked.current || isTabSwitching()) {
      return
    }
    
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose, isTabSwitching])
  
  const handleFocusChange = useCallback(() => {
    blockAllCloseEvents()
  }, [blockAllCloseEvents])
  
  // Ultra-protected onClose wrapper
  const protectedOnClose = useCallback(() => {
    if (isBlocked.current || isTabSwitching()) {
      return
    }
    onClose()
  }, [onClose, isTabSwitching])
  
  return {
    handleBackdropClick,
    handleFocusChange,
    protectedOnClose,
    blockAllCloseEvents
  }
}