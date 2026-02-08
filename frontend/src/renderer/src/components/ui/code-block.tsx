import { cn } from '@/lib/utils'

interface CodeBlockProps {
  children: React.ReactNode
  className?: string
  language?: string
}

const CodeBlock = ({ children, className, language }: CodeBlockProps) => (
  <pre
    className={cn(
      'bg-muted/50 overflow-x-auto rounded-lg border p-3 text-sm',
      className
    )}
    data-language={language}
  >
    <code>{children}</code>
  </pre>
)

interface InlineCodeProps {
  children: React.ReactNode
  className?: string
}

const InlineCode = ({ children, className }: InlineCodeProps) => (
  <code
    className={cn(
      'bg-muted rounded-md px-1.5 py-0.5 text-sm font-mono',
      className
    )}
  >
    {children}
  </code>
)

export { CodeBlock, InlineCode }
