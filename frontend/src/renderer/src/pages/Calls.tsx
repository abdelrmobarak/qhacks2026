import MainLayout from '../components/layout/MainLayout'
import { PhoneIcon, SparkleIcon } from '@phosphor-icons/react'

export default function Calls() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center mb-6">
            <PhoneIcon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-3">
            Call Summarizer
          </h1>

          <p className="text-muted-foreground max-w-md mb-8">
            Automatically summarize calls and meetings. This bonus feature will integrate with
            Microsoft Teams and other platforms to provide AI-generated summaries.
          </p>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20">
            <SparkleIcon className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Bonus Feature - Coming Soon</span>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
