import {
  PaperPlaneTiltIcon,
  ClockIcon,
  ArchiveIcon,
  CheckCircleIcon
} from '@phosphor-icons/react'

interface EmailCardProps {
  email: {
    id: string
    from: string
    subject: string
    summary: string
    intent: string
    confidence: 'high' | 'medium' | 'low'
    timestamp: string
  }
  onSelect?: () => void
  onReply?: () => void
  onSnooze?: () => void
  onArchive?: () => void
  onAddTodo?: () => void
}

const intentColors: Record<string, string> = {
  Question: '#2BB3C0',
  Scheduling: '#2F8F6B',
  'Action Required': '#FF6B6B',
  FYI: '#94a3b8'
}

export default function EmailCard({
  email,
  onSelect,
  onReply,
  onSnooze,
  onArchive,
  onAddTodo
}: EmailCardProps) {
  const intentColor = intentColors[email.intent] || '#94a3b8'

  return (
    <div
      onClick={onSelect}
      className="p-5 rounded-3xl bg-card border border-border hover-lift card-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">
              {email.from.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Sender & Badges */}
          <div>
            <p className="font-semibold text-foreground">{email.from}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${intentColor}15`,
                  color: intentColor
                }}
              >
                {email.intent}
              </span>
              {email.confidence === 'high' && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  Reply suggested
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground num">{email.timestamp}</span>
      </div>

      {/* Subject */}
      <h3 className="font-semibold text-foreground tracking-tight mb-2">{email.subject}</h3>

      {/* Summary */}
      <p className="text-sm text-accent-foreground leading-relaxed mb-4 line-clamp-2">{email.summary}</p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onReply?.()
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
        >
          <PaperPlaneTiltIcon className="w-4 h-4" />
          Reply
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSnooze?.()
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <ClockIcon className="w-4 h-4" />
          Snooze
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive?.()
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <ArchiveIcon className="w-4 h-4" />
          Archive
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddTodo?.()
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <CheckCircleIcon className="w-4 h-4" />
          To-Do
        </button>
      </div>
    </div>
  )
}
