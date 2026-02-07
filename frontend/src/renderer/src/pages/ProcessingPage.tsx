import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnapshotPolling } from '../hooks/useSnapshotPolling'

const stageLabels: Record<string, string> = {
  init: 'Initializing',
  gmail_list: 'Scanning emails',
  gmail_fetch: 'Reading emails',
  calendar_list: 'Scanning calendar',
  calendar_fetch: 'Reading events',
  wrapped: 'Calculating metrics',
  wrapped_compute: 'Calculating metrics',
  entities: 'Mapping relationships',
  entities_compute: 'Mapping relationships',
  story: 'Generating stories',
  story_generate: 'Generating stories',
  dossier_precompute: 'Preparing dossiers',
  finalize: 'Finalizing'
}

export default function ProcessingPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { stage, progress, isComplete, error } = useSnapshotPolling(true)

  useEffect(() => {
    if (isComplete) {
      navigate('/dashboard', { replace: true })
    }
  }, [isComplete, navigate])

  const label = stage ? stageLabels[stage] || stage : 'Processing'

  if (error) {
    return (
      <div className="min-h-screen bg-bg grain flex flex-col items-center justify-center gap-4 px-4">
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

  return (
    <div className="min-h-screen bg-bg grain flex flex-col p-6 sm:p-10">
      <header className="flex items-center justify-between mb-auto">
        <span className="font-mono text-xs text-fg-subtle uppercase tracking-widest">Wrapped</span>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-xl">
        <div className="mb-8">
          <div className="h-6 w-6 border-2 border-fg border-t-transparent rounded-full animate-spin" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Analyzing your
          <br />
          last 90 days
        </h1>

        <p className="text-fg-muted text-lg mb-12">{label}...</p>

        {progress && (
          <div className="grid grid-cols-3 gap-8 border-t border-border pt-8">
            {progress.emails_seen !== undefined && (
              <div>
                <div className="num text-3xl sm:text-4xl text-fg">
                  {progress.emails_seen.toLocaleString()}
                </div>
                <p className="text-fg-muted text-sm mt-1">emails</p>
              </div>
            )}
            {progress.events_seen !== undefined && (
              <div>
                <div className="num text-3xl sm:text-4xl text-fg">
                  {progress.events_seen.toLocaleString()}
                </div>
                <p className="text-fg-muted text-sm mt-1">events</p>
              </div>
            )}
            {progress.threads_seen !== undefined && (
              <div>
                <div className="num text-3xl sm:text-4xl text-fg">
                  {progress.threads_seen.toLocaleString()}
                </div>
                <p className="text-fg-muted text-sm mt-1">threads</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto pt-12">
        <p className="text-sm text-fg-subtle">
          This usually takes 1-2 minutes depending on your data volume.
        </p>
      </footer>
    </div>
  )
}
