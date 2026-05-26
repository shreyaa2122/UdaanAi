// src/pages/RegisterPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowRight, Loader2, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STREAMS = ['PCM', 'PCB', 'PCMB', 'Commerce', 'Arts', 'Other']
const EXAMS   = ['JEE', 'NEET', 'CUET', 'VITEEE', 'BITSAT', 'COMEDK', 'GATE', 'IPMAT', 'CLAT', 'NIFT', 'NATA', 'NDA', 'CA', 'Other']
const MOODS   = [
  { emoji: '😰', label: 'Very stressed', value: 'very_stressed' },
  { emoji: '😕', label: 'Confused',      value: 'confused'      },
  { emoji: '😐', label: 'Okay',          value: 'okay'          },
  { emoji: '😊', label: 'Hopeful',       value: 'hopeful'       },
]

export default function RegisterPage() {
  const { register, refreshUser } = useAuth()
  const navigate        = useNavigate()
  const [step, setStep] = useState(1) // 1 = account, 2 = profile
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    stream: '', targetExam: '', boardPercentage: '', category: '', preferredLocation: '', preferredCollege: '', preferredBranch: '', mood: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onStep1 = (e) => {
    e.preventDefault()
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (!/\d/.test(form.password))  { toast.error('Password must contain a number');          return }
    setStep(2)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await register(form.name, form.email, form.password)
      // Update profile in background (non-blocking for UX)
      if (form.stream || form.targetExam || form.boardPercentage || form.category || form.preferredLocation || form.preferredCollege || form.preferredBranch) {
        // profile update via authAPI already imported at top
        await authAPI.updateProfile({
          profile: {
            stream:          form.stream,
            targetExam:      form.targetExam,
            boardPercentage: form.boardPercentage ? Number(form.boardPercentage) : undefined,
            category:        form.category,
            preferredLocation: form.preferredLocation,
            preferredCollege:  form.preferredCollege,
            preferredBranch:   form.preferredBranch,
          },
        }).then(() => refreshUser()).catch(() => {})
      }
      navigate('/chat')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
      setStep(1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />
      <div className="grid-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 relative z-10">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)' }}>🧭</div>
          <span className="font-display font-bold text-lg">PathfinderAI</span>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: s <= step ? '#7c5cfc' : 'var(--glass2)' }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text)' }}>Create your account</h2>
              <p className="text-sm mb-7" style={{ color: 'var(--text2)' }}>
                Already have one?{' '}
                <Link to="/login" style={{ color: '#7c5cfc' }} className="font-medium hover:underline">Sign in</Link>
              </p>

              <form onSubmit={onStep1} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Full Name</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Your name" required className="input-glass" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@email.com" required className="input-glass" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Password</label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="Min 6 chars with a number" required className="input-glass pr-11" />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center mt-2">
                  Continue <ArrowRight size={16} />
                </button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs mb-5" style={{ color: 'var(--text3)' }}>
                <ChevronLeft size={14} /> Back
              </button>
              <h2 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--text)' }}>Tell us about yourself</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--text2)' }}>
                Helps AI personalize your guidance. You can skip and update later.
              </p>

              <form onSubmit={onSubmit} className="space-y-5">
                {/* Stream */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>Your Stream</label>
                  <div className="flex flex-wrap gap-2">
                    {STREAMS.map(s => (
                      <button type="button" key={s} onClick={() => set('stream', s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: form.stream === s ? 'rgba(124,92,252,0.3)' : 'var(--glass)',
                          border:     `1px solid ${form.stream === s ? 'rgba(124,92,252,0.6)' : 'var(--border)'}`,
                          color:      form.stream === s ? '#c4b5fd' : 'var(--text2)',
                        }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Target exam */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>Target Exam (if decided)</label>
                  <div className="flex flex-wrap gap-2">
                    {EXAMS.map(ex => (
                      <button type="button" key={ex} onClick={() => set('targetExam', ex)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: form.targetExam === ex ? 'rgba(86,207,191,0.2)' : 'var(--glass)',
                          border:     `1px solid ${form.targetExam === ex ? 'rgba(86,207,191,0.5)' : 'var(--border)'}`,
                          color:      form.targetExam === ex ? '#56cfbf' : 'var(--text2)',
                        }}>{ex}</button>
                    ))}
                  </div>
                </div>

                {/* Board % */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>Board Percentage (optional)</label>
                  <input type="number" min="0" max="100" value={form.boardPercentage}
                    onChange={e => set('boardPercentage', e.target.value)}
                    placeholder="e.g. 82" className="input-glass" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={form.category} onChange={e => set('category', e.target.value)}
                    placeholder="Category, e.g. General" className="input-glass" />
                  <input value={form.preferredLocation} onChange={e => set('preferredLocation', e.target.value)}
                    placeholder="Home state / location" className="input-glass" />
                  <input value={form.preferredBranch} onChange={e => set('preferredBranch', e.target.value)}
                    placeholder="Preferred branch/course" className="input-glass" />
                  <input value={form.preferredCollege} onChange={e => set('preferredCollege', e.target.value)}
                    placeholder="Preferred college if any" className="input-glass" />
                </div>

                {/* Mood */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>How are you feeling right now?</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MOODS.map(m => (
                      <button type="button" key={m.value} onClick={() => set('mood', m.value)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-all"
                        style={{
                          background: form.mood === m.value ? 'rgba(124,92,252,0.2)' : 'var(--glass)',
                          border:     `1px solid ${form.mood === m.value ? 'rgba(124,92,252,0.5)' : 'var(--border)'}`,
                          color:      'var(--text2)',
                        }}>
                        <span className="text-xl">{m.emoji}</span>
                        <span style={{ fontSize: 10 }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
                  {busy
                    ? <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                    : <>Start Exploring <ArrowRight size={16} /></>}
                </button>

                <button type="button" onClick={onSubmit} disabled={busy}
                  className="w-full text-xs py-2" style={{ color: 'var(--text3)' }}>
                  Skip profile setup for now →
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
