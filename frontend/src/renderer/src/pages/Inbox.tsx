import { useState, useEffect, useCallback } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { api, type CategorizedEmail, type ReplySuggestion } from '../lib/api'
import { toast } from 'sonner'

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

interface GeneratedReply {
  messageId: string
  email: CategorizedEmail
  suggestion: ReplySuggestion
  editedBody: string
  status: 'generated' | 'edited' | 'sending' | 'sent' | 'failed'
  error?: string
}

interface BulkGenerationProgress {
  current: number
  total: number
}

interface ReplyReviewPanelProps {
  reply: GeneratedReply
  onEdit: (newBody: string) => void
  onSend: () => void
  onSkip: () => void
}

const ReplyReviewPanel = ({ reply, onEdit, onSend, onSkip }: ReplyReviewPanelProps) => {
  const isSending = reply.status === 'sending'
  const hasFailed = reply.status === 'failed'

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-muted/30 border-muted">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <EnvelopeSimple className="size-4 text-primary" />
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{reply.email.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    From: {reply.email.from_name || reply.email.from_email}
                  </span>
                </div>
                <Separator className="my-1" />
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                  {reply.email.body_preview || reply.email.snippet}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowBendUpLeft className="size-3 text-primary" />
            </div>
            <span className="text-sm font-semibold">Your Reply</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {reply.suggestion.tone}
          </Badge>
        </div>

        {hasFailed ? (
          <div>
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 text-destructive">
                  <CircleNotch className="size-4 shrink-0 mt-0.5" />
                  <span className="text-sm">{reply.error || 'Failed to generate reply'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <Textarea
                  value={reply.editedBody}
                  onChange={(event) => onEdit(event.target.value)}
                  className="min-h-48 border-0 focus-visible:ring-0 resize-none text-sm"
                  disabled={isSending}
                  placeholder="Edit your reply..."
                />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onSend}
                disabled={isSending || !reply.editedBody.trim()}
                className="flex-1 gap-2"
              >
                {isSending ? (
                  <>
                    <Spinner className="size-4" />
                    Sending...
                  </>
                ) : (
                  <>
                    <ArrowBendUpLeft className="size-4" />
                    Send Reply
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onSkip}
                disabled={isSending}
                className="gap-2"
              >
                Skip
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const Inbox = () => {
  const [emails, setEmails] = useState<CategorizedEmail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState(ALL_FILTER)
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set())
  const [generatedReplies, setGeneratedReplies] = useState<Map<string, GeneratedReply>>(new Map())
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)
  const [bulkGenerationProgress, setBulkGenerationProgress] = useState<BulkGenerationProgress | null>(null)
  const [activeReviewEmailId, setActiveReviewEmailId] = useState<string | null>(null)
  const [approvalMode, setApprovalMode] = useState(false)
  const loadEmails = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getRecentEmails(30)
      setEmails(data.emails)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load emails')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmails()
  }, [loadEmails])


  const filteredEmails =
    filter === ALL_FILTER ? emails : emails.filter((email) => email.category === filter)

  const categories = [ALL_FILTER, ...new Set(emails.map((email) => email.category))]

  const getNextReplyId = useCallback((currentId: string): string | null => {
    const ids = Array.from(generatedReplies.keys()).filter(
      (id) => generatedReplies.get(id)?.status !== 'sent'
    )
    const currentIndex = ids.indexOf(currentId)
    return currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null
  }, [generatedReplies])

  const handleSendReply = useCallback(async (messageId: string) => {
    const reply = generatedReplies.get(messageId)
    if (!reply || !reply.editedBody.trim()) return

    setGeneratedReplies((previous) => {
      const updated = new Map(previous)
      const existing = updated.get(messageId)
      if (existing) {
        updated.set(messageId, { ...existing, status: 'sending' })
      }
      return updated
    })

    try {
      await api.sendReply({
        message_id: reply.email.message_id,
        thread_id: reply.email.thread_id,
        to: reply.email.from_email,
        subject: reply.suggestion.subject,
        body: reply.editedBody,
      })

      setGeneratedReplies((previous) => {
        const updated = new Map(previous)
        const existing = updated.get(messageId)
        if (existing) {
          updated.set(messageId, { ...existing, status: 'sent' })
        }
        return updated
      })

      toast.success(`Reply sent to ${reply.email.from_email}`)

      const nextId = getNextReplyId(messageId)
      if (nextId) {
        setActiveReviewEmailId(nextId)
      } else {
        setApprovalMode(false)
        setActiveReviewEmailId(null)
      }
    } catch (sendError) {
      setGeneratedReplies((previous) => {
        const updated = new Map(previous)
        const existing = updated.get(messageId)
        if (existing) {
          updated.set(messageId, {
            ...existing,
            status: 'failed',
            error: sendError instanceof Error ? sendError.message : 'Failed to send reply',
          })
        }
        return updated
      })

      toast.error('Failed to send reply')
    }
  }, [generatedReplies, getNextReplyId])

  const handleSkipReply = useCallback((messageId: string) => {
    const nextId = getNextReplyId(messageId)
    if (nextId) {
      setActiveReviewEmailId(nextId)
    } else {
      setApprovalMode(false)
      setActiveReviewEmailId(null)
    }
  }, [getNextReplyId])

  const handleEditReply = useCallback((messageId: string, newBody: string) => {
    setGeneratedReplies((previous) => {
      const updated = new Map(previous)
      const existing = updated.get(messageId)
      if (existing) {
        updated.set(messageId, {
          ...existing,
          editedBody: newBody,
          status: 'edited',
        })
      }
      return updated
    })
  }, [])

  return (
    <div className="flex gap-4 h-full max-w-screen-xl mx-auto">
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FunnelSimple className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filter</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((category) => {
              const isNeedsReply = category === 'needs_reply'
              const needsReplyCount = isNeedsReply
                ? emails.filter((email) => email.category === 'needs_reply').length
                : 0

              return (
                <Button
                  key={category}
                    variant={filter === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(category)}
                    className={isNeedsReply && needsReplyCount > 0 ? 'gap-2' : ''}
                  >
                    {category === ALL_FILTER ? 'All' : CATEGORY_LABELS[category] ?? category}
                    {isNeedsReply && needsReplyCount > 0 && (
                      <Badge variant="destructive" className="ml-0.5 px-1.5">
                        {needsReplyCount}
                      </Badge>
                    )}
                  </Button>
              )
            })}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={loadEmails} className="ml-auto">
            <ArrowClockwise className="size-4" />
          </Button>
        </div>

        {selectedEmailIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 border border-primary bg-primary/5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {selectedEmailIds.size}
                </span>
              </div>
              <span className="text-xs font-medium">
                {selectedEmailIds.size === 1 ? 'email' : 'emails'} selected
              </span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => {
                const selectedEmails = emails.filter((email) => selectedEmailIds.has(email.message_id))
                if (selectedEmails.length === 0) return

                setIsGeneratingBulk(true)
                setBulkGenerationProgress({ current: 0, total: selectedEmails.length })

                const generateReplies = async () => {
                  const results = new Map<string, GeneratedReply>()

                  for (let i = 0; i < selectedEmails.length; i++) {
                    const email = selectedEmails[i]
                    setBulkGenerationProgress({ current: i + 1, total: selectedEmails.length })

                    try {
                      const result = await api.generateReply(email.message_id)
                      if (result.generated) {
                        results.set(email.message_id, {
                          messageId: email.message_id,
                          email,
                          suggestion: result.suggestion,
                          editedBody: result.suggestion.body,
                          status: 'generated',
                        })
                      }
                    } catch (generateError) {
                      results.set(email.message_id, {
                        messageId: email.message_id,
                        email,
                        suggestion: { subject: '', body: '', tone: '' },
                        editedBody: '',
                        status: 'failed',
                        error: generateError instanceof Error ? generateError.message : 'Failed to generate reply',
                      })
                    }
                  }

                  setGeneratedReplies(results)
                  setIsGeneratingBulk(false)
                  setBulkGenerationProgress(null)
                  setApprovalMode(true)

                  const firstGeneratedId = Array.from(results.keys()).find(
                    (id) => results.get(id)?.status === 'generated'
                  )
                  if (firstGeneratedId) {
                    setActiveReviewEmailId(firstGeneratedId)
                  }
                }

                generateReplies()
              }}
              disabled={isGeneratingBulk}
            >
              {isGeneratingBulk ? (
                <>
                  <Spinner className="size-4" />
                  <span>
                    Generating {bulkGenerationProgress?.current} of {bulkGenerationProgress?.total}
                  </span>
                </>
              ) : (
                <>
                  <ArrowBendUpLeft className="size-4" />
                  <span>Generate Replies</span>
                </>
              )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEmailIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 border border-border">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <EnvelopeSimple />
                </EmptyMedia>
                <EmptyTitle>Failed to load emails</EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={loadEmails}>
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
            <div className="flex flex-col gap-2">
                {filteredEmails.map((email) => {
                  const isSelected = selectedEmailIds.has(email.message_id)
                  return (
                    <div
                      key={email.message_id}
                      className={`group flex items-start gap-3 p-3 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        setSelectedEmailIds((previous) => {
                          const updated = new Set(previous)
                          if (isSelected) {
                            updated.delete(email.message_id)
                          } else {
                            updated.add(email.message_id)
                          }
                          return updated
                        })
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedEmailIds((previous) => {
                            const updated = new Set(previous)
                            if (checked) {
                              updated.add(email.message_id)
                            } else {
                              updated.delete(email.message_id)
                            }
                            return updated
                          })
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1"
                      />
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold truncate block">
                              {email.from_name || email.from_email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={CATEGORY_VARIANTS[email.category] ?? 'outline'} className="text-xs">
                              {CATEGORY_LABELS[email.category] ?? email.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {email.date ? new Date(email.date).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-medium line-clamp-1">{email.subject}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {email.snippet}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Sheet
        open={approvalMode && generatedReplies.size > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setApprovalMode(false)
            setActiveReviewEmailId(null)
          }
        }}
      >
        <SheetContent
          side="right"
          overlayClassName="top-10"
          className="data-[side=right]:top-10 flex flex-col gap-4 sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Review Replies</SheetTitle>
            <SheetDescription>
              {Array.from(generatedReplies.values()).filter((reply) => reply.status === 'sent').length} of {generatedReplies.size} sent
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 px-4">
              {Array.from(generatedReplies.entries()).map(([messageId, reply]) => {
                const isActive = activeReviewEmailId === messageId
                const isSent = reply.status === 'sent'
                const isFailed = reply.status === 'failed'

                return (
                  <Card
                    key={messageId}
                    className={`cursor-pointer transition-all ${
                      isActive
                        ? 'border-primary shadow-md'
                        : isSent
                        ? 'bg-muted/30 border-muted'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setActiveReviewEmailId(messageId)}
                  >
                    <CardContent className="p-3 flex items-start gap-2">
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <EnvelopeSimple className={`size-3.5 shrink-0 mt-0.5 ${isSent ? 'text-muted-foreground' : 'text-foreground'}`} />
                          <span className={`text-xs font-medium line-clamp-2 flex-1 ${isSent ? 'text-muted-foreground line-through' : ''}`}>
                            {reply.email.subject}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate pl-5">
                          {reply.email.from_email}
                        </span>
                      </div>
                      <Badge
                        variant={
                          isSent
                            ? 'default'
                            : isFailed
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="shrink-0"
                      >
                        {reply.status}
                      </Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>

          {activeReviewEmailId && generatedReplies.get(activeReviewEmailId) && (
            <div className="border-t border-border pt-4 px-4 pb-4">
              <ReplyReviewPanel
                reply={generatedReplies.get(activeReviewEmailId)!}
                onEdit={(newBody) => handleEditReply(activeReviewEmailId, newBody)}
                onSend={() => handleSendReply(activeReviewEmailId)}
                onSkip={() => handleSkipReply(activeReviewEmailId)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default Inbox
