import { cn } from "@/lib/utils"

interface TextShimmerProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  duration?: number
  spread?: number
  children: React.ReactNode
}

const TextShimmer = ({
  as: Component = "span",
  className,
  duration = 4,
  spread = 20,
  children,
  ...props
}: TextShimmerProps) => {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45)

  return (
    <Component
      className={cn(
        "bg-size-[200%_auto] bg-clip-text font-medium text-transparent",
        "animate-shimmer",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, var(--muted-foreground) ${50 - dynamicSpread}%, var(--foreground) 50%, var(--muted-foreground) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}

export { TextShimmer }
