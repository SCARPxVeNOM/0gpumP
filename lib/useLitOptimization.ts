import { useEffect } from 'react'

/**
 * Custom hook to optimize Lit library usage and suppress development mode warnings
 */
export function useLitOptimization() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Suppress Lit development mode warnings in production
    if (process.env.NODE_ENV === 'production') {
      const originalWarn = console.warn
      console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit is in dev mode')) {
          return // Suppress Lit dev mode warnings
        }
        originalWarn.apply(console, args)
      }

      // Cleanup function to restore original console.warn
      return () => {
        console.warn = originalWarn
      }
    }

    // Set global Lit configuration
    // @ts-ignore
    window.__LIT_DEV_MODE__ = process.env.NODE_ENV === 'development'
    
    // Additional Lit optimizations
    if (process.env.NODE_ENV === 'production') {
      // @ts-ignore
      window.__LIT_OPTIMIZE__ = true
    }
  }, [])
}

/**
 * Function to suppress Lit warnings globally
 */
export function suppressLitWarnings() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') return

  const originalWarn = console.warn
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit is in dev mode')) {
      return // Suppress Lit dev mode warnings
    }
    originalWarn.apply(console, args)
  }

  return () => {
    console.warn = originalWarn
  }
}
























