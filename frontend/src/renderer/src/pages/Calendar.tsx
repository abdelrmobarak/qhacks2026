import { useState, useCallback } from 'react'
import {
  CalendarBlank,
  Plus,
  Check,
  CircleNotch,
  MapPin,
} from '@phosphor-icons/react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { api } from '../lib/api'

interface CreatedEvent {
  eventId: string
  htmlLink: string
  summary: string
}

const Calendar = () => {
  const [summary, setSummary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('10:00')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdEvents, setCreatedEvents] = useState<CreatedEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleCreateEvent = useCallback(async () => {
    if (!summary.trim() || !startDate || !endDate) return

    setIsCreating(true)
    setError(null)
    try {
      const startIso = `${startDate}T${startTime}:00`
      const endIso = `${endDate}T${endTime}:00`

      const result = await api.createCalendarEvent({
        summary: summary.trim(),
        start: startIso,
        end: endIso,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      })

      if (result.created) {
        setCreatedEvents((previous) => [
          {
            eventId: result.event_id,
            htmlLink: result.html_link,
            summary: summary.trim(),
          },
          ...previous,
        ])
        setSummary('')
        setDescription('')
        setLocation('')
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create event')
    } finally {
      setIsCreating(false)
    }
  }, [summary, startDate, startTime, endDate, endTime, description, location])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6 max-w-screen-md mx-auto">
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Create Event
            </CardTitle>
            <CardDescription>
              Add an event to your Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-summary">Event name</Label>
              <Input
                id="event-summary"
                placeholder="Team standup, Doctor appointment..."
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value)
                    if (!endDate) setEndDate(event.target.value)
                  }}
                  min={today}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end-date">End date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  min={startDate || today}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end-time">End time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-location">Location (optional)</Label>
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="event-location"
                  placeholder="Room 101, Zoom link..."
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                placeholder="Meeting agenda, notes..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <Button
              onClick={handleCreateEvent}
              disabled={isCreating || !summary.trim() || !startDate || !endDate}
              className="gap-1.5"
            >
              {isCreating ? (
                <CircleNotch className="animate-spin" />
              ) : (
                <CalendarBlank />
              )}
              Create Event
            </Button>
          </CardContent>
        </Card>
      </div>

      {createdEvents.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground font-medium">Recently created</span>
            {createdEvents.map((createdEvent) => (
              <div
                key={createdEvent.eventId}
              >
                <Card size="sm">
                  <CardContent className="flex items-center gap-3">
                    <Check className="size-4 text-primary" />
                    <span className="text-xs flex-1">{createdEvent.summary}</span>
                    <Badge variant="secondary">Created</Badge>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Calendar
