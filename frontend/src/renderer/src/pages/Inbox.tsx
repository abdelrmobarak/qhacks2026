import { useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import InboxTabs from '../components/inbox/InboxTabs'
import EmailCard from '../components/inbox/EmailCard'
import { EmailDrawerContent } from '../components/layout/RightDrawer'

const tabs = [
  { id: 'needs-reply', label: 'Needs Reply', count: 5 },
  { id: 'fyi', label: 'FYI', count: 12 },
  { id: 'newsletters', label: 'Newsletters', count: 8 },
  { id: 'receipts', label: 'Receipts & Bills', count: 3 }
]

const mockEmails = {
  'needs-reply': [
    {
      id: '1',
      from: 'Sarah Chen',
      subject: 'Quick question about the report',
      summary:
        'Sarah is asking about the quarterly report deadline and needs clarification on the format requirements.',
      intent: 'Question',
      confidence: 'high' as const,
      timestamp: '2h ago'
    },
    {
      id: '2',
      from: 'Mike Johnson',
      subject: 'Meeting reschedule request',
      summary:
        'Mike needs to reschedule tomorrows 2pm meeting to Thursday at 10am. Waiting for your confirmation.',
      intent: 'Scheduling',
      confidence: 'high' as const,
      timestamp: '5h ago'
    },
    {
      id: '3',
      from: 'Emma Davis',
      subject: 'Budget approval needed',
      summary:
        'Emma submitted the Q2 budget proposal and needs your approval by end of week to proceed with vendor contracts.',
      intent: 'Action Required',
      confidence: 'high' as const,
      timestamp: '1d ago'
    }
  ],
  fyi: [
    {
      id: '4',
      from: 'Team Updates',
      subject: 'Weekly digest',
      summary: 'Summary of this weeks team activities and announcements.',
      intent: 'FYI',
      confidence: 'low' as const,
      timestamp: '3h ago'
    }
  ],
  newsletters: [],
  receipts: []
}

export default function Inbox() {
  const [activeTab, setActiveTab] = useState('needs-reply')
  const [selectedEmail, setSelectedEmail] = useState<any>(null)

  const currentEmails = mockEmails[activeTab as keyof typeof mockEmails] || []

  return (
    <MainLayout
      drawerContent={
        selectedEmail ? (
          <EmailDrawerContent
            email={{
              subject: selectedEmail.subject,
              from: selectedEmail.from,
              tldr: selectedEmail.summary,
              suggestedReply: 'Hi Sarah, The quarterly report is due by end of next week...'
            }}
          />
        ) : null
      }
      drawerTitle="Email Details"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
            Triage by the Pool
          </h1>
          <p className="text-muted-foreground">Not a long email list, but triage-first organization.</p>
        </div>

        {/* Tabs */}
        <InboxTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Email List */}
        <div className="space-y-4">
          {currentEmails.length > 0 ? (
            currentEmails.map((email) => (
              <EmailCard key={email.id} email={email} onSelect={() => setSelectedEmail(email)} />
            ))
          ) : (
            <div className="p-12 rounded-3xl bg-card border border-border text-center">
              <p className="text-muted-foreground text-lg">All caught up! 🌴</p>
              <p className="text-muted-foreground text-sm mt-2">No emails in this category.</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
