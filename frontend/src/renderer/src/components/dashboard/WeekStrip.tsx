interface WeekStripProps {
  selectedDay?: number
  onDaySelect?: (day: number) => void
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekStrip({ selectedDay = 0, onDaySelect }: WeekStripProps) {
  const today = new Date().getDay()
  const adjustedToday = today === 0 ? 6 : today - 1 // Convert Sunday=0 to Sunday=6

  return (
    <div className="flex gap-2">
      {days.map((day, index) => {
        const isToday = index === adjustedToday
        const isSelected = index === selectedDay

        return (
          <button
            key={day}
            onClick={() => onDaySelect?.(index)}
            className={`flex-1 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
              isSelected
                ? 'bg-[#2BB3C0] text-white'
                : isToday
                  ? 'bg-white border-2 border-[#2BB3C0] text-[#2BB3C0]'
                  : 'bg-white/60 text-slate-700 hover:bg-white'
            }`}
          >
            <div className="text-center">
              <div className="text-xs opacity-75 mb-0.5">{day}</div>
              <div className="font-semibold">{new Date().getDate() + index - adjustedToday}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
