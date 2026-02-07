import { PaperPlaneTiltIcon, PencilIcon } from '@phosphor-icons/react'

interface ReplyDraftCardProps {
  to: string
  subject: string
  draft: string
}

export default function ReplyDraftCard({ to, subject, draft }: ReplyDraftCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Reply Draft</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{subject}</p>
          <p className="text-xs text-muted-foreground mt-0.5">To: {to}</p>
        </div>
        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <PencilIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-sm text-accent-foreground">{draft}</p>

      <div className="flex gap-2 pt-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors">
          <PaperPlaneTiltIcon className="w-4 h-4" />
          Send
        </button>
        <button className="px-4 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors">
          Edit
        </button>
      </div>
    </div>
  )
}
