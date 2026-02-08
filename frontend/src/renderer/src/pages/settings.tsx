import { Gear, UserCircle, Sun, Moon, Monitor } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ThemeOption {
  value: string
  label: string
  icon: React.ReactNode
}

const themeOptions: ThemeOption[] = [
  { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
  { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
]

const Settings = () => {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-4 max-w-screen-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gear className="size-4" />
            Settings
          </CardTitle>
          <CardDescription>
            Manage your account and app preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose your preferred appearance.
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.icon}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-3">
            <UserCircle className="size-5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              You can access account actions, including sign out, from the profile menu in the bottom-left sidebar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
