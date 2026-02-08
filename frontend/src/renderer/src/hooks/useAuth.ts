import { useState, useEffect, useCallback } from 'react'
import { api, type AuthUser } from '../lib/api'

interface UseAuthReturn {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const useAuth = (): UseAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const status = await api.getAuthStatus()
      setIsAuthenticated(status.authenticated)
      setUser(status.user ?? null)
    } catch {
      setIsAuthenticated(false)
      setUser(null)
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
    }
  }, [])

  return { isAuthenticated, user, isLoading, logout, refresh }
}
