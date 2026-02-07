interface HeaderProps {
  email?: string
  onLogout: () => void
}

export default function Header({ email, onLogout }: HeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-mono text-xs text-fg-subtle uppercase tracking-widest">Wrapped</span>
        <div className="flex items-center gap-4">
          {email && <span className="text-sm text-fg-muted">{email}</span>}
          <button
            onClick={onLogout}
            className="text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
