import type { TopEntity } from '../lib/api'

interface EntityListProps {
  entities: TopEntity[]
  onEntityClick: (entity: TopEntity) => void
  showContactCount?: boolean
}

export default function EntityList({
  entities,
  onEntityClick,
  showContactCount
}: EntityListProps): React.JSX.Element {
  return (
    <div className="border border-border divide-y divide-border">
      {entities.map((entity, index) => (
        <button
          key={entity.id}
          onClick={() => onEntityClick(entity)}
          className="group w-full flex items-center gap-4 px-4 py-4 hover:bg-surface transition-colors text-left cursor-pointer"
        >
          <span className="num text-2xl text-fg-subtle group-hover:text-accent transition-colors w-10">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-fg group-hover:text-accent transition-colors truncate block">
              {entity.name}
            </span>
            {entity.domain && <span className="text-xs text-fg-muted">{entity.domain}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-fg-muted font-mono">
            {showContactCount && typeof entity.contact_count === 'number' && (
              <span>{entity.contact_count}p</span>
            )}
            <span>{entity.meeting_count}m</span>
            <span>{entity.email_count}e</span>
          </div>
          <span className="text-fg-subtle group-hover:text-accent group-hover:translate-x-1 transition-all">
            →
          </span>
        </button>
      ))}
    </div>
  )
}
