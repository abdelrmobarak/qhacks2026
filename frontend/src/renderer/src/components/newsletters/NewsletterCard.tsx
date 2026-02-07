import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, BookmarkIcon } from '@heroicons/react/24/outline'

interface NewsletterCardProps {
  newsletter: {
    id: string
    sender: string
    subject: string
    tldr: {
      bullets: string[]
      whyItMatters: string
    }
    links: { title: string; url: string }[]
    timestamp: string
    tags?: string[]
  }
}

export default function NewsletterCard({ newsletter }: NewsletterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="p-5 rounded-3xl bg-white/60 border border-white/60 card-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Icon/Logo */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2BB3C0] to-[#2F8F6B] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {newsletter.sender.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Sender & Subject */}
          <div className="flex-1">
            <h3 className="font-semibold text-[#0B1B2B] tracking-tight">{newsletter.sender}</h3>
            <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">{newsletter.subject}</p>
          </div>
        </div>

        {/* Timestamp & Expand */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 num">{newsletter.timestamp}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white transition-colors"
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-slate-600" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Tags */}
      {newsletter.tags && newsletter.tags.length > 0 && (
        <div className="flex gap-2 mb-3">
          {newsletter.tags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded-lg bg-[#2BB3C0]/10 text-[#2BB3C0] text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 pt-3 border-t border-white/40">
          {/* Key Bullets */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Points</h4>
            <ul className="space-y-2">
              {newsletter.tldr.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-[#2BB3C0] mt-1.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why It Matters */}
          <div className="p-3 rounded-xl bg-[#2F8F6B]/5 border border-[#2F8F6B]/10">
            <h4 className="text-xs font-semibold text-[#2F8F6B] uppercase mb-1">
              Why It Matters
            </h4>
            <p className="text-sm text-slate-700">{newsletter.tldr.whyItMatters}</p>
          </div>

          {/* Links */}
          {newsletter.links.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Links</h4>
              <div className="flex flex-wrap gap-2">
                {newsletter.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-white/80 text-[#2BB3C0] text-xs font-medium transition-colors"
                  >
                    {link.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-white/80 text-slate-700 font-medium text-sm transition-colors">
              <BookmarkIcon className="w-4 h-4" />
              Save to Reading List
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
