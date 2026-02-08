import { useCallback, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout } from './components/app-layout'
import { AuthGate } from './components/auth-gate'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Subscriptions from './pages/Subscriptions'
import Todos from './pages/Todos'
import Agent from './pages/Agent'
import Network from './pages/network'
import Reports from './pages/reports'
import Voice from './pages/voice'
import Settings from './pages/settings'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AgentProvider } from './hooks/use-agent'
import { DataCacheProvider } from './hooks/use-data-cache'

const App = () => {
  const { isAuthenticated, user, isLoading, logout, refresh } = useAuth()

  useEffect(() => {
    return window.api.onAuthCompleted(() => {
      refresh()
    })
  }, [refresh])

  const handleLogin = useCallback(async () => {
    try {
      const result = await window.api.startGoogleAuth()
      if (result.success) {
        refresh()
      }
    } catch (error) {
      console.error('Failed to start auth:', error)
    }
  }, [refresh])

  if (!isAuthenticated) {
    return <AuthGate isLoading={isLoading} onLogin={handleLogin} />
  }

  return (
    <TooltipProvider>
      <DataCacheProvider>
        <AgentProvider>
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
              <Route path="/agent" element={<Agent />} />
              <Route path="/network" element={<Network />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/voice" element={<Voice />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AppLayout>
        </AgentProvider>
      </DataCacheProvider>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
