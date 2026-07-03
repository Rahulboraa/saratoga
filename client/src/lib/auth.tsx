import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: (message?: string) => void
  logoutMessage: string
}

const AuthContext = createContext<AuthState>(null as never)

const IDLE_MS = 10 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [logoutMessage, setLogoutMessage] = useState('')
  const queryClient = useQueryClient()
  const userRef = useRef<AuthUser | null>(null)
  userRef.current = user

  const logout = useCallback((message = '') => {
    setToken(null)
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

  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => logout('You were signed out after 10 minutes of inactivity.'), IDLE_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => document.removeEventListener(e, reset))
    }
  }, [user, logout])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, logoutMessage }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
