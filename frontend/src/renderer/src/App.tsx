import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProcessingPage from './pages/ProcessingPage'
import DashboardPage from './pages/DashboardPage'
import EmailsPage from './pages/EmailsPage'
import TLDRPage from './pages/TLDRPage'
import SubscriptionsPage from './pages/SubscriptionsPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/processing" element={<ProcessingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/emails" element={<EmailsPage />} />
      <Route path="/tldr" element={<TLDRPage />} />
      <Route path="/subscriptions" element={<SubscriptionsPage />} />
    </Routes>
  )
}

export default App
