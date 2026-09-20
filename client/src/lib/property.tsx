import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getActiveProperty, setActiveProperty } from './api'
import { useAuth } from './auth'
import type { Property } from '@/types'

interface PropertyState {
  properties: Property[]
  /** null means "all properties" — only an admin ever sees that. */
  activeId: string | null
  active: Property | null
  canSwitch: boolean
  setActive: (id: string | null) => void
}

const PropertyContext = createContext<PropertyState>(null as never)

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // Held in state, not read from storage during render: the switcher is a controlled
  // select, so without a re-render it would snap straight back to its old value.
  const [chosen, setChosen] = useState<string | null>(() => getActiveProperty() || null)

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<Property[]>('/properties'),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  // A non-admin is pinned to their own property no matter what is in storage.
  const activeId = user && user.role !== 'admin' ? user.propertyId : chosen

  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') {
      if (getActiveProperty() !== (user.propertyId ?? '')) setActiveProperty(user.propertyId)
      return
    }
    // Drop a stored property that has since been deleted, so calls don't 404 on every page.
    if (chosen && properties.length && !properties.some((p) => p.id === chosen)) {
      setActiveProperty(null)
      setChosen(null)
    }
  }, [user, chosen, properties])

  const setActive = useCallback((id: string | null) => {
    // Storage first: the next refetch reads it for the x-property header.
    setActiveProperty(id)
    setChosen(id)
    // Cached lists belong to the property they were fetched under, so drop them —
    // but keep the property list itself, which the switcher is rendered from.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'properties' })
  }, [queryClient])

  const value = useMemo<PropertyState>(() => ({
    properties,
    activeId,
    active: properties.find((p) => p.id === activeId) ?? null,
    canSwitch: user?.role === 'admin',
    setActive,
  }), [properties, activeId, user, setActive])

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
}

export function useProperty() {
  return useContext(PropertyContext)
}
