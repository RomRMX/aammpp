import { Component, StrictMode } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f1117', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>Something went wrong</span>
          <pre style={{ fontSize: 12, color: '#ef4444', maxWidth: 600, whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '6px 16px', background: 'none', border: '1px solid #4a8fd4',
              color: '#4a8fd4', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
