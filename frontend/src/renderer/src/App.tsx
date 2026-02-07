import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Newsletters from './pages/Newsletters'
import Subscriptions from './pages/Subscriptions'
import Todos from './pages/Todos'
import Calendar from './pages/Calendar'
import Calls from './pages/Calls'
import Agent from './pages/Agent'

function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Main App Routes */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/newsletters" element={<Newsletters />} />
      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/todos" element={<Todos />} />
      <Route path="/calendar" element={<Calendar />} />

      {/* Bonus Features */}
      <Route path="/calls" element={<Calls />} />
      <Route path="/agent" element={<Agent />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
