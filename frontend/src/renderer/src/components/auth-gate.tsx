import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Logo } from './logo'

interface AuthGateProps {
  isLoading: boolean
  onLogin: () => void
}

const AuthGate = ({ isLoading, onLogin }: AuthGateProps) => {
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-12">
        <Logo className="size-14" />
        <Button variant="outline" size="lg" onClick={onLogin}>
          <img src="https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B" alt="Google" className="size-4 shrink-0" />
          Sign in with Google
        </Button>
      </div>
    </div>
  )
}

export { AuthGate }
