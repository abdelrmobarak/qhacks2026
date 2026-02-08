import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Tray,
  CreditCard,
  CheckSquare,
  ArrowRight,
  Robot,
} from '@phosphor-icons/react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { api, type TLDRDigest } from '../lib/api'

interface QuickAction {
  label: string
  description: string
  icon: React.ReactNode
  path: string
}

const quickActions: QuickAction[] = [
  { label: 'Inbox', description: 'View and manage emails', icon: <Tray weight="duotone" className="size-5" />, path: '/inbox' },
  { label: 'Subscriptions', description: 'Track your bills', icon: <CreditCard weight="duotone" className="size-5" />, path: '/subscriptions' },
  { label: 'To-Do', description: 'Auto-generated tasks', icon: <CheckSquare weight="duotone" className="size-5" />, path: '/todos' },
]

const Dashboard = () => {
  const navigate = useNavigate()
  const [digest, setDigest] = useState<TLDRDigest | null>(null)
  const [isLoadingDigest, setIsLoadingDigest] = useState(true)
  const [digestError, setDigestError] = useState<string | null>(null)

  const loadDigest = useCallback(async () => {
    try {
      const data = await api.getTLDR()
      setDigest(data)
    } catch (error) {
      setDigestError(error instanceof Error ? error.message : 'Failed to load digest')
    } finally {
      setIsLoadingDigest(false)
    }
  }, [])

  useEffect(() => {
    loadDigest()
  }, [loadDigest])

  return (
    <div className="flex flex-col gap-6 max-w-screen-lg mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <div
            key={action.path}
          >
            <Card
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(action.path)}
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  {action.icon}
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Robot weight="duotone" className="size-4" />
              Email Digest
            </CardTitle>
            <CardDescription>AI-generated summary of your recent emails</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDigest ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : digestError ? (
              <p className="text-xs text-muted-foreground">{digestError}</p>
            ) : digest ? (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">{digest.summary}</p>
                {digest.highlights.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {digest.highlights.slice(0, 5).map((highlight, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-1 border-l-2 border-border pl-3 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{highlight.subject}</span>
                          {highlight.action_needed && (
                            <Badge variant="destructive" className="text-xs">
                              Action needed
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          From {highlight.from}
                        </span>
                        <span className="text-xs">{highlight.gist}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No recent emails to summarize.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
