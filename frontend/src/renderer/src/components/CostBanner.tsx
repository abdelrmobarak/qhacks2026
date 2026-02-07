interface CostBannerProps {
  cost: number
}

export default function CostBanner({ cost }: CostBannerProps): React.JSX.Element {
  return (
    <div className="bg-accent text-white px-6 py-8 text-center">
      <p className="text-white/70 text-sm mb-2">Your meeting time is worth</p>
      <div className="num-display text-5xl sm:text-6xl">${cost.toLocaleString()}</div>
      <p className="text-white/50 text-xs mt-3 font-mono">Based on estimated hourly rate</p>
    </div>
  )
}
