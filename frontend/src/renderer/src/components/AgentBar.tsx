import { useState, useRef } from 'react'
import { api, type AgentResponse } from '../lib/api'

export default function AgentBar(): React.JSX.Element {
  const [command, setCommand] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [response, setResponse] = useState<AgentResponse | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!command.trim() || isLoading) return

    setIsLoading(true)
    setResponse(null)
    try {
      const result = await api.sendAgentCommand(command)
      setResponse(result)
      setCommand('')
    } catch (err) {
      setResponse({
        action: 'error',
        result: {},
        message: err instanceof Error ? err.message : 'Failed to process command'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleRecording(): Promise<void> {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        setIsLoading(true)
        setResponse(null)
        try {
          const result = await api.sendVoiceCommand(blob)
          setResponse(result)
        } catch (err) {
          setResponse({
            action: 'error',
            result: {},
            message: err instanceof Error ? err.message : 'Failed to process voice command'
          })
        } finally {
          setIsLoading(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // Microphone permission denied
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-sm border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-3">
        {response && (
          <div className="mb-3 p-3 bg-surface border border-border text-sm">
            {response.transcript && (
              <p className="text-fg-subtle mb-1 font-mono text-xs">
                You said: "{response.transcript}"
              </p>
            )}
            <p className="text-fg">{response.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Ask SaturdAI... (e.g. 'summarize my emails', 'show subscriptions')"
            className="flex-1 bg-surface border border-border px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-fg-muted"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isLoading}
            className={`px-4 py-2.5 border text-sm font-mono transition-colors cursor-pointer ${
              isRecording
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-surface border-border text-fg-muted hover:text-fg hover:border-fg-muted'
            }`}
          >
            {isRecording ? 'STOP' : 'MIC'}
          </button>
          <button
            type="submit"
            disabled={isLoading || !command.trim()}
            className="px-6 py-2.5 bg-fg text-bg text-sm font-mono hover:bg-fg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? '...' : 'GO'}
          </button>
        </form>
      </div>
    </div>
  )
}
