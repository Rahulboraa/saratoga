import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken, setActiveProperty, setUnauthorizedHandler } from './api'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: (message?: string) => void
  logoutMessage: string
}

const AuthContext = createContext<AuthState>(null as never)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [logoutMessage, setLogoutMessage] = useState('')
  const queryClient = useQueryClient()
  const userRef = useRef<AuthUser | null>(null)
  userRef.current = user

  const logout = useCallback((message = '') => {
    setToken(null)
    // The next person to sign in here gets their own property, not the last one's.
    setActiveProperty(null)
    setUser(null)
    setLogoutMessage(message)
    queryClient.clear()
  }, [queryClient])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string; user: AuthUser }>('/auth/login', { body: { username, password } })
    setToken(res.token)
    setUser(res.user)
    setLogoutMessage('')
    return res.user
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) logout('Session expired. Please sign in again.')
    })
  }, [logout])

  useEffect(() => {
    if (!getToken()) return
    api<{ user: AuthUser }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, logoutMessage }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
