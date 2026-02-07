import { XIcon } from '@phosphor-icons/react'

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
            <h2 className="text-lg font-semibold text-foreground">Voice Session</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
              <XIcon className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>
          <p className="text-muted-foreground">Voice interface coming soon...</p>
        </div>
      </div>
    </div>
  )
}
