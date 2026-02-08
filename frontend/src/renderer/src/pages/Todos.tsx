import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CheckSquare,
  CircleNotch,
  ArrowClockwise,
  WarningCircle,
  Circle,
  CheckCircle,
  CaretRight,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { api, type TodoResponse } from '../lib/api'

interface StatusGroup {
  label: string
  icon: React.ReactNode
  items: TodoResponse[]
}

const Todos = () => {
  const [todos, setTodos] = useState<TodoResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const fetchTodos = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getTodos()
      setTodos(response)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load todos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateTodos = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await api.generateTodos()
      setTodos(response)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate todos')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const toggleTodo = useCallback(async (todoId: string) => {
    const targetTodo = todos.find((todo) => todo.id === todoId)
    if (!targetTodo) return

    setTodos((previous) =>
      previous.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
      )
    )

    try {
      await api.updateTodo(todoId, { completed: !targetTodo.completed })
    } catch {
      setTodos((previous) =>
        previous.map((todo) =>
          todo.id === todoId ? { ...todo, completed: targetTodo.completed } : todo
        )
      )
    }
  }, [todos])

  const toggleGroup = useCallback((groupLabel: string) => {
    setCollapsedGroups((previous) => ({
      ...previous,
      [groupLabel]: !previous[groupLabel],
    }))
  }, [])

  const statusGroups = useMemo((): StatusGroup[] => {
    const pendingItems = todos.filter((todo) => !todo.completed)
    const completedItems = todos.filter((todo) => todo.completed)

    return [
      {
        label: 'Todo',
        icon: <Circle weight="bold" className="size-3.5 text-muted-foreground" />,
        items: pendingItems,
      },
      {
        label: 'Done',
        icon: <CheckCircle weight="fill" className="size-3.5 text-primary" />,
        items: completedItems,
      },
    ]
  }, [todos])

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WarningCircle />
          </EmptyMedia>
          <EmptyTitle>Failed to generate to-dos</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={fetchTodos}>
          Retry
        </Button>
      </Empty>
    )
  }

  if (todos.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckSquare />
          </EmptyMedia>
          <EmptyTitle>No tasks yet</EmptyTitle>
          <EmptyDescription>
            Generate tasks from your recent emails.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={generateTodos} disabled={isGenerating} className="gap-1.5">
          {isGenerating ? (
            <CircleNotch className="size-3 animate-spin" />
          ) : (
            <ArrowClockwise className="size-3" />
          )}
          {isGenerating ? 'Generating...' : 'Generate from emails'}
        </Button>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col max-w-screen-md mx-auto">
      <div className="flex items-center justify-end pb-3">
        <Button variant="ghost" size="icon-sm" onClick={generateTodos} disabled={isGenerating}>
          {isGenerating ? <CircleNotch className="animate-spin" /> : <ArrowClockwise />}
        </Button>
      </div>

      <div className="flex flex-col">
        {statusGroups.map((group) => (
          <Collapsible
            key={group.label}
            defaultOpen
            open={!collapsedGroups[group.label]}
            onOpenChange={() => toggleGroup(group.label)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border">
              <CaretRight
                weight="bold"
                className={`size-3 text-muted-foreground transition-transform ${
                  !collapsedGroups[group.label] ? 'rotate-90' : ''
                }`}
              />
              {group.icon}
              <span className="text-xs font-medium">
                {group.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {group.items.length}
              </span>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {group.items.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No items
                </div>
              ) : (
                group.items.map((todo) => (
                  <div
                    key={todo.id}
                    className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border"
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                    />
                    <span
                      className={`flex-1 text-xs ${
                        todo.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.text}
                    </span>
                    {todo.source && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="max-w-32 truncate text-xs text-muted-foreground shrink-0 cursor-default">
                            {todo.link ? (
                              <a
                                href={todo.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                              >
                                {todo.source}
                              </a>
                            ) : (
                              todo.source
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {todo.source}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}

export default Todos
