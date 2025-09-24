'use client'

import { useEffect } from 'react'

/**
 * Hook that prevents CSS animations during window focus changes
 */
export function usePreventFocusAnimations() {
  useEffect(() => {
    let animationTimeoutRef: NodeJS.Timeout
    
    const preventAnimations = () => {
      // Add class to prevent animations
      document.body.classList.add('window-focus-change')
      
      // Clear any existing timeout
      if (animationTimeoutRef) {
        clearTimeout(animationTimeoutRef)
      }
      
      // Remove class after animation period
      animationTimeoutRef = setTimeout(() => {
        document.body.classList.remove('window-focus-change')
      }, 1000) // Keep animations disabled for 1 second
    }
    
    // Listen for focus events that might trigger animations
    const events = ['focus', 'blur', 'visibilitychange', 'pageshow', 'pagehide']
    
    events.forEach(event => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, preventAnimations)
      } else {
        window.addEventListener(event, preventAnimations)
      }
    })
    
    return () => {
      events.forEach(event => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, preventAnimations)
        } else {
          window.removeEventListener(event, preventAnimations)
        }
      })
      
      if (animationTimeoutRef) {
        clearTimeout(animationTimeoutRef)
      }
      
      // Clean up class on unmount
      document.body.classList.remove('window-focus-change')
    }
  }, [])
}