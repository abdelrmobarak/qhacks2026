export default function LoadingScreen(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-fg border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
