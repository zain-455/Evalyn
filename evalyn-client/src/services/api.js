import axios from 'axios'
import { getAccessToken, setAccessToken, clearAccessToken } from './authTokenStore'

const baseURL = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
  baseURL, // Prefer VITE_API_URL; falls back to relative URLs for dev proxy
  withCredentials: true, // required for httpOnly refresh cookie
  headers: {
    'Content-Type': 'application/json'
  }
})

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

let refreshPromise = null

// Add request interceptor to attach JWT (in-memory)
api.interceptors.request.use(
  config => {
    const token = getAccessToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Add response interceptor for auth errors (refresh + retry once)
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient.post('/api/auth/refresh')
          .then(res => {
            const token = res.data?.token
            if (!token) throw new Error('Refresh did not return access token')
            setAccessToken(token)
            return token
          })
          .finally(() => {
            refreshPromise = null
          })
      }

      const newToken = await refreshPromise
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return api.request(originalRequest)
    } catch (refreshErr) {
      clearAccessToken()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('evalyn:authExpired'))
      }
      return Promise.reject(refreshErr)
    }
  }
)

export default api
