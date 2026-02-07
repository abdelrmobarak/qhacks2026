import { BellIcon, XIcon, BriefcaseIcon, EyeSlashIcon } from '@phosphor-icons/react'

interface SubscriptionCardProps {
  subscription: {
    id: string
    name: string
    logo?: string
    lastCharge: number
    renewalDate: string
    daysUntilRenewal: number
    category: string
    confidence: 'high' | 'medium' | 'low'
  }
  onRemind?: () => void
  onCancel?: () => void
  onMarkBusiness?: () => void
  onIgnore?: () => void
}

const categoryColors: Record<string, string> = {
  Streaming: '#2BB3C0',
  Tools: '#2F8F6B',
  School: '#FF6B6B',
  Gaming: '#9333EA',
  Other: '#94a3b8'
}

export default function SubscriptionCard({
  subscription,
  onRemind,
  onCancel,
  onMarkBusiness,
  onIgnore
}: SubscriptionCardProps) {
  const categoryColor = categoryColors[subscription.category] || categoryColors.Other

  return (
    <div className="p-5 rounded-3xl bg-card border border-border hover-lift card-shadow">
      <div className="flex items-start justify-between mb-4">
        {/* Logo & Name */}
        <div className="flex items-center gap-3">
          {subscription.logo ? (
            <img
              src={subscription.logo}
              alt={subscription.name}
              className="w-12 h-12 rounded-2xl"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {subscription.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-foreground tracking-tight">{subscription.name}</h3>
            <span
              className="inline-block px-2 py-0.5 rounded-lg text-xs font-medium mt-1"
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor
              }}
            >
              {subscription.category}
            </span>
          </div>
        </div>

        {/* Confidence Badge */}
        {subscription.confidence === 'low' && (
          <span className="px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-600 text-xs font-medium">
            Uncertain
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Last Charge</p>
          <p className="text-lg font-semibold text-foreground num">${subscription.lastCharge}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Renewal</p>
          <p className="text-sm font-semibold text-foreground">{subscription.renewalDate}</p>
          <p className="text-xs text-muted-foreground">
            {subscription.daysUntilRenewal === 0 ? (
              <span className="text-destructive font-medium">Today</span>
            ) : subscription.daysUntilRenewal < 7 ? (
              <span className="text-destructive">in {subscription.daysUntilRenewal} days</span>
            ) : (
              `in ${subscription.daysUntilRenewal} days`
            )}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-1.5 bg-card rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-chart-2 to-primary rounded-full transition-all"
          style={{
            width: `${Math.max(10, 100 - (subscription.daysUntilRenewal / 30) * 100)}%`
          }}
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onRemind}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
        >
          <BellIcon className="w-4 h-4" />
          Remind
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <XIcon className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={onMarkBusiness}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <BriefcaseIcon className="w-4 h-4" />
          Business
        </button>
        <button
          onClick={onIgnore}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
        >
          <EyeSlashIcon className="w-4 h-4" />
          Ignore
        </button>
      </div>
    </div>
  )
}
