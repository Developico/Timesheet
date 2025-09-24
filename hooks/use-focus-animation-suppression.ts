import { useEffect } from 'react'

/**
 * Global hook to manage CSS class for suppressing animations during window focus changes
 * This prevents visual glitches when switching between windows
 */
export function useFocusAnimationSuppression() {
  useEffect(() => {
    const handleFocusChange = () => {
      // Add class to suppress animations
      document.body.classList.add('window-focus-change')
      
      // Remove class after animations would have completed
      setTimeout(() => {
        document.body.classList.remove('window-focus-change')
      }, 300)
    }

    // Listen for window focus events
    window.addEventListener('focus', handleFocusChange)
    window.addEventListener('blur', handleFocusChange)
    window.addEventListener('visibilitychange', handleFocusChange)
    
    return () => {
      window.removeEventListener('focus', handleFocusChange)
      window.removeEventListener('blur', handleFocusChange)
      window.removeEventListener('visibilitychange', handleFocusChange)
      document.body.classList.remove('window-focus-change')
    }
  }, [])
}