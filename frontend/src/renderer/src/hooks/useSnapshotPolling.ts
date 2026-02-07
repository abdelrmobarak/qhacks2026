import { useState, useEffect, useCallback } from 'react'
import { api, type SnapshotStatusResponse } from '../lib/api'

interface UseSnapshotPollingReturn {
  status: string | null
  stage: string | null
  progress: SnapshotStatusResponse['progress'] | null
  isComplete: boolean
  error: string | null
}

export function useSnapshotPolling(enabled: boolean): UseSnapshotPollingReturn {
  const [status, setStatus] = useState<string | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [progress, setProgress] = useState<SnapshotStatusResponse['progress'] | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const poll = useCallback(async () => {
    try {
      const snap = await api.getSnapshotStatus()
      setStatus(snap.status)
      setStage(snap.stage ?? null)
      setProgress(snap.progress ?? null)

      if (snap.status === 'done') {
        setIsComplete(true)
      } else if (snap.status === 'failed') {
        setError(snap.failure_reason || 'Snapshot processing failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [enabled, poll])

  return { status, stage, progress, isComplete, error }
}
