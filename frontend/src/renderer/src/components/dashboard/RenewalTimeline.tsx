interface Renewal {
  id: string
  name: string
  amount: number
  daysUntil: number
  logo?: string
}

interface RenewalTimelineProps {
  renewals: Renewal[]
}

export default function RenewalTimeline({ renewals }: RenewalTimelineProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {renewals.map((renewal) => (
          <div
            key={renewal.id}
            className="p-4 rounded-2xl bg-card border border-border hover-lift min-w-[180px]"
          >
            <div className="flex items-center gap-2 mb-3">
              {renewal.logo ? (
                <img src={renewal.logo} alt={renewal.name} className="w-6 h-6 rounded" />
              ) : (
                <div className="w-6 h-6 rounded bg-gradient-to-br from-destructive to-primary" />
              )}
              <span className="font-semibold text-foreground text-sm">{renewal.name}</span>
            </div>

            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground num">${renewal.amount}</p>
              <p className="text-xs text-muted-foreground">
                {renewal.daysUntil === 0 ? (
                  <span className="text-destructive font-medium">Due today</span>
                ) : (
                  `in ${renewal.daysUntil} day${renewal.daysUntil > 1 ? 's' : ''}`
                )}
              </p>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-card rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-chart-2 to-primary rounded-full transition-all"
                style={{
                  width: `${Math.max(10, 100 - (renewal.daysUntil / 30) * 100)}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
