// src/components/layout/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: 'var(--bg)' }}>
        <div className="text-5xl animate-float">🧭</div>
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="typing-dot" style={{ animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Loading UdaanAI...</p>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}
