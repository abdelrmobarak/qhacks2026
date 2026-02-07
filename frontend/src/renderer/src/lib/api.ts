const API_URL = 'http://localhost:8000'

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

// Auth types
export interface AuthStatusResponse {
  authenticated: boolean
  user?: {
    id: string
    email: string
    name: string
  }
  snapshot_status?: string
}

export interface AuthStartResponse {
  auth_url: string
}

// Snapshot types
export interface SnapshotStatusResponse {
  status: string
  stage?: string
  progress?: {
    emails_seen?: number
    events_seen?: number
    threads_seen?: number
    artifacts_written?: number
    preflight_emails?: number
    preflight_events?: number
    preflight_passed?: number
  }
  failure_reason?: string
  created_at?: string
  completed_at?: string
  expires_at?: string
}

// Wrapped types
export interface WrappedMetrics {
  total_meetings: number
  total_meeting_hours: number
  avg_meetings_per_week: number
  avg_meeting_hours_per_week: number
  focus_hours_per_week: number
  meeting_cost_estimate: number
  total_emails: number
  emails_per_week: number
  meeting_heatmap: Record<string, number>
  snapshot_window_days: number
}

export interface WrappedResponse {
  status: string
  metrics?: WrappedMetrics
}

// CRM types
export interface TopEntity {
  id: string
  name: string
  email?: string
  domain?: string
  score: number
  meeting_count: number
  email_count: number
  total_meeting_minutes: number
  contact_count?: number
  story_available: boolean
  story_locked: boolean
}

export interface TopEntitiesResponse {
  status: string
  entities: TopEntity[]
}

export interface StoryClaim {
  text: string
  evidence_ids: string[]
}

export interface StoryTimelineEntry {
  date: string
  description: string
  evidence_ids: string[]
}

export interface StoryResponse {
  status: string
  entity_id?: string
  entity_name?: string
  title?: string
  summary?: string
  claims: StoryClaim[]
  timeline: StoryTimelineEntry[]
  themes: string[]
  locked: boolean
  error?: string
}

// API functions
export const api = {
  async getAuthStatus(): Promise<AuthStatusResponse> {
    return fetchAPI<AuthStatusResponse>('/auth/status')
  },

  async startGoogleAuth(): Promise<AuthStartResponse> {
    return fetchAPI<AuthStartResponse>('/auth/google/start', { method: 'POST' })
  },

  async logout(): Promise<{ success: boolean }> {
    return fetchAPI<{ success: boolean }>('/auth/logout', { method: 'POST' })
  },

  async getSnapshotStatus(): Promise<SnapshotStatusResponse> {
    return fetchAPI<SnapshotStatusResponse>('/snapshot/status')
  },

  async getWrapped(): Promise<WrappedResponse> {
    return fetchAPI<WrappedResponse>('/wrapped')
  },

  async getTopEntities(): Promise<TopEntitiesResponse> {
    return fetchAPI<TopEntitiesResponse>('/crm/top')
  },

  async getTopOrganizations(): Promise<TopEntitiesResponse> {
    return fetchAPI<TopEntitiesResponse>('/crm/top-orgs')
  },

  async getStory(entityId: string): Promise<StoryResponse> {
    return fetchAPI<StoryResponse>(`/crm/story/${entityId}`)
  }
}
