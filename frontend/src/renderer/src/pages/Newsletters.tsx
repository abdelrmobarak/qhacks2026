import { useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import NewsletterCard from '../components/newsletters/NewsletterCard'
import { FunnelIcon } from '@heroicons/react/24/outline'

const mockNewsletters = [
  {
    id: '1',
    sender: 'Tech Crunch',
    subject: 'The AI revolution continues: GPT-5 announced',
    tldr: {
      bullets: [
        'OpenAI announces GPT-5 with multimodal capabilities',
        'New model shows 40% improvement in reasoning tasks',
        'Enterprise pricing starts at $100/month'
      ],
      whyItMatters:
        'This represents a significant leap in AI capabilities and could reshape how businesses approach automation.'
    },
    links: [
      { title: 'Full Article', url: '#' },
      { title: 'Pricing Details', url: '#' }
    ],
    timestamp: '2h ago',
    tags: ['AI', 'Technology']
  },
  {
    id: '2',
    sender: 'Morning Brew',
    subject: 'Market update: Tech stocks rally on positive earnings',
    tldr: {
      bullets: [
        'S&P 500 up 2.3% on strong tech earnings',
        'Apple and Microsoft beat expectations',
        'Fed signals potential rate cut in Q2'
      ],
      whyItMatters:
        'The positive earnings season and potential rate cuts could signal a strong rebound in tech sector investments.'
    },
    links: [{ title: 'Market Analysis', url: '#' }],
    timestamp: '5h ago',
    tags: ['Finance', 'Markets']
  },
  {
    id: '3',
    sender: 'Product Hunt Daily',
    subject: "Today's top launches: AI design tools and productivity apps",
    tldr: {
      bullets: [
        'Figma launches AI-powered auto-layout',
        'New productivity app Notion Calendar integrates with Slack',
        'Open-source alternative to Photoshop gains traction'
      ],
      whyItMatters:
        'These tools represent the next generation of design and productivity software, potentially saving hours of work weekly.'
    },
    links: [
      { title: 'Figma AI', url: '#' },
      { title: 'Notion Calendar', url: '#' }
    ],
    timestamp: '1d ago',
    tags: ['Product', 'Design', 'Productivity']
  }
]

export default function Newsletters() {
  const [filter, setFilter] = useState('all')

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#0B1B2B] tracking-tight mb-2">
              Sunset Digest
            </h1>
            <p className="text-slate-600">Clean TLDR summaries of your newsletter subscriptions.</p>
          </div>

          {/* Filter */}
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/60 hover:bg-white text-slate-700 font-medium transition-colors">
            <FunnelIcon className="w-4 h-4" />
            Filter
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['All', 'Last 7 days', 'Technology', 'Finance', 'Product'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption.toLowerCase())}
              className={`px-4 py-2 rounded-2xl font-medium text-sm whitespace-nowrap transition-all ${
                filter === filterOption.toLowerCase()
                  ? 'bg-[#2BB3C0] text-white'
                  : 'bg-white/60 text-slate-700 hover:bg-white'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Newsletter List */}
        <div className="space-y-4">
          {mockNewsletters.map((newsletter) => (
            <NewsletterCard key={newsletter.id} newsletter={newsletter} />
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
