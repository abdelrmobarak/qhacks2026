const API_URL = 'http://localhost:8000'

const fetchAPI = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthStatusResponse {
  authenticated: boolean
  user?: AuthUser
}

export interface AuthStartResponse {
  auth_url: string
}

export interface CategorizedEmail {
  message_id: string
  thread_id: string
  subject: string
  from_email: string
  from_name: string
  snippet: string
  body_preview: string
  date: string
  category: string
  priority: number
  category_reason: string
  is_automated: boolean
}

export interface TLDRHighlight {
  subject: string
  from: string
  gist: string
  action_needed: boolean
}

export interface TLDRDigest {
  summary: string
  highlights: TLDRHighlight[]
}

export interface ReplySuggestion {
  subject: string
  body: string
  tone: string
}

export interface Subscription {
  service_name: string
  amount: string | null
  currency: string | null
  renewal_date: string | null
  frequency: string | null
  status: string | null
  source_subject: string | null
}

export interface AgentStep {
  label: string
  detail?: string
}

export interface AgentSource {
  title: string
  description: string
  href: string
}

export interface AgentResponse {
  action: string
  result: Record<string, unknown>
  message: string
  transcript?: string
  routing_confidence?: number
  steps?: AgentStep[]
  sources?: AgentSource[]
}

<<<<<<< HEAD
export interface VoiceChatResponse {
  transcript: string
  response_text: string
  audio_base64: string
  audio_format: string
  duration_ms: number
  tool_calls: Record<string, unknown>[]
=======
export interface ChatMessage {
  role: string
  content: string
}

export interface ChatResponse {
  response: string
  tool_calls: Record<string, unknown>[]
  conversation: ChatMessage[]
>>>>>>> ac27adf02fa67ba72e3560177ed1b3ca773d3042
}

export interface CalendarEventResponse {
  created: boolean
  event_id: string
  html_link: string
}

export interface TodoResponse {
  id: string
  text: string
  source: string | null
  link: string | null
  priority: number
  completed: boolean
}

export interface ReportHighlight {
  subject: string
  from: string
  gist: string
  priority: 'high' | 'medium' | 'low'
}

export interface ReportActionItem {
  text: string
  status: 'completed' | 'pending'
  source: string
}

export interface ReportUpcoming {
  text: string
  date: string | null
  source: string
}

export interface ReportEmailStats {
  total: number
  needs_reply: number
  urgent: number
  meeting_related: number
  newsletter: number
  subscription: number
  informational: number
}

export interface DailyReport {
  summary: string
  email_stats: ReportEmailStats
  highlights: ReportHighlight[]
  action_items: {
    completed: number
    pending: number
    items: ReportActionItem[]
  }
  upcoming: ReportUpcoming[]
  wrap_up: string
}

export interface NetworkGraphNode {
  id: string
  name: string
  email: string
  type: 'you' | 'person'
  email_count: number
  thread_count: number
  domain?: string
  description?: string
}

export interface NetworkGraphEdge {
  source: string
  target: string
  weight: number
}

export interface NetworkGraphResponse {
  status: string
  nodes: NetworkGraphNode[]
  edges: NetworkGraphEdge[]
  total_emails: number
}

export const api = {
  getAuthStatus: async (): Promise<AuthStatusResponse> => {
    return fetchAPI<AuthStatusResponse>('/auth/status')
  },

  startGoogleAuth: async (): Promise<AuthStartResponse> => {
    return fetchAPI<AuthStartResponse>('/auth/google/start', { method: 'POST' })
  },

  logout: async (): Promise<{ success: boolean }> => {
    return fetchAPI<{ success: boolean }>('/auth/logout', { method: 'POST' })
  },

  getRecentEmails: async (limit = 20): Promise<{ emails: CategorizedEmail[] }> => {
    return fetchAPI<{ emails: CategorizedEmail[] }>(`/emails/recent?limit=${limit}`)
  },

  getTLDR: async (): Promise<TLDRDigest> => {
    return fetchAPI<TLDRDigest>('/emails/tldr')
  },

  generateReply: async (messageId: string): Promise<{ generated: boolean; suggestion: ReplySuggestion }> => {
    return fetchAPI('/emails/reply', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, generate: true, to: '', subject: '' })
    })
  },

  sendReply: async (data: {
    message_id: string
    thread_id?: string
    to: string
    subject: string
    body: string
  }): Promise<{ sent: boolean; message_id: string }> => {
    return fetchAPI('/emails/reply', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  getSubscriptions: async (): Promise<{ subscriptions: Subscription[] }> => {
    return fetchAPI<{ subscriptions: Subscription[] }>('/subscriptions/')
  },

  createCalendarEvent: async (data: {
    summary: string
    start: string
    end: string
    description?: string
    location?: string
  }): Promise<CalendarEventResponse> => {
    return fetchAPI('/calendar/event', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  sendAgentCommand: async (command: string): Promise<AgentResponse> => {
    return fetchAPI<AgentResponse>('/agent/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    })
  },

  sendChat: async (message: string, conversationHistory?: ChatMessage[]): Promise<ChatResponse> => {
    return fetchAPI<ChatResponse>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_history: conversationHistory })
    })
  },

  sendVoiceCommand: async (audioBlob: Blob): Promise<AgentResponse> => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.wav')
    const response = await fetch(`${API_URL}/agent/voice`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    return response.json()
  },

  sendVoiceChatCommand: async (audioBlob: Blob): Promise<VoiceChatResponse> => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.wav')
    const response = await fetch(`${API_URL}/agent/voice-chat`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    return response.json()
  },

  getTodos: async (): Promise<TodoResponse[]> => {
    return fetchAPI<TodoResponse[]>('/todos/')
  },

  generateTodos: async (): Promise<TodoResponse[]> => {
    return fetchAPI<TodoResponse[]>('/todos/generate', { method: 'POST' })
  },

  updateTodo: async (todoId: string, data: { completed?: boolean; text?: string }): Promise<TodoResponse> => {
    return fetchAPI<TodoResponse>(`/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  deleteTodo: async (todoId: string): Promise<{ deleted: boolean }> => {
    return fetchAPI<{ deleted: boolean }>(`/todos/${todoId}`, { method: 'DELETE' })
  },

  deleteAccount: async (): Promise<{ deleted: boolean }> => {
    return fetchAPI<{ deleted: boolean }>('/v1/me', { method: 'DELETE' })
  },

  getDailyReport: async (regenerate = false): Promise<DailyReport> => {
    const query = regenerate ? '?regenerate=true' : ''
    return fetchAPI<DailyReport>(`/reports/daily${query}`)
  },

  getNetworkGraph: async (): Promise<NetworkGraphResponse> => {
    return fetchAPI<NetworkGraphResponse>('/network/graph')
  },

}
