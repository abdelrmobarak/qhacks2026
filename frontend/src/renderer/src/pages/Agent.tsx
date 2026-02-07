import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ArrowUp,
  Microphone,
  CircleNotch,
  MicrophoneSlash,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input'
import { PromptSuggestion } from '@/components/ui/prompt-suggestion'
import { Logo } from '@/components/logo'
import { api, type AgentResponse } from '../lib/api'

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTIONS = [
  'Summarize my emails',
  'Search emails about project deadlines',
  'Show my subscriptions',
  'Extract todos from my emails',
]

const Agent = () => {
  const [command, setCommand] = useState('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation])

  const addTurn = useCallback((turn: Omit<ConversationTurn, 'id' | 'timestamp'>) => {
    setConversation((previous) => [
      ...previous,
      { ...turn, id: `turn-${Date.now()}`, timestamp: new Date() },
    ])
  }, [])

  const sendCommand = useCallback(async (message: string) => {
    if (!message.trim() || isProcessing) return

    setCommand('')
    addTurn({ role: 'user', content: message.trim() })
    setIsProcessing(true)

    try {
      const response: AgentResponse = await api.sendAgentCommand(message.trim())
      addTurn({
        role: 'assistant',
        content: response.message,
      })
    } catch (sendError) {
      addTurn({
        role: 'assistant',
        content: sendError instanceof Error ? sendError.message : 'Something went wrong.',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, addTurn])

  const handleSubmit = useCallback(() => {
    sendCommand(command)
  }, [command, sendCommand])

  const handleStartRecording = useCallback(async () => {
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
        setIsProcessing(true)

        try {
          const response = await api.sendVoiceCommand(audioBlob)
          if (response.transcript) {
            setConversation((previous) => {
              const updated = [...previous]
              const lastUserTurn = updated.findLast((turn) => turn.role === 'user')
              if (lastUserTurn) {
                lastUserTurn.content = response.transcript || '(voice command)'
              }
              return updated
            })
          }
          addTurn({
            role: 'assistant',
            content: response.message,
          })
        } catch (voiceError) {
          addTurn({
            role: 'assistant',
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
  }, [addTurn])

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const hasConversation = conversation.length > 0

  return (
    <div className="flex flex-col h-full max-w-screen-md mx-auto">
      <ScrollArea className="flex-1" ref={scrollRef}>
        {!hasConversation ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Logo className="size-14" />
            <p className="text-sm text-muted-foreground">Ready when you are.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {conversation.map((turn) => (
              <div
                key={turn.id}
                className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-2xl px-3.5 py-2.5 ${
                    turn.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3.5 py-2.5">
                  <CircleNotch className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="flex flex-col gap-3 pt-2">
        {!hasConversation && (
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((suggestion) => (
              <PromptSuggestion
                key={suggestion}
                onClick={() => sendCommand(suggestion)}
              >
                {suggestion}
              </PromptSuggestion>
            ))}
          </div>
        )}

        <PromptInput
          value={command}
          onValueChange={setCommand}
          onSubmit={handleSubmit}
          isLoading={isProcessing}
          disabled={isRecording}
        >
          <PromptInputTextarea placeholder="Ask me anything..." />
          <PromptInputActions className="justify-end px-2 pb-1">
            <PromptInputAction tooltip={isRecording ? 'Stop recording' : 'Voice command'}>
              <Button
                variant={isRecording ? 'destructive' : 'ghost'}
                size="icon-sm"
                className="rounded-full"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing}
              >
                {isRecording ? <MicrophoneSlash /> : <Microphone />}
              </Button>
            </PromptInputAction>
            <PromptInputAction tooltip="Send message">
              <Button
                variant="default"
                size="icon-sm"
                className="rounded-full"
                onClick={handleSubmit}
                disabled={!command.trim() || isProcessing || isRecording}
              >
                {isProcessing ? (
                  <CircleNotch className="animate-spin" />
                ) : (
                  <ArrowUp />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}

export default Agent
