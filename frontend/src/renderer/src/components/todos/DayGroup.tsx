import TaskCard from './TaskCard'

interface Task {
  id: string
  title: string
  sourceEmail?: string
  category?: string
  dueDay?: string
  completed?: boolean
}

interface DayGroupProps {
  day: string
  date?: string
  tasks: Task[]
  isToday?: boolean
}

export default function DayGroup({ day, date, tasks, isToday = false }: DayGroupProps) {
  const completedCount = tasks.filter((t) => t.completed).length

  return (
    <div>
      {/* Day Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3
            className={`text-lg font-semibold tracking-tight ${
              isToday ? 'text-[#2BB3C0]' : 'text-[#0B1B2B]'
            }`}
          >
            {day}
          </h3>
          {date && <span className="text-sm text-slate-500">{date}</span>}
        </div>
        <span className="text-xs text-slate-500 num">
          {completedCount} / {tasks.length} done
        </span>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
