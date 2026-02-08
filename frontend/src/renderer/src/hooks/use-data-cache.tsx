import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, type CategorizedEmail, type DailyReport, type Subscription, type TLDRDigest, type TodoResponse } from '../lib/api'

interface CachedDataState {
  emails: CategorizedEmail[]
  subscriptions: Subscription[]
  todos: TodoResponse[]
  digest: TLDRDigest | null
  report: DailyReport | null
  isEmailsLoading: boolean
  isSubscriptionsLoading: boolean
  isTodosLoading: boolean
  isDigestLoading: boolean
  isReportLoading: boolean
  emailsError: string | null
  subscriptionsError: string | null
  todosError: string | null
  digestError: string | null
  reportError: string | null
  refreshEmails: () => Promise<void>
  refreshSubscriptions: () => Promise<void>
  refreshTodos: () => Promise<void>
  refreshDigest: () => Promise<void>
  refreshReport: () => Promise<void>
  regenerateReport: () => Promise<void>
}

interface DataCacheProviderProps {
  children: React.ReactNode
}

const DataCacheContext = createContext<CachedDataState | null>(null)

const POLLING_INTERVAL_MILLISECONDS = 60_000

const STORAGE_KEY_EMAILS = 'saturdai-cache-emails'
const STORAGE_KEY_SUBSCRIPTIONS = 'saturdai-cache-subscriptions'
const STORAGE_KEY_TODOS = 'saturdai-cache-todos'
const STORAGE_KEY_DIGEST = 'saturdai-cache-digest'
const STORAGE_KEY_REPORT = 'saturdai-cache-report'

const readLocalCache = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const writeLocalCache = <T,>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // storage full or unavailable
  }
}

const notifyChange = (title: string, body: string): void => {
  toast.info(body)
  window.api.showNotification(title, body)
}

const DataCacheProvider = ({ children }: DataCacheProviderProps) => {
  const localCacheRef = useRef(() => {
    const cachedEmails = readLocalCache<CategorizedEmail[]>(STORAGE_KEY_EMAILS) ?? []
    const cachedSubscriptions = readLocalCache<Subscription[]>(STORAGE_KEY_SUBSCRIPTIONS) ?? []
    const cachedTodos = readLocalCache<TodoResponse[]>(STORAGE_KEY_TODOS) ?? []
    const cachedDigest = readLocalCache<TLDRDigest>(STORAGE_KEY_DIGEST)
    const cachedReport = readLocalCache<DailyReport>(STORAGE_KEY_REPORT)
    return { cachedEmails, cachedSubscriptions, cachedTodos, cachedDigest, cachedReport }
  })

  const initialCache = useRef(localCacheRef.current())
  const { cachedEmails, cachedSubscriptions, cachedTodos, cachedDigest, cachedReport } = initialCache.current

  const hadLocalEmailsRef = useRef(cachedEmails.length > 0)
  const hadLocalSubscriptionsRef = useRef(cachedSubscriptions.length > 0)
  const hadLocalTodosRef = useRef(cachedTodos.length > 0)
  const hadLocalDigestRef = useRef(cachedDigest !== null)

  const [emails, setEmails] = useState<CategorizedEmail[]>(cachedEmails)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(cachedSubscriptions)
  const [todos, setTodos] = useState<TodoResponse[]>(cachedTodos)
  const [digest, setDigest] = useState<TLDRDigest | null>(cachedDigest)
  const [report, setReport] = useState<DailyReport | null>(cachedReport)

  const [isEmailsLoading, setIsEmailsLoading] = useState(!hadLocalEmailsRef.current)
  const [isSubscriptionsLoading, setIsSubscriptionsLoading] = useState(!hadLocalSubscriptionsRef.current)
  const [isTodosLoading, setIsTodosLoading] = useState(!hadLocalTodosRef.current)
  const [isDigestLoading, setIsDigestLoading] = useState(!hadLocalDigestRef.current)
  const [isReportLoading, setIsReportLoading] = useState(false)

  const [emailsError, setEmailsError] = useState<string | null>(null)
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null)
  const [todosError, setTodosError] = useState<string | null>(null)
  const [digestError, setDigestError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const previousEmailIdsRef = useRef<Set<string>>(
    new Set(cachedEmails.map((email) => email.message_id))
  )
  const previousSubscriptionNamesRef = useRef<Set<string>>(
    new Set(cachedSubscriptions.map((subscription) => subscription.service_name))
  )
  const previousTodoIdsRef = useRef<Set<string>>(
    new Set(cachedTodos.map((todo) => todo.id))
  )
  const hasCompletedInitialLoadRef = useRef(false)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchEmails = useCallback(async (isBackgroundPoll: boolean) => {
    if (!isBackgroundPoll) {
      setIsEmailsLoading(true)
      setEmailsError(null)
    }
    try {
      const data = await api.getRecentEmails(30)
      const freshEmails = data.emails

      if (isBackgroundPoll && hasCompletedInitialLoadRef.current) {
        const freshEmailIds = new Set(freshEmails.map((email) => email.message_id))
        const newEmailCount = [...freshEmailIds].filter(
          (emailId) => !previousEmailIdsRef.current.has(emailId)
        ).length
        if (newEmailCount > 0) {
          const emailMessage = `${newEmailCount} new email${newEmailCount > 1 ? 's' : ''} received`
          notifyChange('SaturdAI', emailMessage)
        }
      }

      previousEmailIdsRef.current = new Set(freshEmails.map((email) => email.message_id))
      setEmails(freshEmails)
      writeLocalCache(STORAGE_KEY_EMAILS, freshEmails)
    } catch (fetchError) {
      if (!isBackgroundPoll) {
        setEmailsError(fetchError instanceof Error ? fetchError.message : 'Failed to load emails')
      }
    } finally {
      if (!isBackgroundPoll) {
        setIsEmailsLoading(false)
      }
    }
  }, [])

  const fetchSubscriptions = useCallback(async (isBackgroundPoll: boolean) => {
    if (!isBackgroundPoll) {
      setIsSubscriptionsLoading(true)
      setSubscriptionsError(null)
    }
    try {
      const data = await api.getSubscriptions()
      const freshSubscriptions = data.subscriptions

      if (isBackgroundPoll && hasCompletedInitialLoadRef.current) {
        const freshNames = new Set(freshSubscriptions.map((subscription) => subscription.service_name))
        const newSubscriptionCount = [...freshNames].filter(
          (name) => !previousSubscriptionNamesRef.current.has(name)
        ).length
        if (newSubscriptionCount > 0) {
          const subscriptionMessage = `${newSubscriptionCount} new subscription${newSubscriptionCount > 1 ? 's' : ''} detected`
          notifyChange('SaturdAI', subscriptionMessage)
        }
      }

      previousSubscriptionNamesRef.current = new Set(
        freshSubscriptions.map((subscription) => subscription.service_name)
      )
      setSubscriptions(freshSubscriptions)
      writeLocalCache(STORAGE_KEY_SUBSCRIPTIONS, freshSubscriptions)
    } catch (fetchError) {
      if (!isBackgroundPoll) {
        setSubscriptionsError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load subscriptions'
        )
      }
    } finally {
      if (!isBackgroundPoll) {
        setIsSubscriptionsLoading(false)
      }
    }
  }, [])

  const fetchTodos = useCallback(async (isBackgroundPoll: boolean) => {
    if (!isBackgroundPoll) {
      setIsTodosLoading(true)
      setTodosError(null)
    }
    try {
      const freshTodos = await api.getTodos()

      if (isBackgroundPoll && hasCompletedInitialLoadRef.current) {
        const freshTodoIds = new Set(freshTodos.map((todo) => todo.id))
        const newTodoCount = [...freshTodoIds].filter(
          (todoId) => !previousTodoIdsRef.current.has(todoId)
        ).length
        if (newTodoCount > 0) {
          const todoMessage = `${newTodoCount} new task${newTodoCount > 1 ? 's' : ''} added`
          notifyChange('SaturdAI', todoMessage)
        }
      }

      previousTodoIdsRef.current = new Set(freshTodos.map((todo) => todo.id))
      setTodos(freshTodos)
      writeLocalCache(STORAGE_KEY_TODOS, freshTodos)
    } catch (fetchError) {
      if (!isBackgroundPoll) {
        setTodosError(fetchError instanceof Error ? fetchError.message : 'Failed to load todos')
      }
    } finally {
      if (!isBackgroundPoll) {
        setIsTodosLoading(false)
      }
    }
  }, [])

  const fetchDigest = useCallback(async (isBackgroundPoll: boolean) => {
    if (!isBackgroundPoll) {
      setIsDigestLoading(true)
      setDigestError(null)
    }
    try {
      const freshDigest = await api.getTLDR()
      setDigest(freshDigest)
      writeLocalCache(STORAGE_KEY_DIGEST, freshDigest)
    } catch (fetchError) {
      if (!isBackgroundPoll) {
        setDigestError(fetchError instanceof Error ? fetchError.message : 'Failed to load digest')
      }
    } finally {
      if (!isBackgroundPoll) {
        setIsDigestLoading(false)
      }
    }
  }, [])

  const fetchReport = useCallback(async () => {
    setIsReportLoading(true)
    setReportError(null)
    try {
      const freshReport = await api.getDailyReport()
      setReport(freshReport)
      writeLocalCache(STORAGE_KEY_REPORT, freshReport)
    } catch (fetchError) {
      setReportError(fetchError instanceof Error ? fetchError.message : 'Failed to generate report')
    } finally {
      setIsReportLoading(false)
    }
  }, [])

  const pollAllData = useCallback(() => {
    fetchEmails(true)
    fetchSubscriptions(true)
    fetchTodos(true)
    fetchDigest(true)
  }, [fetchEmails, fetchSubscriptions, fetchTodos, fetchDigest])

  useEffect(() => {
    const initialLoad = async () => {
      await Promise.all([
        fetchEmails(hadLocalEmailsRef.current),
        fetchSubscriptions(hadLocalSubscriptionsRef.current),
        fetchTodos(hadLocalTodosRef.current),
        fetchDigest(hadLocalDigestRef.current),
      ])
      hasCompletedInitialLoadRef.current = true
    }
    initialLoad()
  }, [fetchEmails, fetchSubscriptions, fetchTodos, fetchDigest])

  useEffect(() => {
    const startPolling = () => {
      if (pollingIntervalRef.current) return
      pollingIntervalRef.current = setInterval(pollAllData, POLLING_INTERVAL_MILLISECONDS)
    }

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollAllData()
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    startPolling()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopPolling()
    }
  }, [pollAllData])

  const refreshEmails = useCallback(() => fetchEmails(false), [fetchEmails])
  const refreshSubscriptions = useCallback(() => fetchSubscriptions(false), [fetchSubscriptions])
  const refreshTodos = useCallback(() => fetchTodos(false), [fetchTodos])
  const refreshDigest = useCallback(() => fetchDigest(false), [fetchDigest])
  const refreshReport = useCallback(() => fetchReport(), [fetchReport])

  const regenerateReport = useCallback(async () => {
    setIsReportLoading(true)
    setReportError(null)
    try {
      const freshReport = await api.getDailyReport(true)
      setReport(freshReport)
      writeLocalCache(STORAGE_KEY_REPORT, freshReport)
    } catch (fetchError) {
      setReportError(fetchError instanceof Error ? fetchError.message : 'Failed to generate report')
    } finally {
      setIsReportLoading(false)
    }
  }, [])

  return (
    <DataCacheContext.Provider
      value={{
        emails,
        subscriptions,
        todos,
        digest,
        report,
        isEmailsLoading,
        isSubscriptionsLoading,
        isTodosLoading,
        isDigestLoading,
        isReportLoading,
        emailsError,
        subscriptionsError,
        todosError,
        digestError,
        reportError,
        refreshEmails,
        refreshSubscriptions,
        refreshTodos,
        refreshDigest,
        refreshReport,
        regenerateReport,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  )
}

const useDataCache = (): CachedDataState => {
  const context = useContext(DataCacheContext)
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider')
  }
  return context
}

export { DataCacheProvider, useDataCache }
