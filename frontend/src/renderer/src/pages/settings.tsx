import { Gear, UserCircle } from '@phosphor-icons/react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const Settings = () => {
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
        <CardContent className="flex items-start gap-3">
          <UserCircle className="size-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            You can access account actions, including sign out, from the profile menu in the bottom-left sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
