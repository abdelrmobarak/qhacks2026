import { useState } from 'react'
import { CaretDownIcon, CaretUpIcon, BookmarkSimpleIcon } from '@phosphor-icons/react'

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
    <div className="p-5 rounded-3xl bg-card border border-border card-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Icon/Logo */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {newsletter.sender.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Sender & Subject */}
          <div className="flex-1">
            <h3 className="font-semibold text-foreground tracking-tight">{newsletter.sender}</h3>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{newsletter.subject}</p>
          </div>
        </div>

        {/* Timestamp & Expand */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground num">{newsletter.timestamp}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {isExpanded ? (
              <CaretUpIcon className="w-5 h-5 text-muted-foreground" />
            ) : (
              <CaretDownIcon className="w-5 h-5 text-muted-foreground" />
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
              className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 pt-3 border-t border-border">
          {/* Key Bullets */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Points</h4>
            <ul className="space-y-2">
              {newsletter.tldr.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-accent-foreground">
                  <span className="text-primary mt-1.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why It Matters */}
          <div className="p-3 rounded-xl bg-chart-2/5 border border-chart-2/10">
            <h4 className="text-xs font-semibold text-chart-2 uppercase mb-1">
              Why It Matters
            </h4>
            <p className="text-sm text-accent-foreground">{newsletter.tldr.whyItMatters}</p>
          </div>

          {/* Links */}
          {newsletter.links.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Links</h4>
              <div className="flex flex-wrap gap-2">
                {newsletter.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-background hover:bg-accent text-primary text-xs font-medium transition-colors"
                  >
                    {link.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background hover:bg-accent text-accent-foreground font-medium text-sm transition-colors">
              <BookmarkSimpleIcon className="w-4 h-4" />
              Save to Reading List
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
