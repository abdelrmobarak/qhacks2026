import { useState, useEffect, useCallback } from 'react'
import { CreditCard, ArrowClockwise, WarningCircle } from '@phosphor-icons/react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { api, type Subscription } from '../lib/api'

const Subscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getSubscriptions()
      setSubscriptions(data.subscriptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load subscriptions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WarningCircle />
          </EmptyMedia>
          <EmptyTitle>Failed to load subscriptions</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={loadSubscriptions}>
          Retry
        </Button>
      </Empty>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CreditCard />
          </EmptyMedia>
          <EmptyTitle>No subscriptions detected</EmptyTitle>
          <EmptyDescription>
            SaturdAI scans your email for billing and subscription receipts. None found in the last 90 days.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={loadSubscriptions} className="gap-1.5">
          <ArrowClockwise className="size-3" />
          Rescan
        </Button>
      </Empty>
    )
  }

  const totalMonthly = subscriptions.reduce((accumulator, subscription) => {
    if (!subscription.amount) return accumulator
    const amount = parseFloat(subscription.amount)
    if (isNaN(amount)) return accumulator
    if (subscription.frequency === 'yearly') return accumulator + amount / 12
    return accumulator + amount
  }, 0)

  return (
    <div className="flex flex-col gap-4 max-w-screen-md mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {subscriptions.length} subscriptions found
          </span>
          {totalMonthly > 0 && (
            <span className="text-sm font-medium">
              ~${totalMonthly.toFixed(2)}/mo estimated
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={loadSubscriptions}>
          <ArrowClockwise />
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        {subscriptions.map((subscription, index) => (
          <div
            key={index}
          >
            <Card>
              <CardContent className="flex items-center gap-4">
                <div className="flex size-8 items-center justify-center bg-muted text-muted-foreground font-medium text-xs">
                  {subscription.service_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium truncate">{subscription.service_name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {subscription.source_subject ?? 'Detected from email'}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {subscription.amount && (
                    <span className="text-xs font-medium tabular-nums">
                      {subscription.currency ?? '$'}{subscription.amount}
                      {subscription.frequency && (
                        <span className="text-muted-foreground">
                          /{subscription.frequency === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      )}
                    </span>
                  )}
                  {subscription.renewal_date && (
                    <span className="text-xs text-muted-foreground">
                      Renews {subscription.renewal_date}
                    </span>
                  )}
                  {subscription.status && (
                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                      {subscription.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Subscriptions
