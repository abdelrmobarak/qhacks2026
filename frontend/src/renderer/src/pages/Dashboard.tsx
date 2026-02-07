import MainLayout from '../components/layout/MainLayout'
import BreezeCard from '../components/dashboard/BreezeCard'
import TriageStack from '../components/dashboard/TriageStack'
import RenewalTimeline from '../components/dashboard/RenewalTimeline'
import WeekStrip from '../components/dashboard/WeekStrip'

// Mock data
const priorityItems = [
  {
    type: 'reply' as const,
    title: 'Project timeline update',
    description: 'John needs a response about the Q1 deliverables',
    time: '2 hours ago',
    priority: 'high' as const
  },
  {
    type: 'bill' as const,
    title: 'Netflix renewal',
    description: 'Your subscription renews in 3 days - $15.99',
    time: 'Tomorrow',
    priority: 'medium' as const
  },
  {
    type: 'meeting' as const,
    title: 'Team standup summary',
    description: '3 action items from this morning meeting',
    time: '3 hours ago',
    priority: 'medium' as const
  }
]

const triageEmails = [
  {
    id: '1',
    from: 'Sarah Chen',
    subject: 'Quick question about the report',
    summary:
      'Sarah is asking about the quarterly report deadline and needs clarification on the format requirements.',
    intent: 'Question'
  },
  {
    id: '2',
    from: 'Mike Johnson',
    subject: 'Meeting reschedule request',
    summary:
      'Mike needs to reschedule tomorrows 2pm meeting to Thursday at 10am. Waiting for your confirmation.',
    intent: 'Scheduling'
  },
  {
    id: '3',
    from: 'Emma Davis',
    subject: 'Budget approval needed',
    summary:
      'Emma submitted the Q2 budget proposal and needs your approval by end of week to proceed with vendor contracts.',
    intent: 'Action Required'
  }
]

const upcomingRenewals = [
  { id: '1', name: 'Netflix', amount: 15.99, daysUntil: 3 },
  { id: '2', name: 'Spotify', amount: 9.99, daysUntil: 7 },
  { id: '3', name: 'Adobe CC', amount: 54.99, daysUntil: 12 },
  { id: '4', name: 'GitHub Pro', amount: 4.0, daysUntil: 18 },
  { id: '5', name: 'iCloud', amount: 2.99, daysUntil: 25 }
]

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
            Arrivals Lounge
          </h1>
          <p className="text-muted-foreground">What needs your attention, without feeling like work.</p>
        </div>

        {/* Today's Breeze - Priority Items */}
        <section>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-4">
            Today's Breeze
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {priorityItems.map((item, index) => (
              <BreezeCard key={index} {...item} />
            ))}
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Inbox Triage */}
          <section>
            <h2 className="text-lg font-semibold text-foreground tracking-tight mb-4">
              Inbox Triage
            </h2>
            <TriageStack emails={triageEmails} />
          </section>

          {/* Right Column - Newsletter TLDR Preview */}
          <section>
            <h2 className="text-lg font-semibold text-foreground tracking-tight mb-4">
              Latest Newsletters
            </h2>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-card border border-border hover-lift"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-chart-2" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm">Tech Newsletter #{i}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        Latest updates on AI developments and new framework releases...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Upcoming Renewals */}
        <section>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-4">
            Upcoming Renewals
          </h2>
          <RenewalTimeline renewals={upcomingRenewals} />
        </section>

        {/* Weekly To-Do */}
        <section>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-4">
            This Week's Plan
          </h2>
          <WeekStrip />
          <div className="mt-4 p-6 rounded-3xl bg-card border border-border">
            <div className="space-y-3">
              {[
                'Review Q1 budget proposal',
                'Schedule team sync for next week',
                'Submit expense report'
              ].map((task, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-lg border-2 border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-accent-foreground">{task}</span>
                  <span className="ml-auto px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                    Mon
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}
