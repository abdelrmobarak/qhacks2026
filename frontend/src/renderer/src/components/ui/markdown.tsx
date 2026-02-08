import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { CodeBlock, InlineCode } from '@/components/ui/code-block'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  className?: string
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-2">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const languageMatch = /language-(\w+)/.exec(className || '')
    const isInline = !languageMatch && !String(children).includes('\n')

    if (isInline) {
      return <InlineCode {...rest}>{children}</InlineCode>
    }

    return (
      <CodeBlock language={languageMatch?.[1]}>
        {String(children).replace(/\n$/, '')}
      </CodeBlock>
    )
  },
  hr: () => <hr className="border-muted-foreground/20 my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-muted-foreground/20 px-2 py-1 text-left font-semibold bg-muted/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-muted-foreground/20 px-2 py-1">{children}</td>
  ),
}

const Markdown = ({ children, className }: MarkdownProps) => (
  <div className={cn('text-xs', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  </div>
)

export { Markdown }
