import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
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

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<Property[]>('/properties'),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const stored = getActiveProperty() || null
  // A non-admin is pinned to their own property no matter what is in storage.
  const activeId = user && user.role !== 'admin' ? user.propertyId : stored

  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') {
      if (getActiveProperty() !== (user.propertyId ?? '')) setActiveProperty(user.propertyId)
      return
    }
    // Drop a stored property that has since been deleted, so the app doesn't 404 on every call.
    if (stored && properties.length && !properties.some((p) => p.id === stored)) {
      setActiveProperty(null)
      queryClient.clear()
    }
  }, [user, stored, properties, queryClient])

  const setActive = useCallback((id: string | null) => {
    setActiveProperty(id)
    // Every cached list belongs to the property it was fetched under — start clean.
    queryClient.clear()
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
