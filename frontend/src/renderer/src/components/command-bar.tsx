import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleNotch } from '@phosphor-icons/react'

const CommandBar = () => {
  const [command, setCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = useCallback(() => {
    const trimmed = command.trim()
    if (!trimmed || isProcessing) return

    setIsProcessing(true)
    setCommand('')
    navigate(`/agent?q=${encodeURIComponent(trimmed)}`)
    setIsProcessing(false)
  }, [command, isProcessing, navigate])

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
    <div className="relative flex items-center">
      <input
        placeholder="Ask SaturdAI anything..."
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        className="h-7 w-full rounded-md bg-muted px-2.5 text-xs outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
      />
      {isProcessing && (
        <CircleNotch className="absolute right-2 size-3 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export { CommandBar }
