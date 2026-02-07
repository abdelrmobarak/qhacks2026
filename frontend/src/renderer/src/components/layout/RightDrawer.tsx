import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'

interface RightDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
}

export default function RightDrawer({ isOpen, onClose, title, children }: RightDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="w-96 glass border-l border-white/60 flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/40 flex items-center justify-between">
        <h3 className="font-semibold text-[#0B1B2B] tracking-tight">{title || 'Details'}</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  )
}

// Specialized drawer content components
export function EmailDrawerContent({
  email
}: {
  email: {
    subject: string
    from: string
    tldr: string
    suggestedReply?: string
  }
}) {
  return (
    <div className="space-y-6">
      {/* TLDR */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Summary</h4>
        <p className="text-sm text-slate-700">{email.tldr}</p>
      </div>

      {/* Suggested Reply */}
      {email.suggestedReply && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Suggested Reply</h4>
          <div className="space-y-3">
            {/* Tone chips */}
            <div className="flex gap-2">
              {['Friendly', 'Short', 'Professional'].map((tone) => (
                <button
                  key={tone}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/60 hover:bg-white transition-colors text-slate-700"
                >
                  {tone}
                </button>
              ))}
            </div>

            {/* Reply text */}
            <textarea
              className="w-full p-4 rounded-2xl bg-white/60 border border-white/60 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#2BB3C0]/50"
              rows={6}
              defaultValue={email.suggestedReply}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2BB3C0] hover:bg-[#2BB3C0]/90 text-white font-medium transition-colors">
                <PaperAirplaneIcon className="w-4 h-4" />
                Send Reply
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-white/60 hover:bg-white text-slate-700 font-medium transition-colors">
                Voice Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Quick Actions</h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2.5 rounded-xl bg-white/60 hover:bg-white text-left text-sm font-medium text-slate-700 transition-colors">
            Add to To-Do
          </button>
          <button className="w-full px-4 py-2.5 rounded-xl bg-white/60 hover:bg-white text-left text-sm font-medium text-slate-700 transition-colors">
            Snooze Until Tomorrow
          </button>
          <button className="w-full px-4 py-2.5 rounded-xl bg-white/60 hover:bg-white text-left text-sm font-medium text-slate-700 transition-colors">
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
