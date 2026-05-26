// src/services/api.js
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on TOKEN_EXPIRED
let refreshing = false
let waitQueue  = []

const drain = (err, token) => {
  waitQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)))
  waitQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !orig._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => waitQueue.push({ resolve, reject }))
          .then((token) => { orig.headers.Authorization = `Bearer ${token}`; return api(orig) })
      }
      orig._retry = true
      refreshing  = true
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        localStorage.setItem('accessToken', data.accessToken)
        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`
        drain(null, data.accessToken)
        orig.headers.Authorization = `Bearer ${data.accessToken}`
        return api(orig)
      } catch (e) {
        drain(e)
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register:      (d) => api.post('/auth/register', d),
  login:         (d) => api.post('/auth/login', d),
  logout:        ()  => api.post('/auth/logout'),
  getMe:         ()  => api.get('/auth/me'),
  updateProfile: (d) => api.patch('/auth/profile', d),
  refresh:       ()  => api.post('/auth/refresh'),
}

export const chatAPI = {
  createSession: ()   => api.post('/chat/session'),
  sendMessage:   (d)  => api.post('/chat/message', d),
  getSessions:   (p)  => api.get('/chat/sessions', { params: p }),
  getSession:    (id) => api.get(`/chat/session/${id}`),
  deleteSession: (id) => api.delete(`/chat/session/${id}`),
  getAnalytics:  ()   => api.get('/chat/analytics'),
}

export const uploadAPI = {
  upload:         (fd) => api.post('/upload/document', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }),
  getDocuments:   ()   => api.get('/upload/documents'),
  deleteDocuments: ()  => api.delete('/upload/documents'),
}

export default api
