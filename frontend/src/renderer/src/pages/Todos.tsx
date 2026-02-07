import { useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import DayGroup from '../components/todos/DayGroup'
import WeekStrip from '../components/dashboard/WeekStrip'
import { PlusIcon, MicrophoneIcon } from '@phosphor-icons/react'

const mockTasks = {
  monday: [
    {
      id: '1',
      title: 'Review Q1 budget proposal',
      sourceEmail: 'Emma Davis',
      category: 'Work',
      completed: false
    },
    {
      id: '2',
      title: 'Respond to project timeline question',
      sourceEmail: 'Sarah Chen',
      category: 'Work',
      completed: true
    }
  ],
  tuesday: [
    {
      id: '3',
      title: 'Schedule team sync for next week',
      sourceEmail: 'Mike Johnson',
      category: 'Work',
      completed: false
    },
    {
      id: '4',
      title: 'Review and approve vendor contracts',
      category: 'Work',
      completed: false
    }
  ],
  wednesday: [
    {
      id: '5',
      title: 'Submit expense report',
      category: 'Admin',
      completed: false
    }
  ],
  thursday: [],
  friday: [
    {
      id: '6',
      title: 'Prepare presentation for client meeting',
      category: 'Work',
      completed: false
    }
  ]
}

export default function Todos() {
  const [selectedDay, setSelectedDay] = useState(0) // 0 = Monday

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const currentDayTasks = mockTasks[days[selectedDay] as keyof typeof mockTasks] || []

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">Beach Plan</h1>
          <p className="text-muted-foreground">
            Auto-generated tasks from emails, voice-first management.
          </p>
        </div>

        {/* Week Strip */}
        <WeekStrip selectedDay={selectedDay} onDaySelect={setSelectedDay} />

        {/* Quick Actions */}
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors">
            <MicrophoneIcon className="w-4 h-4" />
            Add Task by Voice
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card hover:bg-accent text-accent-foreground font-medium transition-colors">
            <PlusIcon className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-6">
          {currentDayTasks.length > 0 ? (
            <DayGroup
              day={dayLabels[selectedDay]}
              date={`Feb ${8 + selectedDay}`}
              tasks={currentDayTasks}
              isToday={selectedDay === new Date().getDay() - 1}
            />
          ) : (
            <div className="p-12 rounded-3xl bg-card border border-border text-center">
              <p className="text-muted-foreground text-lg">No tasks scheduled for this day 🏖️</p>
              <p className="text-muted-foreground text-sm mt-2">Add a task to get started.</p>
            </div>
          )}
        </div>

        {/* Weekly Overview */}
        <div className="p-6 rounded-3xl bg-card border border-border">
          <h3 className="text-lg font-semibold text-foreground tracking-tight mb-4">
            Week Overview
          </h3>
          <div className="space-y-3">
            {Object.entries(mockTasks).map(([day, tasks]) => {
              const completedCount = tasks.filter((t) => t.completed).length
              const totalCount = tasks.length

              return (
                <div key={day} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-accent-foreground capitalize">{day}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground num">
                      {completedCount} / {totalCount}
                    </span>
                    <div className="w-32 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-chart-2 to-primary rounded-full transition-all"
                        style={{
                          width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
