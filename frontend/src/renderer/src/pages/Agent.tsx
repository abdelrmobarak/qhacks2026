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
  ChainOfThoughtItem,
} from '@/components/ui/chain-of-thought'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { Markdown } from '@/components/ui/markdown'
import { Logo } from '@/components/logo'
import { useAgent } from '../hooks/use-agent'
import { type AgentStep } from '../lib/api'

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
    <div className="rounded-2xl bg-background py-2.5">
      <ChainOfThought>
        <AnimatePresence initial={false}>
          {THINKING_STEPS.slice(0, visibleCount).map((step, stepIndex) => (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ChainOfThoughtStep>
                <ChainOfThoughtTrigger swapIconOnHover={false}>
                  <TextShimmer>{step.label}</TextShimmer>
                </ChainOfThoughtTrigger>
              </ChainOfThoughtStep>
            </motion.div>
          ))}
        </AnimatePresence>
      </ChainOfThought>
    </div>
  )
}

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: AgentStep[]
  sources?: { title: string; description: string; href: string }[]
  isPending?: boolean
}

interface AssistantMessageProps {
  turn: ConversationTurn
}

const AssistantMessage = ({ turn }: AssistantMessageProps) => {
  const stepCount = turn.steps?.length ?? 0
  const hasSources = turn.sources && turn.sources.length > 0

  return (
    <div className="flex justify-start">
      <div className="max-w-md">
        {stepCount > 0 && (
          <div className="mb-2 rounded-2xl bg-background py-2.5">
            <ChainOfThought>
              {turn.steps!.map((step, stepIndex) => (
                <ChainOfThoughtStep key={stepIndex}>
                  {step.detail ? (
                    <>
                      <ChainOfThoughtTrigger>{step.label}</ChainOfThoughtTrigger>
                      <ChainOfThoughtContent>
                        <ChainOfThoughtItem>{step.detail}</ChainOfThoughtItem>
                      </ChainOfThoughtContent>
                    </>
                  ) : (
                    <ChainOfThoughtTrigger swapIconOnHover={false}>
                      {step.label}
                    </ChainOfThoughtTrigger>
                  )}
                </ChainOfThoughtStep>
              ))}
            </ChainOfThought>
          </div>
        )}

        <div className="rounded-2xl py-2.5">
          <Markdown>{turn.content}</Markdown>
        </div>

        {hasSources && (
          <div className="flex flex-col gap-1.5 mt-2 pl-1">
            {turn.sources!.map((source, sourceIndex) => (
              <a
                key={sourceIndex}
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted hover:border-border"
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
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const Agent = () => {
  const {
    conversation,
    isProcessing,
    command,
    setCommand,
    sendCommand,
    startRecording,
    stopRecording,
    isRecording,
  } = useAgent()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation])

  const handleSubmit = useCallback(() => {
    sendCommand(command)
  }, [command, sendCommand])

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
                onClick={isRecording ? stopRecording : startRecording}
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
