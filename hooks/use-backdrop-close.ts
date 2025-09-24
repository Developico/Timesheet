import { useCallback, useRef } from 'react'

/**
 * Hook to prevent backdrop clicks during window focus changes
 * This prevents panels from closing when switching between windows
 */
export function useBackdropClose(onClose: () => void) {
  const lastClickTimeRef = useRef<number>(0)
  const lastFocusChangeRef = useRef<number>(0)
  
  // Track window focus changes
  const handleFocusChange = useCallback(() => {
    lastFocusChangeRef.current = Date.now()
  }, [])
  
  // Enhanced backdrop click handler
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const now = Date.now()
    const timeSinceLastFocusChange = now - lastFocusChangeRef.current
    
    // Ignore backdrop clicks that happen within 500ms of a focus change
    // This prevents panels from closing when switching windows
    if (timeSinceLastFocusChange < 500) {
      console.log('Ignoring backdrop click - recent focus change detected')
      return
    }
    
    // Ensure this is actually a backdrop click (not a child element)
    if (e.target === e.currentTarget) {
      lastClickTimeRef.current = now
      onClose()
    }
  }, [onClose])
  
  return {
    handleBackdropClick,
    handleFocusChange
  }
}