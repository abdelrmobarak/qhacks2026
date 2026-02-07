import { ClockIcon, MapPinIcon, UsersIcon } from '@phosphor-icons/react'

interface AgendaEvent {
  id: string
  title: string
  start: Date
  end: Date
  location?: string
  attendees?: number
  color?: string
}

interface AgendaListProps {
  events: AgendaEvent[]
  date?: Date
}

export default function AgendaList({ events, date = new Date() }: AgendaListProps) {
  const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase">Agenda</h3>

      {sortedEvents.length > 0 ? (
        <div className="space-y-2">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="p-4 rounded-2xl bg-card border border-border hover-lift"
            >
              <div className="flex items-start gap-3">
                {/* Color indicator */}
                <div
                  className="w-1 h-full rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: event.color || '#2BB3C0', minHeight: '40px' }}
                />

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h4 className="font-semibold text-foreground text-sm">{event.title}</h4>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                    <ClockIcon className="w-4 h-4" />
                    <span className="text-xs">
                      {formatTime(event.start)} - {formatTime(event.end)}
                    </span>
                  </div>

                  {/* Location */}
                  {event.location && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                      <MapPinIcon className="w-4 h-4" />
                      <span className="text-xs">{event.location}</span>
                    </div>
                  )}

                  {/* Attendees */}
                  {event.attendees && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                      <UsersIcon className="w-4 h-4" />
                      <span className="text-xs">{event.attendees} attendees</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-card border border-border text-center">
          <p className="text-muted-foreground text-sm">No events scheduled</p>
        </div>
      )}

      {/* SaturdAI Suggestions */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
          SaturdAI Suggestions
        </h3>
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Review Q1 budget proposal
                </p>
                <p className="text-xs text-muted-foreground mt-1">Best slot: Tomorrow, 2:00 PM</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors">
                Create Event
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Team sync meeting</p>
                <p className="text-xs text-muted-foreground mt-1">Best slot: Thursday, 10:00 AM</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors">
                Create Event
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
