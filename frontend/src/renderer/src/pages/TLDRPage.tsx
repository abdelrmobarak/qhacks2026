import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type TLDRDigest } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import AgentBar from '../components/AgentBar'

export default function TLDRPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [digest, setDigest] = useState<TLDRDigest | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const data = await api.getTLDR()
        setDigest(data)
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-bg grain pb-24">
      <Header email={user?.email} onLogout={handleLogout} />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">TLDR Digest</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

        {isLoading ? (
          <p className="text-fg-muted">Generating your digest...</p>
        ) : !digest ? (
          <p className="text-fg-muted">Failed to load digest.</p>
        ) : (
          <>
            <div className="bg-surface border border-border p-6 mb-8">
              <p className="text-lg text-fg">{digest.summary}</p>
            </div>

            <h2 className="text-xl font-bold mb-4">Highlights</h2>
            <div className="space-y-3">
              {digest.highlights.map((item, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border p-4 flex items-start gap-3"
                >
                  <div
                    className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                      item.action_needed ? 'bg-yellow-400' : 'bg-fg-subtle'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-fg">{item.subject}</p>
                      {item.action_needed && (
                        <span className="text-xs font-mono px-1.5 py-0.5 border border-yellow-400/30 text-yellow-400">
                          action needed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5">{item.from}</p>
                    <p className="text-sm text-fg-subtle mt-1">{item.gist}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <AgentBar />
    </div>
  )
}
