import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { api, type AgentResponse, type AgentStep, type AgentSource, type VoiceChatResponse } from '../lib/api'

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: AgentStep[]
  sources?: AgentSource[]
  isPending?: boolean
}

interface AgentContextState {
  conversation: ConversationTurn[]
  isProcessing: boolean
  command: string
  setCommand: (value: string) => void
  sendCommand: (message: string) => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => void
  isRecording: boolean
}

interface AgentProviderProps {
  children: React.ReactNode
}

const AgentContext = createContext<AgentContextState | null>(null)

export const AgentProvider = ({ children }: AgentProviderProps) => {
  const [command, setCommand] = useState('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const turnCounterRef = useRef(0)

  const addTurn = useCallback((turn: Omit<ConversationTurn, 'id' | 'timestamp'>) => {
    const turnId = `turn-${Date.now()}-${turnCounterRef.current++}`
    setConversation((previous) => [
      ...previous,
      { ...turn, id: turnId, timestamp: new Date() },
    ])
    return turnId
  }, [])

  const replacePendingTurn = useCallback((turnId: string, data: Partial<ConversationTurn>) => {
    setConversation((previous) =>
      previous.map((turn) =>
        turn.id === turnId ? { ...turn, ...data, isPending: false } : turn
      )
    )
  }, [])

  const sendCommand = useCallback(async (message: string) => {
    if (!message.trim() || isProcessing) return

    setCommand('')
    addTurn({ role: 'user', content: message.trim() })

    const pendingId = addTurn({
      role: 'assistant',
      content: '',
      isPending: true,
    })
    setIsProcessing(true)

    try {
      const response: AgentResponse = await api.sendAgentCommand(message.trim())
      replacePendingTurn(pendingId, {
        content: response.message,
        steps: response.steps,
        sources: response.sources,
      })
    } catch (sendError) {
      replacePendingTurn(pendingId, {
        content: sendError instanceof Error ? sendError.message : 'Something went wrong.',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, addTurn, replacePendingTurn])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' })
        stream.getTracks().forEach((track) => track.stop())

        addTurn({ role: 'user', content: '(voice command)' })

        const pendingId = addTurn({
          role: 'assistant',
          content: '',
          isPending: true,
        })
        setIsProcessing(true)

        try {
          const response: VoiceChatResponse = await api.sendVoiceChatCommand(audioBlob)

          if (response.transcript) {
            setConversation((previous) =>
              previous.map((turn) => {
                const isLastUserTurn =
                  turn.role === 'user' &&
                  turn.id !== pendingId &&
                  turn.content === '(voice command)'
                return isLastUserTurn
                  ? { ...turn, content: response.transcript }
                  : turn
              })
            )
          }

          replacePendingTurn(pendingId, {
            content: response.response_text,
          })

          if (response.audio_base64) {
            const audioBytes = Uint8Array.from(atob(response.audio_base64), (character) =>
              character.charCodeAt(0)
            )
            const playbackBlob = new Blob([audioBytes], { type: `audio/${response.audio_format}` })
            const audioUrl = URL.createObjectURL(playbackBlob)
            const audio = new Audio(audioUrl)
            audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl))
            audio.play()
          }
        } catch (voiceError) {
          replacePendingTurn(pendingId, {
            content: voiceError instanceof Error ? voiceError.message : 'Voice command failed.',
          })
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // microphone permission denied
    }
  }, [addTurn, replacePendingTurn])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  return (
    <AgentContext.Provider
      value={{
        conversation,
        isProcessing,
        command,
        setCommand,
        sendCommand,
        startRecording,
        stopRecording,
        isRecording,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export const useAgent = (): AgentContextState => {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider')
  }
  return context
}
