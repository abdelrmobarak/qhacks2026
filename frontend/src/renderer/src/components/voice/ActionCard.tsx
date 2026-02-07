import {
  CalendarIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface ActionCardProps {
  type: 'event' | 'reminder' | 'todo' | 'snooze'
  title: string
  description: string
  onExecute?: () => void
}

const iconMap = {
  event: CalendarIcon,
  reminder: BellIcon,
  todo: CheckCircleIcon,
  snooze: ClockIcon
}

const colorMap = {
  event: '#2BB3C0',
  reminder: '#FF6B6B',
  todo: '#2F8F6B',
  snooze: '#94a3b8'
}

export default function ActionCard({ type, title, description, onExecute }: ActionCardProps) {
  const Icon = iconMap[type]
  const color = colorMap[type]

  return (
    <div className="p-4 rounded-2xl bg-white/60 border border-white/60 flex items-start justify-between">
      <div className="flex items-start gap-3 flex-1">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#0B1B2B]">{title}</p>
          <p className="text-sm text-slate-600 mt-0.5">{description}</p>
        </div>
      </div>

      <button
        onClick={onExecute}
        className="px-4 py-2 rounded-xl bg-[#2BB3C0] hover:bg-[#2BB3C0]/90 text-white font-medium text-sm transition-colors ml-3"
      >
        Execute
      </button>
    </div>
  )
}
