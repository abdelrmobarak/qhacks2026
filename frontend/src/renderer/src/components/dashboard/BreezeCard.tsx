import { ClockIcon, WarningCircleIcon } from '@phosphor-icons/react'

interface BreezeCardProps {
  type: 'reply' | 'bill' | 'meeting'
  title: string
  description: string
  time?: string
  priority?: 'high' | 'medium' | 'low'
  onAction?: () => void
}

const typeConfig = {
  reply: {
    icon: '✉️',
    color: '#2BB3C0',
    actionLabel: 'Reply'
  },
  bill: {
    icon: '💳',
    color: '#FF6B6B',
    actionLabel: 'Review'
  },
  meeting: {
    icon: '📅',
    color: '#2F8F6B',
    actionLabel: 'View'
  }
}

export default function BreezeCard({
  type,
  title,
  description,
  time,
  priority = 'medium',
  onAction
}: BreezeCardProps) {
  const config = typeConfig[type]

  return (
    <div className="p-5 rounded-3xl bg-card border border-border hover-lift card-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        {priority === 'high' && (
          <WarningCircleIcon className="w-5 h-5 text-destructive" />
        )}
      </div>

      <div className="flex items-center justify-between">
        {time && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClockIcon className="w-4 h-4" />
            <span className="text-xs font-medium">{time}</span>
          </div>
        )}
        <button
          onClick={onAction}
          className="ml-auto px-4 py-2 rounded-xl font-medium text-sm transition-colors"
          style={{
            backgroundColor: `${config.color}15`,
            color: config.color
          }}
        >
          {config.actionLabel}
        </button>
      </div>
    </div>
  )
}
