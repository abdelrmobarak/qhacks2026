import { useLocation, useNavigate } from 'react-router-dom'
import {
  Tray,
  CreditCard,
  CheckSquare,
  Robot,
  Microphone,
  Notebook,
  ShareNetwork,
  House,
  SignOut,
  Gear,
  GoogleLogo,
  CaretUpDown,
} from '@phosphor-icons/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from './logo'
import type { AuthUser } from '../lib/api'

interface AppSidebarProps {
  user: AuthUser | null
  isAuthenticated: boolean
  onLogin: () => void
  onLogout: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

const mainNavItems: NavItem[] = [
  { label: 'Home', path: '/dashboard', icon: <House weight="duotone" /> },
  { label: 'Inbox', path: '/inbox', icon: <Tray weight="duotone" /> },
  { label: 'Subscriptions', path: '/subscriptions', icon: <CreditCard weight="duotone" /> },
  { label: 'To-Do', path: '/todos', icon: <CheckSquare weight="duotone" /> },
  { label: 'Network', path: '/network', icon: <ShareNetwork weight="duotone" /> },
  { label: 'Chat', path: '/agent', icon: <Robot weight="duotone" /> },
  { label: 'Voice', path: '/voice', icon: <Microphone weight="duotone" /> },
  { label: 'Daily Report', path: '/reports', icon: <Notebook weight="duotone" /> },
]

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AppSidebar = ({ user, isAuthenticated, onLogin, onLogout }: AppSidebarProps) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Logo className="size-8" />
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')}
                    onClick={() => navigate(item.path)}
                    tooltip={item.label}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter>
        <Separator />
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus-visible:ring-ring/50 focus-visible:border-ring flex w-full cursor-pointer items-center gap-2 rounded-none border border-transparent p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-1 focus-visible:outline-none">
              <Avatar size="lg">
                <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <span className="truncate text-xs font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <CaretUpDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Gear />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} variant="destructive">
                <SignOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="p-2">
            <Button variant="outline" className="w-full" onClick={onLogin}>
              <GoogleLogo weight="bold" data-icon="inline-start" />
              Connect Google
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

export { AppSidebar }
