// src/pages/LoginPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowRight, Loader2, Compass, Brain, BookOpen, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

const FEATURES = [
  { icon: <Brain size={16} />, label: 'RAG-powered — answers grounded in real 2024 data' },
  { icon: <BookOpen size={16} />, label: 'Upload your marksheet for personalized advice' },
  { icon: <Shield size={16} />, label: 'Private & secure — your data stays yours' },
]

export default function LoginPage() {
  const { login }       = useAuth()
  const navigate        = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await login(form.email, form.password)
      navigate('/chat')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Orbs */}
      <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />
      <div className="grid-overlay" />

      {/* Left panel — hero */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)' }}>🧭</div>
          <span className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>PathfinderAI</span>
        </div>

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="font-display font-bold text-5xl leading-tight mb-6 grad-text">
            Your post-12th<br />career clarity<br />starts here.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base mb-10 leading-relaxed" style={{ color: 'var(--text2)', maxWidth: 420 }}>
            Confused about stream choices, entrance exams, or feeling overwhelmed by pressure?
            Get honest, grounded, personalized guidance — powered by real 2024 data.
          </motion.p>

          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(124,92,252,0.15)', color: '#7c5cfc' }}>{f.icon}</div>
                <p style={{ color: 'var(--text2)', fontSize: 14 }}>{f.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--text3)', fontSize: 12 }}>
          Used by 15,000+ students navigating post-12th decisions
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="glass-card w-full max-w-md p-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)' }}>🧭</div>
            <span className="font-display font-bold text-lg">PathfinderAI</span>
          </div>

          <h2 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text)' }}>
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text2)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#7c5cfc' }} className="font-medium hover:underline">
              Sign up free
            </Link>
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Email</label>
              <input name="email" type="email" value={form.email} onChange={onChange}
                placeholder="you@email.com" required className="input-glass" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Password</label>
              <div className="relative">
                <input name="password" type={show ? 'text' : 'password'}
                  value={form.password} onChange={onChange}
                  placeholder="Your password" required className="input-glass pr-11" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text3)' }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full justify-center mt-2">
              {busy
                ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-6 p-3 rounded-xl text-xs" style={{ background: 'rgba(86,207,191,0.08)', border: '1px solid rgba(86,207,191,0.2)', color: 'var(--text2)' }}>
            💡 New here? Create an account — it's free and takes 30 seconds.
          </div>
        </motion.div>
      </div>
    </div>
  )
}
