interface StatCardProps {
  value: string | number
  label: string
}

export default function StatCard({ value, label }: StatCardProps): React.JSX.Element {
  return (
    <div className="bg-surface border border-border p-6">
      <div className="num text-4xl sm:text-5xl text-fg">{value}</div>
      <p className="text-fg-muted text-sm mt-2">{label}</p>
    </div>
  )
}
