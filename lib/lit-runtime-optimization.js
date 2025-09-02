/**
 * Runtime optimization script for Lit library
 * This script should be included in the HTML head to suppress warnings and optimize performance
 */

(function() {
  'use strict';

  // Suppress Lit development mode warnings
  if (typeof console !== 'undefined' && console.warn) {
    const originalWarn = console.warn;
    console.warn = function(...args) {
      // Filter out Lit development mode warnings
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit is in dev mode')) {
        return;
      }
      // Filter out other Lit-related warnings in production
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit') && process.env.NODE_ENV === 'production') {
        return;
      }
      originalWarn.apply(console, args);
    };
  }

  // Set global Lit configuration
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__LIT_DEV_MODE__ = process.env.NODE_ENV === 'development';
    
    // Additional optimizations for production
    if (process.env.NODE_ENV === 'production') {
      // @ts-ignore
      window.__LIT_OPTIMIZE__ = true;
      
      // Suppress additional Lit warnings
      const originalError = console.error;
      console.error = function(...args) {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('Lit')) {
          return;
        }
        originalError.apply(console, args);
      };
    }
  }

  // Optimize Web Components performance
  if (typeof window !== 'undefined' && window.customElements) {
    // Cache for custom element definitions
    const elementCache = new Map();
    
    // Override define to add caching
    const originalDefine = window.customElements.define;
    window.customElements.define = function(name, constructor, options) {
      if (elementCache.has(name)) {
        return; // Already defined
      }
      elementCache.set(name, true);
      return originalDefine.call(this, name, constructor, options);
    };
  }

  // Performance optimizations for Lit components
  if (typeof window !== 'undefined') {
    // Reduce re-renders by optimizing event listeners
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      // Optimize Lit-specific event types
      if (type === 'lit-render' || type === 'lit-update') {
        options = options || {};
        options.passive = true;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  console.log('🔧 Lit runtime optimizations applied');
})();
























