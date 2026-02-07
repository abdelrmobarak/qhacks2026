import MainLayout from '../components/layout/MainLayout'
import { SparklesIcon, MicrophoneIcon } from '@heroicons/react/24/outline'

export default function Agent() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#2BB3C0] flex items-center justify-center mb-6">
            <SparklesIcon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-[#0B1B2B] tracking-tight mb-3">
            Agent Mode
          </h1>

          <p className="text-slate-600 max-w-md mb-8">
            Autonomous agent with text-to-speech and speech-to-text capabilities. Plan complex
            workflows and execute multi-step tasks with voice commands.
          </p>

          <div className="space-y-4 w-full max-w-sm">
            <div className="p-4 rounded-2xl bg-white/60 border border-white/60 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#2BB3C0]/10">
                  <MicrophoneIcon className="w-5 h-5 text-[#2BB3C0]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#0B1B2B] text-sm mb-1">
                    Voice-First Interface
                  </h3>
                  <p className="text-xs text-slate-600">
                    Natural conversation with SaturdAI using advanced speech recognition
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 border border-white/60 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#2F8F6B]/10">
                  <SparklesIcon className="w-5 h-5 text-[#2F8F6B]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#0B1B2B] text-sm mb-1">
                    Multi-Step Planning
                  </h3>
                  <p className="text-xs text-slate-600">
                    Break down complex tasks into actionable steps and execute automatically
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 mt-8">
            <SparklesIcon className="w-4 h-4 text-[#FF6B6B]" />
            <span className="text-sm font-medium text-[#FF6B6B]">Bonus Feature - Coming Soon</span>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
