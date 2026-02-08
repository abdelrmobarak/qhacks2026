import { useState, useCallback } from 'react'
import { PaperPlaneRight, CircleNotch } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '../lib/api'

const CommandBar = () => {
  const [command, setCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!command.trim() || isProcessing) return

    setIsProcessing(true)
    try {
      await api.sendAgentCommand(command.trim())
      setCommand('')
    } catch {
      // errors handled by pages that display results
    } finally {
      setIsProcessing(false)
    }
  }, [command, isProcessing])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Input
          placeholder="Ask SaturdAI anything..."
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          className="pr-8 text-xs"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={handleSubmit}
          disabled={!command.trim() || isProcessing}
        >
          {isProcessing ? (
            <CircleNotch className="animate-spin" />
          ) : (
            <PaperPlaneRight />
          )}
        </Button>
      </div>
    </div>
  )
}

export { CommandBar }
