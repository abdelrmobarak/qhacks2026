import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProcessingPage from './pages/ProcessingPage'
import DashboardPage from './pages/DashboardPage'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/processing" element={<ProcessingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  )
}

export default App
