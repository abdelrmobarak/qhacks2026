import { MicrophoneIcon, GearSixIcon } from '@phosphor-icons/react'

interface TopBarProps {
  onVoiceClick: () => void
  vacationMode?: boolean
}

export default function TopBar({ onVoiceClick, vacationMode = false }: TopBarProps) {
  return (
    <div className="py-4 bg-gradient-to-r from-white to-[#FFF9F0] border-t-2 border-primary/40 flex items-center justify-between px-6 shadow-[0_-4px_20px_rgba(43,179,192,0.15)]">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight">SaturdAI</span>
        </div>
      </div>

      {/* Center: Global Voice Command - Primary CTA */}
      <button
        onClick={onVoiceClick}
        className="flex items-center gap-4 px-8 py-3 rounded-2xl bg-gradient-to-r from-primary to-chart-2 hover:shadow-lg hover-lift group transition-all min-w-[380px] justify-center relative"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/30 group-hover:bg-white/40 transition-colors">
            <MicrophoneIcon className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-white font-medium">Ask SaturdAI...</span>
            <span className="text-xs text-white/80">Voice or text</span>
          </div>
        </div>
        <kbd className="absolute right-3 px-2 py-1 rounded-lg bg-white/30 text-xs text-white font-mono border border-border">
          ⌘K
        </kbd>
      </button>

      {/* Right: Account + Settings */}
      <div className="flex items-center gap-4">
        {/* Sync Indicators */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-chart-2 shadow-[0_0_6px_rgba(47,143,107,0.5)]" title="Gmail Connected" />
          <div className="w-2 h-2 rounded-full bg-chart-2 shadow-[0_0_6px_rgba(47,143,107,0.5)]" title="Calendar Connected" />
        </div>

        {/* Settings */}
        <button className="p-2 rounded-full hover:bg-primary/10 transition-colors">
          <GearSixIcon className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-destructive to-primary flex items-center justify-center shadow-md">
          <span className="text-white font-semibold text-sm">A</span>
        </div>
      </div>
    </div>
  )
}
