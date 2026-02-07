import React from 'react'
import { cn } from '@/lib/utils'
import logoSrc from '../assets/SATURDAI-2.png'

interface LogoProps {
  className?: string
}

const Logo = ({ className }: LogoProps): React.ReactElement => {
  return (
    <div className={cn('rounded-md bg-primary flex items-center justify-center p-2 aspect-square', className)}>
      <img src={logoSrc} alt="Saturdai logo" className="size-full object-contain" />
    </div>
  )
}

export { Logo }
