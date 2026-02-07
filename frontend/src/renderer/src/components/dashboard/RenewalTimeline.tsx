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
            className="p-4 rounded-2xl bg-white/60 border border-white/60 hover-lift min-w-[180px]"
          >
            <div className="flex items-center gap-2 mb-3">
              {renewal.logo ? (
                <img src={renewal.logo} alt={renewal.name} className="w-6 h-6 rounded" />
              ) : (
                <div className="w-6 h-6 rounded bg-gradient-to-br from-[#FF6B6B] to-[#2BB3C0]" />
              )}
              <span className="font-semibold text-[#0B1B2B] text-sm">{renewal.name}</span>
            </div>

            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#0B1B2B] num">${renewal.amount}</p>
              <p className="text-xs text-slate-600">
                {renewal.daysUntil === 0 ? (
                  <span className="text-[#FF6B6B] font-medium">Due today</span>
                ) : (
                  `in ${renewal.daysUntil} day${renewal.daysUntil > 1 ? 's' : ''}`
                )}
              </p>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2F8F6B] to-[#2BB3C0] rounded-full transition-all"
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
