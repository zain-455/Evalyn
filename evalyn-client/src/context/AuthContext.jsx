import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { setAccessToken, clearAccessToken } from '../services/authTokenStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = () => {
      clearAccessToken()
      setUser(null)
    }
    window.addEventListener('evalyn:authExpired', handler)
    return () => window.removeEventListener('evalyn:authExpired', handler)
  }, [])

  useEffect(() => {
    // One-time cleanup from legacy localStorage auth
    try {
      localStorage.removeItem('evalyn_user')
      localStorage.removeItem('evalyn_token')
    } catch {
      // ignore
    }

    let cancelled = false

    const restore = async () => {
      try {
        const res = await api.post('/api/auth/refresh')
        if (cancelled) return

        const { token, email, fullName, role, expiresAt } = res.data
        setAccessToken(token)
        setUser({ email, fullName, role, expiresAt })
      } catch {
        if (cancelled) return
        clearAccessToken()
        setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshSession = async () => {
    const res = await api.post('/api/auth/refresh')
    const { token, email, fullName, role, expiresAt } = res.data
    setAccessToken(token)
    setUser({ email, fullName, role, expiresAt })
    return res.data
  }

  // Proactive refresh shortly before expiry
  useEffect(() => {
    if (!user?.expiresAt) return

    const expiresAtMs = new Date(user.expiresAt).getTime()
    if (Number.isNaN(expiresAtMs)) return

    const now = Date.now()
    const msUntilRefresh = Math.max(0, expiresAtMs - now - 60_000)

    const timer = setTimeout(() => {
      refreshSession().catch(() => {
        logout()
      })
    }, msUntilRefresh)

    return () => clearTimeout(timer)
  }, [user?.expiresAt])

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { token, email: userEmail, fullName, role, expiresAt } = res.data
    setAccessToken(token)
    const userData = { email: userEmail, fullName, role, expiresAt }
    setUser(userData)
    return userData
  }

  const register = async (email, password, fullName, role, institution, identifier) => {
    const res = await api.post('/api/auth/register', { email, password, fullName, role, institution, identifier })
    const { token, email: userEmail, fullName: returnedName, role: returnedRole, expiresAt } = res.data
    setAccessToken(token)
    const userData = { email: userEmail, fullName: returnedName, role: returnedRole, expiresAt }
    setUser(userData)
    return userData
  }

  const logout = () => {
    api.post('/api/auth/logout').catch(() => {})
    clearAccessToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
