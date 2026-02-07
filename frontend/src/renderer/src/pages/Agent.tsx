import MainLayout from '../components/layout/MainLayout'
import { SparkleIcon, MicrophoneIcon } from '@phosphor-icons/react'

export default function Agent() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-destructive to-primary flex items-center justify-center mb-6">
            <SparkleIcon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-3">
            Agent Mode
          </h1>

          <p className="text-muted-foreground max-w-md mb-8">
            Autonomous agent with text-to-speech and speech-to-text capabilities. Plan complex
            workflows and execute multi-step tasks with voice commands.
          </p>

          <div className="space-y-4 w-full max-w-sm">
            <div className="p-4 rounded-2xl bg-card border border-border text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MicrophoneIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm mb-1">
                    Voice-First Interface
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Natural conversation with SaturdAI using advanced speech recognition
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-chart-2/10">
                  <SparkleIcon className="w-5 h-5 text-chart-2" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm mb-1">
                    Multi-Step Planning
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Break down complex tasks into actionable steps and execute automatically
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mt-8">
            <SparkleIcon className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Bonus Feature - Coming Soon</span>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
