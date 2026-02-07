import { XIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react'

interface RightDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
}

export default function RightDrawer({ isOpen, onClose, title, children }: RightDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="w-96 glass border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground tracking-tight">{title || 'Details'}</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <XIcon className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  )
}

// Specialized drawer content components
export function EmailDrawerContent({
  email
}: {
  email: {
    subject: string
    from: string
    tldr: string
    suggestedReply?: string
  }
}) {
  return (
    <div className="space-y-6">
      {/* TLDR */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Summary</h4>
        <p className="text-sm text-accent-foreground">{email.tldr}</p>
      </div>

      {/* Suggested Reply */}
      {email.suggestedReply && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Suggested Reply</h4>
          <div className="space-y-3">
            {/* Tone chips */}
            <div className="flex gap-2">
              {['Friendly', 'Short', 'Professional'].map((tone) => (
                <button
                  key={tone}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-card hover:bg-accent transition-colors text-accent-foreground"
                >
                  {tone}
                </button>
              ))}
            </div>

            {/* Reply text */}
            <textarea
              className="w-full p-4 rounded-2xl bg-card border border-border text-sm text-accent-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={6}
              defaultValue={email.suggestedReply}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors">
                <PaperPlaneTiltIcon className="w-4 h-4" />
                Send Reply
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-accent-foreground font-medium transition-colors">
                Voice Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Quick Actions</h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-left text-sm font-medium text-accent-foreground transition-colors">
            Add to To-Do
          </button>
          <button className="w-full px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-left text-sm font-medium text-accent-foreground transition-colors">
            Snooze Until Tomorrow
          </button>
          <button className="w-full px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-left text-sm font-medium text-accent-foreground transition-colors">
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
