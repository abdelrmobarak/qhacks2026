import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Subscription } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import AgentBar from '../components/AgentBar'

export default function SubscriptionsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const data = await api.getSubscriptions()
        setSubscriptions(data.subscriptions)
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

  async function handleAddToCalendar(sub: Subscription): Promise<void> {
    if (!sub.renewal_date) return
    try {
      await api.createCalendarEvent({
        summary: `${sub.service_name} renewal`,
        start: `${sub.renewal_date}T09:00:00Z`,
        end: `${sub.renewal_date}T09:30:00Z`,
        description: `${sub.service_name} - ${sub.amount || ''} ${sub.currency || ''} (${sub.frequency || 'recurring'})`
      })
      alert(`Added ${sub.service_name} renewal to calendar`)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-bg grain pb-24">
      <Header email={user?.email} onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Subscriptions & Bills</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

        {isLoading ? (
          <p className="text-fg-muted">Scanning your emails for subscriptions...</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-fg-muted">No subscriptions detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                    Service
                  </th>
                  <th className="pb-3 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="pb-3 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="pb-3 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                    Next Renewal
                  </th>
                  <th className="pb-3 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                    Status
                  </th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 text-fg font-medium">{sub.service_name}</td>
                    <td className="py-3 text-fg-muted">
                      {sub.amount ? `${sub.currency || '$'}${sub.amount}` : '--'}
                    </td>
                    <td className="py-3 text-fg-muted">{sub.frequency || '--'}</td>
                    <td className="py-3 text-fg-muted">{sub.renewal_date || '--'}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 border ${
                          sub.status === 'active'
                            ? 'text-green-400 border-green-400/30'
                            : 'text-fg-subtle border-border'
                        }`}
                      >
                        {sub.status || 'unknown'}
                      </span>
                    </td>
                    <td className="py-3">
                      {sub.renewal_date && (
                        <button
                          onClick={() => handleAddToCalendar(sub)}
                          className="text-xs px-2 py-1 border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors font-mono cursor-pointer"
                        >
                          + Cal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <AgentBar />
    </div>
  )
}
