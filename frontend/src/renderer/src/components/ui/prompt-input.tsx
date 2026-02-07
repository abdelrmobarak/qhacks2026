import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

interface PromptInputContextType {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
})

const usePromptInput = () => {
  return useContext(PromptInputContext)
}

interface PromptInputProps extends React.ComponentProps<"div"> {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

const PromptInput = ({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  onClick,
  ...props
}: PromptInputProps) => {
  const [internalValue, setInternalValue] = useState(value || "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!disabled) textareaRef.current?.focus()
    onClick?.(event)
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          disabled,
          textareaRef,
        }}
      >
        <div
          onClick={handleClick}
          className={cn(
            "border-input bg-background cursor-text rounded-3xl border p-2 shadow-xs",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

interface PromptInputTextareaProps extends React.ComponentProps<"textarea"> {
  disableAutosize?: boolean
}

const PromptInputTextarea = ({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: PromptInputTextareaProps) => {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } =
    usePromptInput()

  const adjustHeight = (element: HTMLTextAreaElement | null) => {
    if (!element || disableAutosize) return

    element.style.height = "auto"

    if (typeof maxHeight === "number") {
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
    } else {
      element.style.height = `min(${element.scrollHeight}px, ${maxHeight})`
    }
  }

  const handleRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element
    adjustHeight(element)
  }

  useLayoutEffect(() => {
    if (!textareaRef.current || disableAutosize) return

    const element = textareaRef.current
    element.style.height = "auto"

    if (typeof maxHeight === "number") {
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
    } else {
      element.style.height = `min(${element.scrollHeight}px, ${maxHeight})`
    }
  }, [value, maxHeight, disableAutosize])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(event.target)
    setValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(event)
  }

  return (
    <Textarea
      ref={handleRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(
        "text-foreground min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
      rows={1}
      disabled={disabled}
      {...props}
    />
  )
}

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

const PromptInputActions = ({
  children,
  className,
  ...props
}: PromptInputActionsProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
}

const PromptInputAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) => {
  const { disabled } = usePromptInput()

  return (
    <Tooltip {...props}>
      <TooltipTrigger
        disabled={disabled}
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        className="inline-flex"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
}
