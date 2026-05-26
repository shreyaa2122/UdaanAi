// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const Ctx = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      authAPI.getMe()
        .then(({ data }) => setUser(data.user))
        .catch(() => localStorage.removeItem('accessToken'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password })
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
    toast.success(`Welcome aboard, ${data.user.name}! 🎓`)
    return data
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
    toast.success(`Welcome back, ${data.user.name}!`)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch (_) {}
    localStorage.removeItem('accessToken')
    setUser(null)
    toast.success('Logged out')
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await authAPI.getMe()
    setUser(data.user)
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, register, login, logout, refreshUser, setUser }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
