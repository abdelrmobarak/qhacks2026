interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color?: string
}

interface WeekGridProps {
  events: CalendarEvent[]
  startDate?: Date
}

export default function WeekGrid({ events, startDate = new Date() }: WeekGridProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Calculate week dates
  const weekDates = days.map((_, i) => {
    const date = new Date(startDate)
    const dayOffset = i - (date.getDay() === 0 ? 6 : date.getDay() - 1)
    date.setDate(date.getDate() + dayOffset)
    return date
  })

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b border-border">
        <div className="p-3 border-r border-border" />
        {days.map((day, i) => {
          const date = weekDates[i]
          const isToday = date.toDateString() === new Date().toDateString()

          return (
            <div
              key={day}
              className={`p-3 text-center border-r border-border last:border-r-0 ${
                isToday ? 'bg-primary/10' : ''
              }`}
            >
              <div className="text-xs text-muted-foreground font-medium">{day}</div>
              <div
                className={`text-sm font-semibold mt-1 ${
                  isToday ? 'text-primary' : 'text-foreground'
                }`}
              >
                {date.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-8">
          {/* Time column */}
          <div className="border-r border-border">
            {hours.map((hour) => (
              <div key={hour} className="h-16 border-b border-border p-2 text-xs text-muted-foreground">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => (
            <div key={day} className="border-r border-border last:border-r-0 relative">
              {hours.map((hour) => (
                <div key={hour} className="h-16 border-b border-border" />
              ))}

              {/* Events for this day */}
              {events
                .filter((event) => {
                  const eventDate = event.start.toDateString()
                  return eventDate === weekDates[dayIndex].toDateString()
                })
                .map((event) => {
                  const startHour = event.start.getHours()
                  const endHour = event.end.getHours()
                  const duration = endHour - startHour
                  const top = startHour * 64 // 64px per hour (h-16)

                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 rounded-lg p-2 text-xs font-medium overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${duration * 64 - 4}px`,
                        backgroundColor: event.color || '#2BB3C0',
                        color: 'white'
                      }}
                    >
                      {event.title}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
