import { NavLink } from 'react-router-dom'
import {
  TrayIcon,
  NewspaperIcon,
  CreditCardIcon,
  CheckCircleIcon,
  CalendarIcon,
  PhoneIcon,
  SparkleIcon
} from '@phosphor-icons/react'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: TrayIcon, label: 'Inbox' },
  { to: '/newsletters', icon: NewspaperIcon, label: 'Newsletters' },
  { to: '/subscriptions', icon: CreditCardIcon, label: 'Subscriptions' },
  { to: '/todos', icon: CheckCircleIcon, label: 'To-Do' },
  { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  { to: '/calls', icon: PhoneIcon, label: 'Calls' },
  { to: '/agent', icon: SparkleIcon, label: 'Agent Mode' }
]

export default function LeftRail() {
  return (
    <div className="w-20 glass border-r border-border flex flex-col items-center py-6 gap-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `group flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <item.icon className="w-6 h-6 mb-1" />
          <span className="text-[9px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}
