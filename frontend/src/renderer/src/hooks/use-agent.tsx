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

const OGG_OPUS_MIME = 'audio/ogg;codecs=opus'
const SUPPORTS_OGG_RECORDING = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(OGG_OPUS_MIME)
const TARGET_SAMPLE_RATE = 24000

const resampleChannel = (channelData: Float32Array, inputRate: number, outputRate: number): Float32Array => {
  if (inputRate === outputRate) return channelData
  const ratio = inputRate / outputRate
  const outputLength = Math.round(channelData.length / ratio)
  const output = new Float32Array(outputLength)
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex++) {
    const inputIndex = outputIndex * ratio
    const low = Math.floor(inputIndex)
    const high = Math.min(low + 1, channelData.length - 1)
    const fraction = inputIndex - low
    output[outputIndex] = channelData[low] * (1 - fraction) + channelData[high] * fraction
  }
  return output
}

const encodeWav = (audioBuffer: AudioBuffer): Blob => {
  const rawChannel = audioBuffer.getChannelData(0)
  const samples = resampleChannel(rawChannel, audioBuffer.sampleRate, TARGET_SAMPLE_RATE)
  const bytesPerSample = 2
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeString = (byteOffset: number, value: string): void => {
    for (let charIndex = 0; charIndex < value.length; charIndex++) {
      view.setUint8(byteOffset + charIndex, value.charCodeAt(charIndex))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let writeOffset = 44
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    const clampedSample = Math.max(-1, Math.min(1, samples[sampleIndex]))
    view.setInt16(writeOffset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true)
    writeOffset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 128000 }
      if (MediaRecorder.isTypeSupported(OGG_OPUS_MIME)) {
        recorderOptions.mimeType = OGG_OPUS_MIME
      }
      const mediaRecorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        stream.getTracks().forEach((track) => track.stop())

        addTurn({ role: 'user', content: 'Transcribing...' })

        const pendingId = addTurn({
          role: 'assistant',
          content: '',
          isPending: true,
        })
        setIsProcessing(true)

        try {
          let audioBlob: Blob
          if (SUPPORTS_OGG_RECORDING) {
            audioBlob = rawBlob
          } else {
            const audioContext = new AudioContext()
            const arrayBuffer = await rawBlob.arrayBuffer()
            const decodedAudio = await audioContext.decodeAudioData(arrayBuffer)
            audioBlob = encodeWav(decodedAudio)
            await audioContext.close()
          }

          const response: VoiceChatResponse = await api.sendVoiceChatCommand(audioBlob)

          if (response.transcript) {
            setConversation((previous) =>
              previous.map((turn) => {
                const isLastUserTurn =
                  turn.role === 'user' &&
                  turn.id !== pendingId &&
                  turn.content === 'Transcribing...'
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
            try {
              const audioBytes = Uint8Array.from(atob(response.audio_base64), (character) =>
                character.charCodeAt(0)
              )
              const playbackContext = new AudioContext()
              const audioBuffer = await playbackContext.decodeAudioData(audioBytes.buffer)
              const source = playbackContext.createBufferSource()
              source.buffer = audioBuffer
              source.connect(playbackContext.destination)

              const finishPlayback = () => {
                clearTimeout(fallbackTimer)
                playbackContext.close()
              }

              source.onended = finishPlayback
              source.start()

              // HACK: AudioBufferSourceNode.onended doesn't fire reliably in Electron
              const fallbackTimer = setTimeout(finishPlayback, audioBuffer.duration * 1000 + 500)
            } catch {
              // playback failed silently
            }
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
