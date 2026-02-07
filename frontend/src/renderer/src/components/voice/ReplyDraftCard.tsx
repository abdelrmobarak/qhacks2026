import { PaperAirplaneIcon, PencilIcon } from '@heroicons/react/24/outline'

interface ReplyDraftCardProps {
  to: string
  subject: string
  draft: string
}

export default function ReplyDraftCard({ to, subject, draft }: ReplyDraftCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-white/60 border border-white/60 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">Reply Draft</p>
          <p className="text-sm font-semibold text-[#0B1B2B] mt-0.5">{subject}</p>
          <p className="text-xs text-slate-600 mt-0.5">To: {to}</p>
        </div>
        <button className="p-2 rounded-lg hover:bg-white transition-colors">
          <PencilIcon className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <p className="text-sm text-slate-700">{draft}</p>

      <div className="flex gap-2 pt-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#2BB3C0] hover:bg-[#2BB3C0]/90 text-white font-medium text-sm transition-colors">
          <PaperAirplaneIcon className="w-4 h-4" />
          Send
        </button>
        <button className="px-4 py-2 rounded-xl bg-white hover:bg-white/80 text-slate-700 font-medium text-sm transition-colors">
          Edit
        </button>
      </div>
    </div>
  )
}
