interface ActivityHeatmapProps {
  data: Record<string, number>
  days?: number
}

export default function ActivityHeatmap({
  data,
  days = 90
}: ActivityHeatmapProps): React.JSX.Element {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days)

  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  const current = new Date(startDate)

  while (current <= today) {
    if (current.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  const maxValue = Math.max(...Object.values(data), 1)

  function getLevel(value: number): number {
    if (value === 0) return 0
    const normalized = value / maxValue
    if (normalized <= 0.2) return 1
    if (normalized <= 0.4) return 2
    if (normalized <= 0.6) return 3
    if (normalized <= 0.8) return 4
    return 5
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return (
    <div className="inline-block">
      <div className="flex gap-0.5 mb-1">
        <div className="w-4" />
        {weeks.map((week, i) => {
          const firstDay = week[0]
          const showMonth = i === 0 || firstDay.getDate() <= 7
          return (
            <div key={i} className="w-3 text-[10px] text-fg-subtle font-mono">
              {showMonth ? months[firstDay.getMonth()] : ''}
            </div>
          )
        })}
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
        <div key={dayOfWeek} className="flex gap-0.5 items-center">
          <span className="w-4 text-[10px] text-fg-subtle font-mono text-right pr-1">
            {dayOfWeek === 1 ? 'M' : dayOfWeek === 3 ? 'W' : dayOfWeek === 5 ? 'F' : ''}
          </span>
          {weeks.map((week, weekIndex) => {
            const day = week.find((d) => d.getDay() === dayOfWeek)
            if (!day) return <div key={weekIndex} className="w-3 h-3" />
            const dateStr = day.toISOString().split('T')[0]
            const value = data[dateStr] || 0
            const level = getLevel(value)
            return <div key={weekIndex} className={`w-3 h-3 heat-${level}`} title={`${dateStr}: ${value}`} />
          })}
        </div>
      ))}
    </div>
  )
}
