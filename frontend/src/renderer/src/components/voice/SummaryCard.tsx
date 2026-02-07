import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface SummaryCardProps {
  title: string
  summary: string
  bullets?: string[]
}

export default function SummaryCard({ title, summary, bullets }: SummaryCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-white/60 border border-white/60 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#2BB3C0]/10">
          <DocumentTextIcon className="w-5 h-5 text-[#2BB3C0]" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-slate-500 font-medium">Summary</p>
          <p className="text-sm font-semibold text-[#0B1B2B] mt-0.5">{title}</p>
        </div>
      </div>

      <p className="text-sm text-slate-700">{summary}</p>

      {bullets && bullets.length > 0 && (
        <ul className="space-y-1.5 pl-4">
          {bullets.map((bullet, i) => (
            <li key={i} className="text-sm text-slate-700 list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
