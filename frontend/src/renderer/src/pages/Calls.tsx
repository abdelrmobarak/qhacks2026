import MainLayout from '../components/layout/MainLayout'
import { PhoneIcon, SparklesIcon } from '@heroicons/react/24/outline'

export default function Calls() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2BB3C0] to-[#2F8F6B] flex items-center justify-center mb-6">
            <PhoneIcon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-[#0B1B2B] tracking-tight mb-3">
            Call Summarizer
          </h1>

          <p className="text-slate-600 max-w-md mb-8">
            Automatically summarize calls and meetings. This bonus feature will integrate with
            Microsoft Teams and other platforms to provide AI-generated summaries.
          </p>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF6B6B]/10 border border-[#FF6B6B]/20">
            <SparklesIcon className="w-4 h-4 text-[#FF6B6B]" />
            <span className="text-sm font-medium text-[#FF6B6B]">Bonus Feature - Coming Soon</span>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
