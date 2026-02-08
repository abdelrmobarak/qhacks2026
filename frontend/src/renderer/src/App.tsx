import { useCallback, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { api } from './lib/api'
import { AppLayout } from './components/app-layout'
import { AuthGate } from './components/auth-gate'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Subscriptions from './pages/Subscriptions'
import Todos from './pages/Todos'
import Calendar from './pages/Calendar'
import Agent from './pages/Agent'
import Reports from './pages/reports'
import Settings from './pages/settings'
import { TooltipProvider } from '@/components/ui/tooltip'

const App = () => {
  const { isAuthenticated, user, isLoading, logout, refresh } = useAuth()

  useEffect(() => {
    return window.api.onAuthCompleted(() => {
      refresh()
    })
  }, [refresh])

  const handleLogin = useCallback(async () => {
    try {
      const { auth_url } = await api.startGoogleAuth()
      window.open(auth_url, '_blank')
    } catch (error) {
      console.error('Failed to start auth:', error)
    }
  }, [])

  if (!isAuthenticated) {
    return <AuthGate isLoading={isLoading} onLogin={handleLogin} />
  }

  return (
    <TooltipProvider>
      <AppLayout
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={handleLogin}
        onLogout={logout}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </TooltipProvider>
  )
}

export default App
