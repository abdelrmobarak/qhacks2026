import { useState } from 'react'
import {
  CheckCircleIcon,
  CalendarIcon,
  EnvelopeIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid'

interface TaskCardProps {
  task: {
    id: string
    title: string
    sourceEmail?: string
    category?: string
    dueDay?: string
    completed?: boolean
  }
  onToggle?: (id: string) => void
  onAddToCalendar?: (id: string) => void
  onEmailFollowup?: (id: string) => void
  onSnooze?: (id: string) => void
}

export default function TaskCard({
  task,
  onToggle,
  onAddToCalendar,
  onEmailFollowup,
  onSnooze
}: TaskCardProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed || false)

  const handleToggle = () => {
    setIsCompleted(!isCompleted)
    onToggle?.(task.id)
  }

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-[#2F8F6B]/5 border-[#2F8F6B]/20 opacity-60'
          : 'bg-white/60 border-white/60 hover-lift'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button onClick={handleToggle} className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircleIconSolid className="w-6 h-6 text-[#2F8F6B]" />
          ) : (
            <CheckCircleIcon className="w-6 h-6 text-slate-400 hover:text-[#2F8F6B] transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isCompleted ? 'line-through text-slate-500' : 'text-[#0B1B2B]'
            }`}
          >
            {task.title}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-2">
            {task.sourceEmail && (
              <span className="px-2 py-0.5 rounded-lg bg-[#2BB3C0]/10 text-[#2BB3C0] text-xs font-medium">
                {task.sourceEmail}
              </span>
            )}
            {task.category && (
              <span className="px-2 py-0.5 rounded-lg bg-white text-slate-600 text-xs font-medium">
                {task.category}
              </span>
            )}
            {task.dueDay && (
              <span className="text-xs text-slate-500 font-medium">{task.dueDay}</span>
            )}
          </div>

          {/* Quick Actions */}
          {!isCompleted && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onAddToCalendar?.(task.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-white/80 text-slate-600 text-xs font-medium transition-colors"
                title="Add to Calendar"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Calendar
              </button>
              <button
                onClick={() => onEmailFollowup?.(task.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-white/80 text-slate-600 text-xs font-medium transition-colors"
                title="Email Follow-up"
              >
                <EnvelopeIcon className="w-3.5 h-3.5" />
                Follow-up
              </button>
              <button
                onClick={() => onSnooze?.(task.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-white/80 text-slate-600 text-xs font-medium transition-colors"
                title="Snooze"
              >
                <ClockIcon className="w-3.5 h-3.5" />
                Snooze
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
