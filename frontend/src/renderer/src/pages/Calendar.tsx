import { useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import WeekGrid from '../components/calendar/WeekGrid'
import AgendaList from '../components/calendar/AgendaList'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

const mockEvents = [
  {
    id: '1',
    title: 'Team Standup',
    start: new Date(2026, 1, 10, 9, 0),
    end: new Date(2026, 1, 10, 10, 0),
    location: 'Conference Room A',
    attendees: 8,
    color: '#2BB3C0'
  },
  {
    id: '2',
    title: 'Client Meeting',
    start: new Date(2026, 1, 10, 14, 0),
    end: new Date(2026, 1, 10, 15, 30),
    location: 'Zoom',
    attendees: 4,
    color: '#FF6B6B'
  },
  {
    id: '3',
    title: 'Project Review',
    start: new Date(2026, 1, 11, 11, 0),
    end: new Date(2026, 1, 11, 12, 0),
    location: 'Office',
    attendees: 6,
    color: '#2F8F6B'
  },
  {
    id: '4',
    title: 'Lunch with Sarah',
    start: new Date(2026, 1, 12, 12, 30),
    end: new Date(2026, 1, 12, 13, 30),
    location: 'Downtown Cafe',
    attendees: 2,
    color: '#94a3b8'
  }
]

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'day' | 'week'>('week')

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
              Palm View
            </h1>
            <p className="text-muted-foreground">Calendar with AI-powered scheduling suggestions.</p>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                view === 'day'
                  ? 'bg-primary text-white'
                  : 'bg-card text-accent-foreground hover:bg-accent'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                view === 'week'
                  ? 'bg-primary text-white'
                  : 'bg-card text-accent-foreground hover:bg-accent'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousWeek}
              className="p-2 rounded-lg bg-card hover:bg-accent transition-colors"
            >
              <CaretLeftIcon className="w-5 h-5 text-accent-foreground" />
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-lg bg-card hover:bg-accent transition-colors"
            >
              <CaretRightIcon className="w-5 h-5 text-accent-foreground" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-xl bg-card hover:bg-accent text-accent-foreground font-medium text-sm transition-colors"
          >
            Today
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Week Grid */}
          <div className="lg:col-span-2">
            <WeekGrid events={mockEvents} startDate={currentDate} />
          </div>

          {/* Agenda & Suggestions */}
          <div>
            <AgendaList events={mockEvents} date={currentDate} />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
