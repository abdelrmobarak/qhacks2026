import { useState, useCallback } from 'react'
import {
  EnvelopeSimple,
  ArrowBendUpLeft,
  CircleNotch,
  FunnelSimple,
  ArrowClockwise,
} from '@phosphor-icons/react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { api, type CategorizedEmail, type ReplySuggestion } from '../lib/api'
import { useDataCache } from '../hooks/use-data-cache'

const CATEGORY_LABELS: Record<string, string> = {
  needs_reply: 'Needs Reply',
  informational: 'Info',
  newsletter: 'Newsletter',
  automated: 'Automated',
  promotional: 'Promo',
}

const CATEGORY_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  needs_reply: 'destructive',
  informational: 'secondary',
  newsletter: 'outline',
  automated: 'outline',
  promotional: 'outline',
}

const ALL_FILTER = 'all'

const Inbox = () => {
  const { emails, isEmailsLoading, emailsError, refreshEmails } = useDataCache()
  const [selectedEmail, setSelectedEmail] = useState<CategorizedEmail | null>(null)
  const [filter, setFilter] = useState(ALL_FILTER)
  const [replySuggestion, setReplySuggestion] = useState<ReplySuggestion | null>(null)
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const filteredEmails =
    filter === ALL_FILTER ? emails : emails.filter((email) => email.category === filter)

  const categories = [ALL_FILTER, ...new Set(emails.map((email) => email.category))]

  const handleGenerateReply = useCallback(async (email: CategorizedEmail) => {
    setIsGeneratingReply(true)
    setReplySuggestion(null)
    try {
      const result = await api.generateReply(email.message_id)
      if (result.generated) {
        setReplySuggestion(result.suggestion)
        setReplyBody(result.suggestion.body)
      }
    } catch {
      // silent fail
    } finally {
      setIsGeneratingReply(false)
    }
  }, [])

  const handleSendReply = useCallback(async () => {
    if (!selectedEmail || !replyBody.trim()) return
    setIsSending(true)
    try {
      await api.sendReply({
        message_id: selectedEmail.message_id,
        thread_id: selectedEmail.thread_id,
        to: selectedEmail.from_email,
        subject: `Re: ${selectedEmail.subject}`,
        body: replyBody,
      })
      setReplySuggestion(null)
      setReplyBody('')
      setSelectedEmail(null)
    } catch {
      // silent fail
    } finally {
      setIsSending(false)
    }
  }, [selectedEmail, replyBody])

  const handleSelectEmail = useCallback((email: CategorizedEmail) => {
    setSelectedEmail(email)
    setReplySuggestion(null)
    setReplyBody('')
  }, [])

  return (
    <div className="flex gap-4 h-full max-w-screen-xl mx-auto">
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelSimple className="size-3.5 text-muted-foreground" />
          {categories.map((category) => (
            <Button
              key={category}
              variant={filter === category ? 'default' : 'outline'}
              size="xs"
              onClick={() => setFilter(category)}
            >
              {category === ALL_FILTER ? 'All' : CATEGORY_LABELS[category] ?? category}
            </Button>
          ))}
          <Button variant="ghost" size="icon-xs" onClick={refreshEmails} className="ml-auto">
            <ArrowClockwise />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isEmailsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 border border-border">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : emailsError ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <EnvelopeSimple />
                </EmptyMedia>
                <EmptyTitle>Failed to load emails</EmptyTitle>
                <EmptyDescription>{emailsError}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={refreshEmails}>
                Retry
              </Button>
            </Empty>
          ) : filteredEmails.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <EnvelopeSimple />
                </EmptyMedia>
                <EmptyTitle>No emails found</EmptyTitle>
                <EmptyDescription>
                  {filter === ALL_FILTER
                    ? 'Your inbox is empty. Check back later.'
                    : 'No emails match this filter.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-1">
                {filteredEmails.map((email) => (
                  <div
                    key={email.message_id}
                  >
                    <div
                      className={`flex flex-col gap-1.5 p-3 border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedEmail?.message_id === email.message_id
                          ? 'border-primary bg-muted/30'
                          : 'border-border'
                      }`}
                      onClick={() => handleSelectEmail(email)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate flex-1">
                          {email.from_name || email.from_email}
                        </span>
                        <Badge variant={CATEGORY_VARIANTS[email.category] ?? 'outline'}>
                          {CATEGORY_LABELS[email.category] ?? email.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {email.date ? new Date(email.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <span className="text-xs font-medium">{email.subject}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {email.snippet}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {selectedEmail && (
        <div
          className="w-80 shrink-0 flex flex-col gap-3 border-l border-border pl-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{selectedEmail.subject}</CardTitle>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span>From: {selectedEmail.from_name || selectedEmail.from_email}</span>
                <span>{selectedEmail.from_email}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs whitespace-pre-wrap">{selectedEmail.body_preview || selectedEmail.snippet}</p>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleGenerateReply(selectedEmail)}
              disabled={isGeneratingReply}
            >
              {isGeneratingReply ? (
                <CircleNotch className="animate-spin" />
              ) : (
                <ArrowBendUpLeft />
              )}
              {isGeneratingReply ? 'Generating...' : 'AI Reply'}
            </Button>

            {replySuggestion && (
              <div
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{replySuggestion.tone}</Badge>
                </div>
                <Textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  className="min-h-24"
                />
                <Button
                  size="sm"
                  onClick={handleSendReply}
                  disabled={isSending || !replyBody.trim()}
                >
                  {isSending ? <CircleNotch className="animate-spin" /> : 'Send Reply'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Inbox
