import { XMarkIcon } from '@heroicons/react/24/outline'

interface VoiceModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function VoiceModal({ isOpen, onClose }: VoiceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end justify-center z-50">
      <div className="w-full max-w-4xl mx-4 mb-4">
        <div className="glass rounded-3xl card-shadow overflow-hidden p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#0B1B2B]">Voice Session</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60">
              <XMarkIcon className="w-6 h-6 text-slate-600" />
            </button>
          </div>
          <p className="text-slate-600">Voice interface coming soon...</p>
        </div>
      </div>
    </div>
  )
}
