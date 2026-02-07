interface RenewalEvent {
  id: string
  name: string
  date: Date
  amount: number
}

interface RenewalCalendarStripProps {
  renewals: RenewalEvent[]
  daysToShow?: number
}

export default function RenewalCalendarStrip({
  renewals,
  daysToShow = 60
}: RenewalCalendarStripProps) {
  const today = new Date()
  const days: Date[] = []

  // Generate days array
  for (let i = 0; i < daysToShow; i++) {
    const day = new Date(today)
    day.setDate(today.getDate() + i)
    days.push(day)
  }

  // Group renewals by date
  const renewalsByDate = renewals.reduce(
    (acc, renewal) => {
      const dateKey = renewal.date.toISOString().split('T')[0]
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(renewal)
      return acc
    },
    {} as Record<string, RenewalEvent[]>
  )

  return (
    <div className="p-6 rounded-3xl bg-white/60 border border-white/60">
      <h3 className="text-sm font-semibold text-[#0B1B2B] mb-4">Next 60 Days</h3>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {days.map((day, index) => {
            const dateKey = day.toISOString().split('T')[0]
            const dayRenewals = renewalsByDate[dateKey] || []
            const isToday = index === 0

            return (
              <div
                key={index}
                className={`flex-shrink-0 w-12 rounded-xl overflow-hidden ${
                  isToday ? 'ring-2 ring-[#2BB3C0]' : ''
                }`}
              >
                {/* Date Header */}
                <div
                  className={`px-2 py-1.5 text-center ${
                    isToday ? 'bg-[#2BB3C0] text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  <div className="text-[10px] font-medium">
                    {day.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-sm font-semibold">{day.getDate()}</div>
                </div>

                {/* Renewal Indicators */}
                <div className="bg-white/60 p-1 min-h-[40px] space-y-0.5">
                  {dayRenewals.slice(0, 3).map((renewal) => (
                    <div
                      key={renewal.id}
                      className="h-1.5 rounded-full bg-gradient-to-r from-[#FF6B6B] to-[#2BB3C0]"
                      title={`${renewal.name} - $${renewal.amount}`}
                    />
                  ))}
                  {dayRenewals.length > 3 && (
                    <div className="text-[8px] text-center text-slate-500">
                      +{dayRenewals.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
