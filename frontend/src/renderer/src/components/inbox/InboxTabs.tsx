interface Tab {
  id: string
  label: string
  count?: number
}

interface InboxTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function InboxTabs({ tabs, activeTab, onTabChange }: InboxTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-6 py-3 rounded-2xl font-medium text-sm whitespace-nowrap transition-all ${
            activeTab === tab.id
              ? 'bg-primary text-white'
              : 'bg-card text-accent-foreground hover:bg-accent'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-primary/10 text-primary'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
