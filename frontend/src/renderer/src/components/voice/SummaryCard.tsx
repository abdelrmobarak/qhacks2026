import { FileTextIcon } from '@phosphor-icons/react'

interface SummaryCardProps {
  title: string
  summary: string
  bullets?: string[]
}

export default function SummaryCard({ title, summary, bullets }: SummaryCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileTextIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground font-medium">Summary</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{title}</p>
        </div>
      </div>

      <p className="text-sm text-accent-foreground">{summary}</p>

      {bullets && bullets.length > 0 && (
        <ul className="space-y-1.5 pl-4">
          {bullets.map((bullet, i) => (
            <li key={i} className="text-sm text-accent-foreground list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
