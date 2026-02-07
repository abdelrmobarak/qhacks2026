import { useState } from 'react'
import { XMarkIcon, MicrophoneIcon, StopIcon, KeyboardIcon } from '@heroicons/react/24/outline'
import VoiceWaveform from './VoiceWaveform'
import ReplyDraftCard from './ReplyDraftCard'
import SummaryCard from './SummaryCard'
import ActionCard from './ActionCard'

interface VoiceModalProps {
  isOpen: boolean
  onClose: () => void
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'ready'
type InputMode = 'voice' | 'text'

interface ConversationTurn {
  role: 'user' | 'assistant'
  mode: InputMode | 'tts'
  content: string
  timestamp: Date
  cards?: any[]
}

export default function VoiceModal({ isOpen, onClose }: VoiceModalProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [inputMode, setInputMode] = useState<InputMode>('voice')
  const [transcript, setTranscript] = useState('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])

  if (!isOpen) return null

  const handleMicClick = () => {
    if (voiceState === 'idle' || voiceState === 'ready') {
      setVoiceState('listening')
      // Simulate listening -> thinking -> ready
      setTimeout(() => setVoiceState('thinking'), 2000)
      setTimeout(() => {
        const userTurn: ConversationTurn = {
          role: 'user',
          mode: 'voice',
          content: 'Summarize my newsletters and draft replies to anything urgent',
          timestamp: new Date()
        }
        const assistantTurn: ConversationTurn = {
          role: 'assistant',
          mode: 'tts',
          content: '2 newsletters summarized, 1 urgent email needs a reply.',
          timestamp: new Date(),
          cards: [
            { type: 'summary', title: 'Newsletter TLDR' },
            { type: 'reply', title: 'Draft reply ready' }
          ]
        }
        setConversation([...conversation, userTurn, assistantTurn])
        setVoiceState('ready')
        setTranscript(userTurn.content)
      }, 4000)
    } else if (voiceState === 'listening') {
      setVoiceState('idle')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end justify-center z-50 slide-up">
      <div className="w-full max-w-4xl mx-4 mb-4">
        <div className="glass rounded-3xl card-shadow overflow-hidden" style={{ maxHeight: '85vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#2F8F6B] pulse-soft" />
              <h2 className="text-lg font-semibold text-[#0B1B2B] tracking-tight">
                Voice Session
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/60 transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-slate-600" />
            </button>
          </div>

          {/* Input Mode Toggle + Waveform */}
          <div className="px-6 py-4 border-b border-white/40 bg-white/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMode('voice')}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    inputMode === 'voice'
                      ? 'bg-[#2BB3C0] text-white'
                      : 'bg-white/60 text-slate-700 hover:bg-white'
                  }`}
                >
                  <MicrophoneIcon className="w-4 h-4 inline mr-2" />
                  Voice
                </button>
                <button
                  onClick={() => setInputMode('text')}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    inputMode === 'text'
                      ? 'bg-[#2BB3C0] text-white'
                      : 'bg-white/60 text-slate-700 hover:bg-white'
                  }`}
                >
                  <KeyboardIcon className="w-4 h-4 inline mr-2" />
                  Text
                </button>
              </div>

              {/* State Indicator */}
              <div className="flex items-center gap-2">
                {voiceState === 'listening' && (
                  <span className="text-sm text-[#2BB3C0] font-medium">Listening...</span>
                )}
                {voiceState === 'thinking' && (
                  <span className="text-sm text-slate-600 font-medium">Processing...</span>
                )}
              </div>
            </div>

            {/* Waveform or Input */}
            {inputMode === 'voice' ? (
              <div className="flex flex-col items-center py-6">
                {voiceState === 'listening' && <VoiceWaveform />}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Type your command..."
                className="w-full px-4 py-3 rounded-2xl bg-white/60 border border-white/60 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2BB3C0]/50"
              />
            )}
          </div>

          {/* Conversation Timeline */}
          <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {conversation.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2BB3C0] to-[#2F8F6B] mx-auto flex items-center justify-center mb-4">
                  <MicrophoneIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-slate-600 font-medium mb-2">Start a conversation</p>
                <p className="text-sm text-slate-500">
                  Ask me to summarize emails, draft replies, or manage your tasks
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {conversation.map((turn, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 fade-in ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {turn.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2BB3C0] to-[#2F8F6B] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">AI</span>
                      </div>
                    )}

                    <div
                      className={`max-w-[70%] ${
                        turn.role === 'user'
                          ? 'bg-[#2BB3C0] text-white rounded-3xl rounded-tr-lg'
                          : 'bg-white/60 border border-white/60 rounded-3xl rounded-tl-lg'
                      } px-4 py-3`}
                    >
                      <p className={`text-sm ${turn.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                        {turn.content}
                      </p>
                      <span
                        className={`text-xs mt-2 block ${turn.role === 'user' ? 'text-white/70' : 'text-slate-400'}`}
                      >
                        {turn.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {turn.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#2BB3C0] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-xs">A</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Result Cards */}
                {voiceState === 'ready' && conversation.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <ReplyDraftCard
                      to="john@example.com"
                      subject="Re: Project Timeline"
                      draft="Hi John, Thanks for reaching out about the timeline. I'll review the schedule and get back to you by end of day tomorrow."
                    />
                    <ActionCard
                      type="reminder"
                      title="Set reminder"
                      description="Review project timeline by tomorrow"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Thinking State */}
            {voiceState === 'thinking' && (
              <div className="flex items-center justify-center py-8">
                <div className="relative w-48 h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className="absolute inset-0 shimmer rounded-full" />
                </div>
              </div>
            )}
          </div>

          {/* Action Strip */}
          <div className="px-6 py-4 border-t border-white/40 bg-white/30">
            <div className="flex items-center justify-between">
              {/* Primary Action */}
              <button
                onClick={handleMicClick}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all ${
                  voiceState === 'listening'
                    ? 'bg-[#FF6B6B] hover:bg-[#FF6B6B]/90 text-white'
                    : 'bg-[#2BB3C0] hover:bg-[#2BB3C0]/90 text-white'
                }`}
              >
                {voiceState === 'listening' ? (
                  <>
                    <StopIcon className="w-5 h-5" />
                    Stop
                  </>
                ) : (
                  <>
                    <MicrophoneIcon className="w-5 h-5" />
                    {voiceState === 'idle' ? 'Start Listening' : 'Continue'}
                  </>
                )}
              </button>

              {/* Secondary Actions */}
              <div className="flex gap-2">
                {voiceState === 'ready' && (
                  <>
                    <button className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white text-slate-700 font-medium text-sm transition-colors">
                      Approve
                    </button>
                    <button className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white text-slate-700 font-medium text-sm transition-colors">
                      Edit
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white text-slate-700 font-medium text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Hotkey Hints */}
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>
                <kbd className="px-2 py-1 rounded bg-white/60 font-mono">Space</kbd> Push-to-talk
              </span>
              <span>
                <kbd className="px-2 py-1 rounded bg-white/60 font-mono">Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
