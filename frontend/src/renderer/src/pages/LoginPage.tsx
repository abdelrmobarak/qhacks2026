import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { isAuthenticated, snapshotStatus, isLoading } = useAuth()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return

    if (snapshotStatus === 'done') {
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/processing', { replace: true })
    }
  }, [isAuthenticated, snapshotStatus, isLoading, navigate])

  async function handleConnect(): Promise<void> {
    setIsConnecting(true)
    setError(null)
    try {
      const result = await window.api.startGoogleAuth()
      if (result.success) {
        navigate('/processing')
      } else if (result.error && result.error !== 'Window closed') {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection')
    } finally {
      setIsConnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-fg border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg grain flex flex-col p-6 sm:p-10">
      <header className="flex items-center justify-between mb-auto">
        <span className="font-mono text-xs text-fg-subtle uppercase tracking-widest">Wrapped</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center py-20">
        <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight mb-8">
          Your last
          <br />
          90 days,
          <br />
          <span className="text-fg-muted">visualized</span>
        </h1>

        <p className="text-fg-muted text-lg max-w-md mb-12">
          Connect your Google Calendar and Gmail to see how you really spend your time.
        </p>

        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="group flex items-center justify-center gap-3 bg-fg text-bg px-8 py-4 hover:bg-fg/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isConnecting ? (
            <>
              <span className="h-4 w-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Connecting
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Connect Google
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </>
          )}
        </button>

        {error && <p className="text-red-400 text-sm mt-6">{error}</p>}
      </main>

      <footer className="mt-auto pt-12 w-full max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-fg-muted text-center sm:text-left">
          <div className="flex items-start gap-3">
            <span className="text-fg-subtle font-mono">01</span>
            <p>Read-only access. We never send emails or modify your calendar.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-fg-subtle font-mono">02</span>
            <p>One-time snapshot. No ongoing sync or background access.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-fg-subtle font-mono">03</span>
            <p>Auto-deletes after 60 days. Your data doesn&apos;t stick around.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
