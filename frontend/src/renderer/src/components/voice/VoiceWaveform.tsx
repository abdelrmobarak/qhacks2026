export default function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-primary rounded-full wave-bar"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}
