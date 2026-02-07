import { useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import SubscriptionCard from '../components/subscriptions/SubscriptionCard'
import RenewalCalendarStrip from '../components/subscriptions/RenewalCalendarStrip'

const mockSubscriptions = [
  {
    id: '1',
    name: 'Netflix',
    lastCharge: 15.99,
    renewalDate: 'Feb 10',
    daysUntilRenewal: 3,
    category: 'Streaming',
    confidence: 'high' as const
  },
  {
    id: '2',
    name: 'Spotify Premium',
    lastCharge: 9.99,
    renewalDate: 'Feb 14',
    daysUntilRenewal: 7,
    category: 'Streaming',
    confidence: 'high' as const
  },
  {
    id: '3',
    name: 'Adobe Creative Cloud',
    lastCharge: 54.99,
    renewalDate: 'Feb 19',
    daysUntilRenewal: 12,
    category: 'Tools',
    confidence: 'high' as const
  },
  {
    id: '4',
    name: 'GitHub Pro',
    lastCharge: 4.0,
    renewalDate: 'Feb 25',
    daysUntilRenewal: 18,
    category: 'Tools',
    confidence: 'high' as const
  },
  {
    id: '5',
    name: 'iCloud Storage',
    lastCharge: 2.99,
    renewalDate: 'Mar 2',
    daysUntilRenewal: 25,
    category: 'Tools',
    confidence: 'medium' as const
  },
  {
    id: '6',
    name: 'LinkedIn Premium',
    lastCharge: 29.99,
    renewalDate: 'Mar 8',
    daysUntilRenewal: 31,
    category: 'Tools',
    confidence: 'high' as const
  }
]

const mockRenewalEvents = mockSubscriptions.map((sub) => {
  const date = new Date()
  date.setDate(date.getDate() + sub.daysUntilRenewal)
  return {
    id: sub.id,
    name: sub.name,
    date,
    amount: sub.lastCharge
  }
})

export default function Subscriptions() {
  const [filter, setFilter] = useState('all')

  const totalMonthly = mockSubscriptions.reduce((sum, sub) => sum + sub.lastCharge, 0)

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-[#0B1B2B] tracking-tight mb-2">
            Tide Tracker
          </h1>
          <p className="text-slate-600">Track and manage all your subscriptions and bills.</p>
        </div>

        {/* Summary Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#2BB3C0] to-[#2F8F6B] text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Monthly Spend</p>
              <p className="text-4xl font-semibold num mt-1">${totalMonthly.toFixed(2)}</p>
              <p className="text-sm opacity-75 mt-2">{mockSubscriptions.length} subscriptions</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Renewing This Month</p>
              <p className="text-2xl font-semibold num mt-1">
                {mockSubscriptions.filter((s) => s.daysUntilRenewal < 30).length}
              </p>
            </div>
          </div>
        </div>

        {/* Renewal Calendar */}
        <RenewalCalendarStrip renewals={mockRenewalEvents} />

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['All', 'Streaming', 'Tools', 'School', 'Gaming'].map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category.toLowerCase())}
              className={`px-4 py-2 rounded-2xl font-medium text-sm whitespace-nowrap transition-all ${
                filter === category.toLowerCase()
                  ? 'bg-[#2BB3C0] text-white'
                  : 'bg-white/60 text-slate-700 hover:bg-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Subscriptions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockSubscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} />
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
