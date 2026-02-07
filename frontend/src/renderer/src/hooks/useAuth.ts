import { useState, useEffect, useCallback } from 'react'
import { api, type AuthStatusResponse } from '../lib/api'

interface UseAuthReturn {
  isAuthenticated: boolean
  user: AuthStatusResponse['user'] | null
  snapshotStatus: string | null
  isLoading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthStatusResponse['user'] | null>(null)
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const status = await api.getAuthStatus()
      setIsAuthenticated(status.authenticated)
      setUser(status.user ?? null)
      setSnapshotStatus(status.snapshot_status ?? null)
    } catch {
      setIsAuthenticated(false)
      setUser(null)
      setSnapshotStatus(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      setSnapshotStatus(null)
    }
  }, [])

  return { isAuthenticated, user, snapshotStatus, isLoading, logout, refresh }
}
