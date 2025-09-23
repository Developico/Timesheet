// Disable Fast Refresh globally
if (typeof window !== 'undefined' && window.__NEXT_DATA__) {
  // Disable hot reloading
  if (process.env.NODE_ENV === 'development') {
    // Override Next.js fast refresh
    if (window.__webpack_require__ && window.__webpack_require__.cache) {
      delete window.__webpack_require__.cache['./node_modules/next/dist/client/dev/hot-reloader.js']
    }
    
    // Disable WebSocket connection for HMR
    const originalWebSocket = window.WebSocket
    window.WebSocket = function(...args) {
      const url = args[0]
      if (typeof url === 'string' && url.includes('_next/webpack-hmr')) {
        // Block HMR WebSocket connections
        return {
          addEventListener: () => {},
          removeEventListener: () => {},
          send: () => {},
          close: () => {},
          readyState: 3 // CLOSED
        }
      }
      return new originalWebSocket(...args)
    }
  }
}