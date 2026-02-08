import { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare,
  Check,
  CircleNotch,
  ArrowClockwise,
  WarningCircle,
} from '@phosphor-icons/react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { api, type TodoResponse } from '../lib/api'
import { useDataCache } from '../hooks/use-data-cache'

const Todos = () => {
  const { todos: cachedTodos, isTodosLoading, todosError, refreshTodos } = useDataCache()
  const [optimisticTodos, setOptimisticTodos] = useState<TodoResponse[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    setOptimisticTodos(cachedTodos)
  }, [cachedTodos])

  const generateTodos = useCallback(async () => {
    setIsGenerating(true)
    try {
      await api.generateTodos()
      await refreshTodos()
    } catch {
      // silent fail
    } finally {
      setIsGenerating(false)
    }
  }, [refreshTodos])

  const toggleTodo = useCallback(async (todoId: string) => {
    const targetTodo = optimisticTodos.find((todo) => todo.id === todoId)
    if (!targetTodo) return

    setOptimisticTodos((previous) =>
      previous.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
      )
    )

    try {
      await api.updateTodo(todoId, { completed: !targetTodo.completed })
    } catch {
      setOptimisticTodos((previous) =>
        previous.map((todo) =>
          todo.id === todoId ? { ...todo, completed: targetTodo.completed } : todo
        )
      )
    }
  }, [optimisticTodos])

  const completedCount = optimisticTodos.filter((todo) => todo.completed).length

  if (isTodosLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (todosError) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WarningCircle />
          </EmptyMedia>
          <EmptyTitle>Failed to generate to-dos</EmptyTitle>
          <EmptyDescription>{todosError}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={refreshTodos}>
          Retry
        </Button>
      </Empty>
    )
  }

  if (optimisticTodos.length === 0) {
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
    <div className="flex flex-col gap-4 max-w-screen-md mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            {completedCount} of {optimisticTodos.length} completed
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={generateTodos} disabled={isGenerating}>
          {isGenerating ? <CircleNotch className="animate-spin" /> : <ArrowClockwise />}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
          {optimisticTodos.map((todo) => (
            <div
              key={todo.id}
            >
              <Card>
                <CardContent className="flex items-start gap-3">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-xs ${
                        todo.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.text}
                    </span>
                    {todo.source && (
                      <span className="text-xs text-muted-foreground">
                        {todo.link ? (
                          <a
                            href={todo.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground transition-colors"
                          >
                            {todo.source}
                          </a>
                        ) : (
                          todo.source
                        )}
                      </span>
                    )}
                  </div>
                  {todo.completed && (
                    <Check className="size-3.5 text-primary shrink-0" />
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
      </div>
    </div>
  )
}

export default Todos
