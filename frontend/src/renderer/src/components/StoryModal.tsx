import type { TopEntity, StoryResponse } from '../lib/api'

interface StoryModalProps {
  entity: TopEntity
  story: StoryResponse | null
  isLoading: boolean
  onClose: () => void
}

export default function StoryModal({
  entity,
  story,
  isLoading,
  onClose
}: StoryModalProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-screen flex items-start justify-center p-6 sm:p-10">
        <div className="w-full max-w-2xl bg-surface border border-border relative mt-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-fg-muted hover:text-fg text-2xl leading-none cursor-pointer"
          >
            ×
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="h-6 w-6 border-2 border-fg border-t-transparent rounded-full animate-spin" />
            </div>
          ) : story?.status === 'locked' ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-6xl mb-6 text-fg-subtle">◐</div>
              <h3 className="text-2xl font-bold mb-2">Story locked</h3>
              <p className="text-fg-muted">
                Unlock all stories to see your relationship with {entity.name}
              </p>
            </div>
          ) : story?.status === 'generating' ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="h-6 w-6 border-2 border-fg border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Generating story</h3>
              <p className="text-fg-muted">This takes about a minute...</p>
            </div>
          ) : story?.status === 'ready' ? (
            <div className="p-8 sm:p-12">
              <div className="mb-8">
                <p className="font-mono text-xs text-fg-subtle uppercase tracking-widest mb-2">
                  {story.entity_name}
                </p>
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight">{story.title}</h3>
              </div>

              {story.themes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {story.themes.map((theme) => (
                    <span
                      key={theme}
                      className="font-mono text-xs text-fg-muted border border-border px-2 py-1"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-lg leading-relaxed mb-10">{story.summary}</p>

              {story.timeline.length > 0 && (
                <div className="mb-10">
                  <h4 className="font-mono text-xs text-fg-subtle uppercase tracking-widest mb-6">
                    Timeline
                  </h4>
                  <div className="space-y-4">
                    {story.timeline.map((entry, index) => (
                      <div key={index} className="flex gap-4">
                        <time className="font-mono text-sm text-fg-muted w-16 shrink-0">
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                        <p className="text-fg">{entry.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {story.claims.length > 0 && (
                <div>
                  <h4 className="font-mono text-xs text-fg-subtle uppercase tracking-widest mb-6">
                    Key insights
                  </h4>
                  <div className="space-y-4">
                    {story.claims.map((claim, index) => (
                      <div key={index} className="flex gap-4">
                        <span className="num text-sm text-accent w-6 shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <p className="text-fg">{claim.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center">
              <p className="text-red-400">{story?.error || 'Failed to load story'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
