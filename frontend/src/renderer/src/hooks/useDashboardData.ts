import { useState, useEffect } from 'react'
import {
  api,
  type WrappedResponse,
  type TopEntitiesResponse
} from '../lib/api'

interface UseDashboardDataReturn {
  wrapped: WrappedResponse | null
  topEntities: TopEntitiesResponse | null
  topOrgs: TopEntitiesResponse | null
  isLoading: boolean
  error: string | null
}

export function useDashboardData(): UseDashboardDataReturn {
  const [wrapped, setWrapped] = useState<WrappedResponse | null>(null)
  const [topEntities, setTopEntities] = useState<TopEntitiesResponse | null>(null)
  const [topOrgs, setTopOrgs] = useState<TopEntitiesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData(): Promise<void> {
      try {
        const [wrappedData, entitiesData, orgsData] = await Promise.all([
          api.getWrapped(),
          api.getTopEntities(),
          api.getTopOrganizations()
        ])
        if (cancelled) return
        setWrapped(wrappedData)
        setTopEntities(entitiesData)
        setTopOrgs(orgsData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  return { wrapped, topEntities, topOrgs, isLoading, error }
}
