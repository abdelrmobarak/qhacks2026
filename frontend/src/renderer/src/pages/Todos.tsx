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

const Todos = () => {
  const [todos, setTodos] = useState<TodoResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const completedCount = todos.filter((todo) => todo.completed).length

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
    <div className="flex flex-col gap-4 max-w-screen-md mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            {completedCount} of {todos.length} completed
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={generateTodos} disabled={isGenerating}>
          {isGenerating ? <CircleNotch className="animate-spin" /> : <ArrowClockwise />}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
          {todos.map((todo) => (
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
