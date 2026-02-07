import { useState } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

interface Email {
  id: string
  from: string
  subject: string
  summary: string
  intent: string
}

interface TriageStackProps {
  emails: Email[]
  onReply?: (emailId: string) => void
  onArchive?: (emailId: string) => void
  onSnooze?: (emailId: string) => void
}

export default function TriageStack({ emails, onReply, onArchive, onSnooze }: TriageStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentEmail = emails[currentIndex]

  const handleNext = () => {
    if (currentIndex < emails.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (!currentEmail) {
    return (
      <div className="p-8 rounded-3xl bg-card border border-border text-center">
        <p className="text-muted-foreground">All caught up! 🎉</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">Needs Reply</span>
        <span className="text-xs text-muted-foreground num">
          {currentIndex + 1} / {emails.length}
        </span>
      </div>

      {/* Email Card */}
      <div className="relative">
        <div className="p-6 rounded-3xl bg-background border border-border card-shadow">
          {/* Sender */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {currentEmail.from.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{currentEmail.from}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {currentEmail.intent}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  Reply suggested
                </span>
              </div>
            </div>
          </div>

          {/* Subject */}
          <h3 className="font-semibold text-foreground tracking-tight mb-2">
            {currentEmail.subject}
          </h3>

          {/* Summary */}
          <p className="text-sm text-accent-foreground leading-relaxed mb-4">{currentEmail.summary}</p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onReply?.(currentEmail.id)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
            >
              Reply
            </button>
            <button
              onClick={() => onSnooze?.(currentEmail.id)}
              className="px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
            >
              Snooze
            </button>
            <button
              onClick={() => onArchive?.(currentEmail.id)}
              className="px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
            >
              Archive
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-2">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CaretLeftIcon className="w-5 h-5 text-accent-foreground" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === emails.length - 1}
          className="p-2 rounded-lg bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CaretRightIcon className="w-5 h-5 text-accent-foreground" />
        </button>
      </div>
    </div>
  )
}
