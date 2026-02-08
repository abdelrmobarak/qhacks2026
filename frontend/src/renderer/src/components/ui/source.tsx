import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { createContext, useContext } from "react"

interface SourceContextValue {
  href: string
  domain: string
}

const SourceContext = createContext<SourceContextValue | null>(null)

const useSourceContext = () => {
  const context = useContext(SourceContext)
  if (!context) throw new Error("Source.* must be used inside <Source>")
  return context
}

interface SourceProps {
  href: string
  children: React.ReactNode
}

const Source = ({ href, children }: SourceProps) => {
  let domain = ""
  try {
    domain = new URL(href).hostname
  } catch {
    domain = href.split("/").pop() || href
  }

  return (
    <SourceContext.Provider value={{ href, domain }}>
      <HoverCard openDelay={150} closeDelay={0}>
        {children}
      </HoverCard>
    </SourceContext.Provider>
  )
}

interface SourceTriggerProps {
  label?: string | number
  showFavicon?: boolean
  className?: string
}

const SourceTrigger = ({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) => {
  const { href, domain } = useSourceContext()
  const labelToShow = label ?? domain.replace("www.", "")

  return (
    <HoverCardTrigger
      className={cn(
        "bg-muted text-muted-foreground hover:bg-muted-foreground/30 hover:text-primary inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full py-0 text-xs no-underline transition-colors duration-150 cursor-pointer",
        showFavicon ? "pr-2 pl-1" : "px-1",
        className
      )}
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
    >
      {showFavicon && (
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
          alt="favicon"
          width={14}
          height={14}
          className="size-3.5 rounded-full"
        />
      )}
      <span className="truncate tabular-nums text-center font-normal">{labelToShow}</span>
    </HoverCardTrigger>
  )
}

interface SourceContentProps {
  title: string
  description: string
  className?: string
}

const SourceContent = ({
  title,
  description,
  className,
}: SourceContentProps) => {
  const { href, domain } = useSourceContext()

  return (
    <HoverCardContent className={cn("w-80 p-0 shadow-xs", className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-2 p-3"
      >
        <div className="flex items-center gap-1.5">
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
            alt="favicon"
            className="size-4 rounded-full"
            width={16}
            height={16}
          />
          <div className="text-primary truncate text-sm">
            {domain.replace("www.", "")}
          </div>
        </div>
        <div className="line-clamp-2 text-sm font-medium">{title}</div>
        <div className="text-muted-foreground line-clamp-2 text-sm">
          {description}
        </div>
      </a>
    </HoverCardContent>
  )
}

export { Source, SourceTrigger, SourceContent }
