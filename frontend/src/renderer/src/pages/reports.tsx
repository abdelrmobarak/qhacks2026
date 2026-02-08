import {
  Notebook,
  ArrowClockwise,
  WarningCircle,
  Lightning,
  EnvelopeSimple,
  CheckCircle,
  Clock,
  Star,
  CircleNotch,
} from '@phosphor-icons/react'

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
import { useDataCache } from '../hooks/use-data-cache'

const CATEGORY_LABELS: Record<string, string> = {
  needs_reply: 'Needs Reply',
  urgent: 'Urgent',
  meeting_related: 'Meetings',
  newsletter: 'Newsletter',
  subscription: 'Subscription',
  informational: 'Info',
}

const PRIORITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
}

const Reports = () => {
  const { report, isReportLoading, reportError, refreshReport } = useDataCache()

  if (isReportLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (reportError) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WarningCircle />
          </EmptyMedia>
          <EmptyTitle>Failed to generate report</EmptyTitle>
          <EmptyDescription>{reportError}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={refreshReport}>
          Retry
        </Button>
      </Empty>
    )
  }

  if (!report) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Notebook />
          </EmptyMedia>
          <EmptyTitle>Daily Report</EmptyTitle>
          <EmptyDescription>
            Generate an AI-powered summary of your day: email stats, highlights, action items, and upcoming deadlines.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={refreshReport} className="gap-1.5">
          <Lightning className="size-3" />
          Generate Today's Report
        </Button>
      </Empty>
    )
  }

  const emailStats = report.email_stats
  const statEntries = Object.entries(emailStats).filter(
    ([key, value]) => key !== 'total' && value > 0
  )

  return (
    <div className="flex flex-col gap-4 max-w-screen-md mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {emailStats.total} emails analyzed
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refreshReport} disabled={isReportLoading}>
          {isReportLoading ? <CircleNotch className="animate-spin" /> : <ArrowClockwise />}
        </Button>
      </div>

      <Separator />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <span className="text-xs font-medium">Summary</span>
          <span className="text-xs text-muted-foreground">{report.summary}</span>
        </CardContent>
      </Card>

      {statEntries.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <EnvelopeSimple className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Email Breakdown</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {statEntries.map(([category, count]) => (
                <Badge key={category} variant="outline">
                  {CATEGORY_LABELS[category] ?? category} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.highlights.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Star className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Highlights</span>
            </div>
            <div className="flex flex-col gap-2">
              {report.highlights.map((highlight, index) => (
                <div key={index} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{highlight.subject}</span>
                    <Badge variant={PRIORITY_VARIANT[highlight.priority] ?? 'secondary'}>
                      {highlight.priority}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{highlight.from}</span>
                  <span className="text-xs text-muted-foreground">{highlight.gist}</span>
                  {index < report.highlights.length - 1 && <Separator className="mt-1" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.action_items.items.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Action Items</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {report.action_items.completed} done, {report.action_items.pending} pending
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {report.action_items.items.map((actionItem, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className={`mt-1 size-1.5 shrink-0 rounded-full ${actionItem.status === 'completed' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={`text-xs ${actionItem.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {actionItem.text}
                    </span>
                    {actionItem.source && (
                      <span className="text-xs text-muted-foreground truncate">{actionItem.source}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.upcoming.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Upcoming</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {report.upcoming.map((upcomingItem, index) => (
                <div key={index} className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs">{upcomingItem.text}</span>
                    <span className="text-xs text-muted-foreground truncate">{upcomingItem.source}</span>
                  </div>
                  {upcomingItem.date && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{upcomingItem.date}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.wrap_up && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs font-medium">Wrap Up</span>
            <span className="text-xs text-muted-foreground">{report.wrap_up}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Reports
