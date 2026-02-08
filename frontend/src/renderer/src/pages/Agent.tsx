import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ArrowUp,
  Microphone,
  CircleNotch,
  MicrophoneSlash,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'motion/react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input'
import { PromptSuggestion } from '@/components/ui/prompt-suggestion'
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
} from '@/components/ui/chain-of-thought'
import { Markdown } from '@/components/ui/markdown'
import { Logo } from '@/components/logo'
import { api, type AgentResponse, type AgentStep, type AgentSource } from '../lib/api'

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: AgentStep[]
  sources?: AgentSource[]
  isPending?: boolean
}

const THINKING_STEPS: AgentStep[] = [
  { label: 'Understanding your request...' },
  { label: 'Routing to the right agent...' },
  { label: 'Fetching data...' },
]

const STEP_REVEAL_MS = 700

const SUGGESTIONS = [
  'Summarize my emails',
  'Search emails about project deadlines',
  'Show my subscriptions',
  'Extract todos from my emails',
]

const ThinkingSteps = () => {
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    for (let index = 1; index < THINKING_STEPS.length; index++) {
      timers.push(
        setTimeout(() => {
          setVisibleCount(index + 1)
        }, STEP_REVEAL_MS * index)
      )
    }

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="rounded-2xl bg-muted px-3.5 py-2.5">
      <ChainOfThought>
        <AnimatePresence>
          {THINKING_STEPS.slice(0, visibleCount).map((step, stepIndex) => (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ChainOfThoughtStep>
                <ChainOfThoughtTrigger swapIconOnHover={false}>
                  {step.label}
                </ChainOfThoughtTrigger>
              </ChainOfThoughtStep>
            </motion.div>
          ))}
        </AnimatePresence>
      </ChainOfThought>
    </div>
  )
}

interface AssistantMessageProps {
  turn: ConversationTurn
}

const AssistantMessage = ({ turn }: AssistantMessageProps) => {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [showMessage, setShowMessage] = useState(false)
  const hasAnimated = useRef(false)
  const stepCount = turn.steps?.length ?? 0
  const hasSources = turn.sources && turn.sources.length > 0

  useEffect(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    if (stepCount === 0) {
      setShowMessage(true)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    for (let index = 0; index < stepCount; index++) {
      timers.push(
        setTimeout(() => {
          setVisibleSteps(index + 1)
        }, 300 * (index + 1))
      )
    }

    timers.push(
      setTimeout(() => {
        setShowMessage(true)
      }, 300 * stepCount + 200)
    )

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [stepCount])

  return (
    <div className="flex justify-start">
      <div className="max-w-md">
        {stepCount > 0 && (
          <div className="mb-2 rounded-2xl bg-muted px-3.5 py-2.5">
            <ChainOfThought>
              <AnimatePresence>
                {turn.steps!.slice(0, visibleSteps).map((step, stepIndex) => (
                  <motion.div
                    key={stepIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <ChainOfThoughtStep>
                      {step.detail ? (
                        <>
                          <ChainOfThoughtTrigger>{step.label}</ChainOfThoughtTrigger>
                          <ChainOfThoughtContent>
                            <p className="text-xs text-muted-foreground">{step.detail}</p>
                          </ChainOfThoughtContent>
                        </>
                      ) : (
                        <ChainOfThoughtTrigger swapIconOnHover={false}>
                          {step.label}
                        </ChainOfThoughtTrigger>
                      )}
                    </ChainOfThoughtStep>
                  </motion.div>
                ))}
              </AnimatePresence>
            </ChainOfThought>
          </div>
        )}

        <AnimatePresence>
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="rounded-2xl py-2.5">
                <Markdown>{turn.content}</Markdown>
              </div>

              {hasSources && (
                <div className="flex flex-col gap-1.5 mt-2 pl-1">
                  {turn.sources!.map((source, sourceIndex) => (
                    <motion.a
                      key={sourceIndex}
                      href={source.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted hover:border-border"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: sourceIndex * 0.08 }}
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                        {sourceIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-sm font-medium">{source.title}</span>
                          <ArrowSquareOut className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{source.description}</p>
                      </div>
                    </motion.a>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const Agent = () => {
  const [command, setCommand] = useState('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingTurnIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation])

  const addTurn = useCallback((turn: Omit<ConversationTurn, 'id' | 'timestamp'>) => {
    const turnId = crypto.randomUUID()
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

  const removePendingTurn = useCallback((turnId: string) => {
    setConversation((previous) => previous.filter((turn) => turn.id !== turnId))
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
    pendingTurnIdRef.current = pendingId
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
      pendingTurnIdRef.current = null
      setIsProcessing(false)
    }
  }, [isProcessing, addTurn, replacePendingTurn])

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

        const pendingId = addTurn({
          role: 'assistant',
          content: '',
          isPending: true,
        })
        pendingTurnIdRef.current = pendingId
        setIsProcessing(true)

        try {
          const response = await api.sendVoiceCommand(audioBlob)
          if (response.transcript) {
            setConversation((previous) => {
              const updated = [...previous]
              const lastUserTurn = [...updated].reverse().find(
                (turn) => turn.role === 'user' && turn.id !== pendingId
              )
              if (lastUserTurn) {
                lastUserTurn.content = response.transcript || '(voice command)'
              }
              return updated
            })
          }
          replacePendingTurn(pendingId, {
            content: response.message,
            steps: response.steps,
            sources: response.sources,
          })
        } catch (voiceError) {
          replacePendingTurn(pendingId, {
            content: voiceError instanceof Error ? voiceError.message : 'Voice command failed.',
          })
        } finally {
          pendingTurnIdRef.current = null
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // microphone permission denied
    }
  }, [addTurn, replacePendingTurn])

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
            {conversation.map((turn) => {
              if (turn.role === 'user') {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <div className="max-w-md rounded-2xl px-3.5 py-2.5 bg-primary text-primary-foreground">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                    </div>
                  </div>
                )
              }

              if (turn.isPending) {
                return (
                  <div key={turn.id} className="flex justify-start">
                    <div className="max-w-md">
                      <ThinkingSteps />
                    </div>
                  </div>
                )
              }

              return <AssistantMessage key={turn.id} turn={turn} />
            })}
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
