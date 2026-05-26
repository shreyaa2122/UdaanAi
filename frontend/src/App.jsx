// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage     from './pages/ChatPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: 'rgba(10,22,40,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#eef2ff',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#56cfbf', secondary: '#050d1a' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#050d1a' } },
        }} />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/chat"     element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/"         element={<Navigate to="/chat" replace />} />
          <Route path="*"         element={<Navigate to="/chat" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
