import { useState } from 'react'
import TopBar from './TopBar'
import LeftRail from './LeftRail'
import RightDrawer from './RightDrawer'
import VoiceModal from '../voice/VoiceModal'

interface MainLayoutProps {
  children: React.ReactNode
  drawerContent?: React.ReactNode
  drawerTitle?: string
}

export default function MainLayout({ children, drawerContent, drawerTitle }: MainLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-[#F7F1E3]">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Rail */}
        <LeftRail />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>

        {/* Right Drawer */}
        {drawerContent && (
          <RightDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            title={drawerTitle}
          >
            {drawerContent}
          </RightDrawer>
        )}
      </div>

      {/* Bottom Bar */}
      <TopBar onVoiceClick={() => setIsVoiceOpen(true)} />

      {/* Voice Modal */}
      <VoiceModal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} />
    </div>
  )
}
