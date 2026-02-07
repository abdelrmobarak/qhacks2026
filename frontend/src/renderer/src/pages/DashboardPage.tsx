import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardData } from '../hooks/useDashboardData'
import { api, type TopEntity, type StoryResponse } from '../lib/api'
import Header from '../components/Header'
import StatCard from '../components/StatCard'
import CostBanner from '../components/CostBanner'
import ActivityHeatmap from '../components/ActivityHeatmap'
import EntityList from '../components/EntityList'
import StoryModal from '../components/StoryModal'
import LoadingScreen from '../components/LoadingScreen'

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { wrapped, topEntities, topOrgs, isLoading, error } = useDashboardData()
  const [selectedEntity, setSelectedEntity] = useState<TopEntity | null>(null)
  const [story, setStory] = useState<StoryResponse | null>(null)
  const [isLoadingStory, setIsLoadingStory] = useState(false)

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/')
  }

  async function handleEntityClick(entity: TopEntity): Promise<void> {
    setSelectedEntity(entity)
    setIsLoadingStory(true)
    setStory(null)
    try {
      const storyData = await api.getStory(entity.id)
      setStory(storyData)
      // If generating, poll
      if (storyData.status === 'generating') {
        pollStory(entity.id)
      }
    } catch (err) {
      setStory({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to load story',
        claims: [],
        timeline: [],
        themes: [],
        locked: false
      })
    } finally {
      setIsLoadingStory(false)
    }
  }

  function pollStory(entityId: string): void {
    const interval = setInterval(async () => {
      try {
        const data = await api.getStory(entityId)
        setStory(data)
        if (data.status !== 'generating') clearInterval(interval)
      } catch {
        clearInterval(interval)
      }
    }, 3000)
  }

  if (isLoading) return <LoadingScreen />

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="text-fg-muted hover:text-fg underline underline-offset-4"
        >
          Go back
        </button>
      </div>
    )
  }

  if (!wrapped?.metrics) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <p className="text-fg-muted">No data available</p>
        <button
          onClick={() => navigate('/')}
          className="text-fg-muted hover:text-fg underline underline-offset-4"
        >
          Go back
        </button>
      </div>
    )
  }

  const { metrics } = wrapped

  return (
    <div className="min-h-screen bg-bg grain">
      <Header email={user?.email} onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {/* Hero */}
        <section className="py-16 text-center">
          <p className="font-mono text-sm text-fg-subtle mb-4">
            {metrics.snapshot_window_days} days analyzed
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.85] tracking-tight">
            Saturdai
          </h1>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard value={metrics.total_meetings} label="meetings" />
          <StatCard value={`${metrics.total_meeting_hours.toFixed(0)}h`} label="in meetings" />
          <StatCard value={`${metrics.focus_hours_per_week.toFixed(0)}h`} label="focus / week" />
          <StatCard value={metrics.total_emails.toLocaleString()} label="emails" />
        </section>

        {/* Cost Banner */}
        <CostBanner cost={metrics.meeting_cost_estimate} />

        {/* Activity Heatmap */}
        <section className="mt-12 mb-12">
          <h2 className="text-2xl font-bold mb-6">Meeting distribution</h2>
          <div className="overflow-x-auto bg-surface border border-border p-6 rounded-none">
            <ActivityHeatmap data={metrics.meeting_heatmap} days={metrics.snapshot_window_days} />
          </div>
        </section>

        {/* Entities */}
        <section className="grid lg:grid-cols-2 gap-8 mb-12">
          {topEntities?.status === 'ready' && topEntities.entities.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Top connections</h2>
              <EntityList entities={topEntities.entities} onEntityClick={handleEntityClick} />
            </div>
          )}
          {topOrgs?.status === 'ready' && topOrgs.entities.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Top organizations</h2>
              <EntityList entities={topOrgs.entities} onEntityClick={handleEntityClick} showContactCount />
            </div>
          )}
        </section>
      </main>

      {/* Story Modal */}
      {selectedEntity && (
        <StoryModal
          entity={selectedEntity}
          story={story}
          isLoading={isLoadingStory}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  )
}
