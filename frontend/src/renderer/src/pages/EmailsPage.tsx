import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type CategorizedEmail, type ReplySuggestion } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import AgentBar from '../components/AgentBar'

const CATEGORY_COLORS: Record<string, string> = {
  needs_reply: 'text-yellow-400 border-yellow-400/30',
  meeting_related: 'text-blue-400 border-blue-400/30',
  urgent: 'text-red-400 border-red-400/30',
  newsletter: 'text-green-400 border-green-400/30',
  subscription: 'text-purple-400 border-purple-400/30',
  informational: 'text-fg-subtle border-border'
}

export default function EmailsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [emails, setEmails] = useState<CategorizedEmail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replySuggestion, setReplySuggestion] = useState<ReplySuggestion | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const data = await api.getRecentEmails(20)
        setEmails(data.emails)
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  async function handleGenerateReply(messageId: string): Promise<void> {
    setReplyFor(messageId)
    setIsGenerating(true)
    setReplySuggestion(null)
    try {
      const result = await api.generateReply(messageId)
      setReplySuggestion(result.suggestion)
    } catch {
      // ignore
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-bg grain pb-24">
      <Header email={user?.email} onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Inbox</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

        {isLoading ? (
          <p className="text-fg-muted">Loading emails...</p>
        ) : emails.length === 0 ? (
          <p className="text-fg-muted">No recent emails found.</p>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.message_id}
                className="bg-surface border border-border p-4 hover:border-fg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 border ${CATEGORY_COLORS[email.category] || CATEGORY_COLORS.informational}`}
                      >
                        {email.category}
                      </span>
                      <span className="text-xs text-fg-subtle">
                        {new Date(email.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-fg truncate">
                      {email.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {email.from_name || email.from_email}
                    </p>
                    <p className="text-xs text-fg-subtle mt-1 line-clamp-2">{email.snippet}</p>
                  </div>

                  {email.category === 'needs_reply' && (
                    <button
                      onClick={() => handleGenerateReply(email.message_id)}
                      className="text-xs px-3 py-1.5 bg-fg text-bg font-mono hover:bg-fg-muted transition-colors shrink-0 cursor-pointer"
                    >
                      Reply
                    </button>
                  )}
                </div>

                {replyFor === email.message_id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {isGenerating ? (
                      <p className="text-xs text-fg-muted">Generating reply...</p>
                    ) : replySuggestion ? (
                      <div>
                        <p className="text-xs text-fg-subtle mb-1">
                          Suggested reply ({replySuggestion.tone}):
                        </p>
                        <p className="text-sm text-fg bg-bg p-3 border border-border whitespace-pre-wrap">
                          {replySuggestion.body}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={async () => {
                              await api.sendReply({
                                message_id: email.message_id,
                                thread_id: email.thread_id,
                                to: email.from_email,
                                subject: replySuggestion.subject,
                                body: replySuggestion.body
                              })
                              setReplyFor(null)
                              setReplySuggestion(null)
                            }}
                            className="text-xs px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 font-mono cursor-pointer"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => {
                              setReplyFor(null)
                              setReplySuggestion(null)
                            }}
                            className="text-xs px-3 py-1.5 border border-border text-fg-muted font-mono cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <AgentBar />
    </div>
  )
}
