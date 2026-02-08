import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { CommandBar } from './command-bar'
import type { AuthUser } from '../lib/api'

interface AppLayoutProps {
  children: React.ReactNode
  user: AuthUser | null
  isAuthenticated: boolean
  onLogin: () => void
  onLogout: () => void
}

const AppLayout = ({
  children,
  user,
  isAuthenticated,
  onLogin,
  onLogout,
}: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <div
        className="fixed top-0 left-0 right-0 z-20 flex h-10 items-center border-b bg-background pl-20"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <SidebarTrigger style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />
        <div
          className="mx-auto w-full max-w-md"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <CommandBar />
        </div>
      </div>
      <AppSidebar
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      <SidebarInset>
        <div className="relative flex-1 overflow-auto p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { AppLayout }
