type OpenClawApi = {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>
    }
  }
  registerTool: (
    tool: {
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (id: string, params: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>
      }>
    },
    opts?: { optional?: boolean }
  ) => void
}

const PLUGIN_ID = "saturdai-bridge"

interface PluginConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

const getConfig = (api: OpenClawApi): PluginConfig => {
  const config = api.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {}

  const baseUrlValue = config.baseUrl
  const apiKeyValue = config.apiKey
  const timeoutMsValue = config.timeoutMs

  const baseUrl =
    typeof baseUrlValue === "string" && baseUrlValue.trim()
      ? baseUrlValue.trim().replace(/\/$/, "")
      : "http://127.0.0.1:8000"

  const apiKey = typeof apiKeyValue === "string" ? apiKeyValue : ""
  const timeoutMs = typeof timeoutMsValue === "number" ? timeoutMsValue : 15000

  return { baseUrl, apiKey, timeoutMs }
}

const callBackend = async (
  api: OpenClawApi,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> => {
  const config = getConfig(api)
  if (!config.apiKey) {
    throw new Error(`Missing plugin config apiKey for ${PLUGIN_ID}`)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const method = options?.method ?? (options?.body === undefined ? "GET" : "POST")
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })

    const rawText = await response.text()
    if (!response.ok) {
      throw new Error(`SaturdAI backend error (${response.status}): ${rawText}`)
    }

    return rawText ? JSON.parse(rawText) : { ok: true }
  } finally {
    clearTimeout(timeoutId)
  }
}

const toTextResult = (value: unknown) => {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export default (api: OpenClawApi) => {
  api.registerTool({
    name: "saturdai_health",
    description: "Check the SaturdAI OpenClaw bridge health endpoint.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    async execute() {
      const out = await callBackend(api, "/openclaw/health")
      return toTextResult(out)
    },
  })

  api.registerTool({
    name: "saturdai_digest",
    description: "Get the TLDR digest of recent emails.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    async execute() {
      const out = await callBackend(api, "/openclaw/emails/tldr", { method: "POST" })
      return toTextResult(out)
    },
  })

  api.registerTool({
    name: "saturdai_inbox_list",
    description:
      "List categorized inbox emails (optionally filter by category, e.g. needs_reply).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
    },
    async execute(_id, params) {
      const out = await callBackend(api, "/openclaw/inbox/list", {
        method: "POST",
        body: params,
      })
      return toTextResult(out)
    },
  })

  api.registerTool({
    name: "saturdai_tasks_list",
    description: "List current todos.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    async execute() {
      const out = await callBackend(api, "/openclaw/tasks/list", { method: "GET" })
      return toTextResult(out)
    },
  })

  api.registerTool(
    {
      name: "saturdai_task_complete",
      description: "Mark a todo completed (side effect).",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["todoId"],
        properties: { todoId: { type: "string" } },
      },
      async execute(_id, params) {
        const todoId = String(params.todoId || "")
        if (!todoId) {
          throw new Error("todoId is required")
        }
        const out = await callBackend(api, `/openclaw/tasks/${todoId}`, {
          method: "PATCH",
          body: { completed: true },
        })
        return toTextResult(out)
      },
    },
    { optional: true }
  )

  api.registerTool({
    name: "saturdai_reply_draft",
    description: "Draft a reply suggestion for a Gmail message (no sending).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["message_id"],
      properties: { message_id: { type: "string" } },
    },
    async execute(_id, params) {
      const out = await callBackend(api, "/openclaw/reply/draft", {
        method: "POST",
        body: params,
      })
      return toTextResult(out)
    },
  })

  api.registerTool(
    {
      name: "saturdai_reply_send",
      description: "Send an email reply (side effect).",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["message_id", "to", "subject", "body"],
        properties: {
          message_id: { type: "string" },
          thread_id: { type: "string" },
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
      },
      async execute(_id, params) {
        const out = await callBackend(api, "/openclaw/reply/send", {
          method: "POST",
          body: params,
        })
        return toTextResult(out)
      },
    },
    { optional: true }
  )

  api.registerTool(
    {
      name: "saturdai_calendar_create",
      description: "Create a calendar event (side effect).",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "start", "end"],
        properties: {
          summary: { type: "string" },
          start: { type: "string", description: "ISO datetime, e.g. 2026-02-08T17:00:00Z" },
          end: { type: "string", description: "ISO datetime, e.g. 2026-02-08T18:00:00Z" },
          description: { type: "string" },
          location: { type: "string" },
        },
      },
      async execute(_id, params) {
        const out = await callBackend(api, "/openclaw/calendar/create", {
          method: "POST",
          body: params,
        })
        return toTextResult(out)
      },
    },
    { optional: true }
  )
}

