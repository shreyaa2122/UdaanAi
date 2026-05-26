// src/pages/ChatPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { chatAPI, uploadAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  Send, Plus, Trash2, MessageSquare, BarChart2, Upload,
  LogOut, Loader2, Database, Brain, Heart, Compass,
  ChevronRight, Sparkles, X, Menu
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import UploadPanel from '../components/upload/UploadPanel'
import AnalyticsDashboard from '../components/dashboard/AnalyticsDashboard'

const QUICK_PROMPTS = [
  { icon: '⚙️', text: 'JEE Main rank 40,000, General, West Bengal - CSE/ECE colleges?' },
  { icon: '🏥', text: 'NEET score vs BSc Nursing/BPT - which has better long-term scope?' },
  { icon: '💙', text: "I'm stressed about my future. Please help me make a plan." },
  { icon: '📊', text: 'CUET/IPMAT/Commerce - which path fits me after Class 12?' },
  { icon: '🎯', text: 'CSE vs ECE vs Mechanical - how should I choose based on interest?' },
  { icon: '🧭', text: 'BITSAT/VITEEE/COMEDK options - ask me what details you need.' },
]

const MOTIVATIONAL_HEADER = [
  "Every expert was once confused too. 💙",
  "Your marks don't define your ceiling. 🚀",
  "You're asking the right questions. That's the start.",
  "There's no single door to a good life — hundreds of them.",
  "The confusion you feel today is wisdom forming.",
]

export default function ChatPage() {
  const { user, logout }            = useAuth()
  const navigate                    = useNavigate()
  const [sessions, setSessions]     = useState([])
  const [sessionId, setSessionId]   = useState(null)
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [panel, setPanel]           = useState('chat')
  const [loadingSess, setLS]        = useState(false)
  const [sidebarOpen, setSidebar]   = useState(true)
  const [motiveLine]                = useState(() => MOTIVATIONAL_HEADER[Math.floor(Math.random() * MOTIVATIONAL_HEADER.length)])
  const [stressMode, setStressMode] = useState(false)
  const endRef                      = useRef(null)
  const textareaRef                 = useRef(null)

  useEffect(() => {
    chatAPI.getSessions().then(({ data }) => setSessions(data.conversations)).catch(() => {})
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  const resize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const reloadSessions = async () => {
    const { data } = await chatAPI.getSessions()
    setSessions(data.conversations)
  }

  const startNew = useCallback(async () => {
    setLS(true)
    try {
      const { data } = await chatAPI.createSession()
      setSessionId(data.sessionId)
      setMessages([])
      setStressMode(false)
      await reloadSessions()
    } catch { toast.error('Could not start session') }
    finally { setLS(false) }
  }, [])

  const loadSession = useCallback(async (sid) => {
    setLS(true)
    try {
      const { data } = await chatAPI.getSession(sid)
      setSessionId(sid)
      setMessages(data.conversation.messages)
      // check if last messages had stress
      const lastFew = data.conversation.messages.slice(-4)
      setStressMode(lastFew.some(m => m.stressDetected))
    } catch { toast.error('Failed to load session') }
    finally { setLS(false) }
  }, [])

  const deleteSession = useCallback(async (sid, e) => {
    e.stopPropagation()
    await chatAPI.deleteSession(sid)
    setSessions(p => p.filter(s => s.sessionId !== sid))
    if (sessionId === sid) { setSessionId(null); setMessages([]) }
  }, [sessionId])

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || sending) return

    let sid = sessionId
    if (!sid) {
      const { data } = await chatAPI.createSession()
      sid = data.sessionId
      setSessionId(sid)
    }

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMsg = { role: 'user', content: msg, _id: Date.now() + 'u' }
    setMessages(p => [...p, userMsg])
    setSending(true)

    try {
      const { data } = await chatAPI.sendMessage({ message: msg, sessionId: sid })
      if (data.stressDetected) setStressMode(true)

      const aiMsg = {
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        stressDetected: data.stressDetected,
        ragUsed: data.ragUsed,
        _id: Date.now() + 'a',
      }
      setMessages(p => [...p, aiMsg])
      await reloadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message')
      setMessages(p => p.slice(0, -1))
    } finally {
      setSending(false)
    }
  }, [input, sessionId, sending])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const doLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="h-screen flex overflow-hidden relative" style={{ background: 'var(--bg)' }}>
      <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />
      <div className="grid-overlay" />

      {/* ═══ SIDEBAR ═══ */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-20 flex flex-col shrink-0 w-64"
            style={{ background: 'rgba(5,13,26,0.85)', borderRight: '1px solid var(--border)', backdropFilter: 'blur(24px)' }}>

            {/* Logo */}
            <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)' }}>🧭</div>
              <div>
                <p className="font-display font-bold text-sm" style={{ color: 'var(--text)' }}>PathfinderAI</p>
                <p style={{ color: 'var(--text3)', fontSize: 10 }}>Career Guidance</p>
              </div>
              <button onClick={() => setSidebar(false)} className="ml-auto" style={{ color: 'var(--text3)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Nav tabs */}
            <div className="flex gap-1 p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              {[
                { id: 'chat',      icon: <MessageSquare size={13} />, label: 'Chat'     },
                { id: 'upload',    icon: <Upload size={13} />,        label: 'Upload'   },
                { id: 'analytics', icon: <BarChart2 size={13} />,     label: 'Stats'    },
              ].map(tab => (
                <button key={tab.id} onClick={() => setPanel(tab.id)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs transition-all"
                  style={{
                    background: panel === tab.id ? 'rgba(124,92,252,0.2)' : 'transparent',
                    border: `1px solid ${panel === tab.id ? 'rgba(124,92,252,0.4)' : 'transparent'}`,
                    color: panel === tab.id ? '#c4b5fd' : 'var(--text3)',
                  }}>
                  {tab.icon}<span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Motivational quote */}
            {stressMode && (
              <div className="mx-3 mt-3 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(248,168,75,0.08)', border: '1px solid rgba(248,168,75,0.2)', color: '#f8a84b' }}>
                <Heart size={12} className="inline mr-1" />
                You're doing the right thing by seeking guidance. One step at a time. 💙
              </div>
            )}

            {/* New chat button */}
            {panel === 'chat' && (
              <div className="p-3">
                <button onClick={startNew} disabled={loadingSess} className="btn-primary w-full justify-center text-xs py-2.5">
                  {loadingSess ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  New Conversation
                </button>
              </div>
            )}

            {/* Session list */}
            {panel === 'chat' && (
              <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
                <p className="text-xs px-1 py-2 uppercase tracking-wider font-medium" style={{ color: 'var(--text3)' }}>
                  History
                </p>
                {sessions.length === 0 && (
                  <div className="text-center py-8">
                    <Compass size={20} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
                    <p style={{ color: 'var(--text3)', fontSize: 12 }}>No conversations yet</p>
                  </div>
                )}
                {sessions.map(s => (
                  <button key={s.sessionId} onClick={() => loadSession(s.sessionId)}
                    className="w-full text-left px-3 py-2.5 rounded-xl group flex items-start gap-2 transition-all"
                    style={{
                      background: sessionId === s.sessionId ? 'rgba(124,92,252,0.18)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${sessionId === s.sessionId ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.04)'}`,
                    }}>
                    <MessageSquare size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--text3)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text2)' }}>{s.title}</p>
                      <p style={{ color: 'var(--text3)', fontSize: 10 }}>
                        {s.messageCount} msgs · {formatDistanceToNow(new Date(s.lastMessageAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button onClick={e => deleteSession(s.sessionId, e)}
                      className="opacity-0 group-hover:opacity-100 shrink-0" style={{ color: 'var(--text3)' }}>
                      <Trash2 size={11} />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* User */}
            <div className="p-3 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'rgba(124,92,252,0.3)', border: '1px solid rgba(124,92,252,0.4)' }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{user?.name}</p>
                  <p style={{ color: 'var(--text3)', fontSize: 10 }}>{user?.profile?.stream || 'No stream set'}</p>
                </div>
                <button onClick={doLogout} style={{ color: 'var(--text3)' }} className="hover:text-white transition-colors">
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══ MAIN ═══ */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ background: 'rgba(5,13,26,0.7)', borderColor: 'var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebar(true)} style={{ color: 'var(--text3)' }}>
                <Menu size={18} />
              </button>
            )}
            <div>
              <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {panel === 'chat' ? (sessions.find(s => s.sessionId === sessionId)?.title || 'Career Guidance') :
                 panel === 'upload' ? 'Upload Marksheet' : 'Analytics'}
              </p>
              <p style={{ color: 'var(--text3)', fontSize: 11 }}>PathfinderAI — RAG · Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stressMode && panel === 'chat' && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(248,168,75,0.1)', border: '1px solid rgba(248,168,75,0.25)', color: '#f8a84b' }}>
                <Heart size={11} /> Support mode
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
              style={{ background: 'rgba(86,207,191,0.08)', border: '1px solid rgba(86,207,191,0.2)', color: '#56cfbf' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              AI Online
            </div>
          </div>
        </div>

        {panel === 'upload'    && <UploadPanel />}
        {panel === 'analytics' && <AnalyticsDashboard />}

        {panel === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

              {/* Welcome */}
              {messages.length === 0 && !loadingSess && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="text-5xl mb-5 animate-float">🧭</div>
                  <h2 className="font-display font-bold text-2xl mb-2 grad-text">Where do you want to go?</h2>
                  <p className="text-sm mb-2 italic" style={{ color: '#7c5cfc', maxWidth: 380 }}>{motiveLine}</p>
                  <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text2)', maxWidth: 400 }}>
                    You're at the most confusing crossroads of your life — and that's completely normal.
                    Ask me anything: college prediction, exams, branch confusion, parental pressure, or just what you're feeling.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl">
                    {QUICK_PROMPTS.map((p, i) => (
                      <motion.button key={i}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.07 }}
                        onClick={() => send(p.text)}
                        className="quick-prompt-card flex items-start gap-3 text-left p-5 rounded-2xl transition-all group">
                        <span className="text-xl shrink-0">{p.icon}</span>
                        <span style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>{p.text}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {loadingSess && (
                <div className="flex justify-center py-20">
                  <div className="flex gap-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="typing-dot" style={{ animationDelay: `${i*0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <motion.div key={msg._id || i}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className={clsx('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>

                  {/* Avatar */}
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-sm')}
                    style={msg.role === 'user'
                      ? { background: 'rgba(124,92,252,0.25)', border: '1px solid rgba(124,92,252,0.4)', color: '#c4b5fd', fontWeight: 600 }
                      : { background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)', fontSize: 16 }}>
                    {msg.role === 'user' ? user?.name?.[0]?.toUpperCase() : '🧭'}
                  </div>

                  <div className={clsx('max-w-[72%]', msg.role === 'user' && 'flex flex-col items-end')}>
                    {/* Badges */}
                    <div className="flex gap-2 mb-1.5 flex-wrap">
                      {msg.stressDetected && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(248,168,75,0.1)', border: '1px solid rgba(248,168,75,0.25)', color: '#f8a84b' }}>
                          <Heart size={10} /> Support mode
                        </span>
                      )}
                      {msg.ragUsed && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(86,207,191,0.08)', border: '1px solid rgba(86,207,191,0.2)', color: '#56cfbf' }}>
                          <Database size={10} /> Knowledge base
                        </span>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="px-4 py-3 text-sm"
                      style={msg.role === 'user'
                        ? { background: 'rgba(124,92,252,0.2)', border: '1px solid rgba(124,92,252,0.35)', borderRadius: '18px 18px 4px 18px', color: 'var(--text)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '4px 18px 18px 18px', color: 'var(--text)', backdropFilter: 'blur(12px)' }}>
                      {msg.role === 'assistant'
                        ? (
                          <div className="prose-chat">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )
                        : msg.content
                      }
                    </div>

                    {msg.intent && msg.role === 'user' && (
                      <p style={{ color: 'var(--text3)', fontSize: 10, marginTop: 4, paddingRight: 4 }}>
                        Topic: {msg.intent.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#7c5cfc,#56cfbf)', fontSize: 16 }}>🧭</div>
                  <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '4px 18px 18px 18px' }}>
                    <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  </div>
                </motion.div>
              )}

              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t shrink-0"
              style={{ background: 'rgba(5,13,26,0.8)', borderColor: 'var(--border)', backdropFilter: 'blur(20px)' }}>
              {stressMode && (
                <div className="flex items-center gap-2 mb-3 text-xs px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(248,168,75,0.06)', border: '1px solid rgba(248,168,75,0.15)', color: '#f8a84b' }}>
                  <Heart size={11} />
                  You're not alone in this. Take your time — I'm here.
                  <button onClick={() => setStressMode(false)} className="ml-auto" style={{ color: 'var(--text3)' }}><X size={11} /></button>
                </div>
              )}

              <div className="flex gap-3 items-end p-3 rounded-2xl transition-all"
                style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
                onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(124,92,252,0.45)'}
                onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); resize() }}
                  onKeyDown={handleKey}
                  placeholder={stressMode
                    ? "Tell me what's on your mind — I'm listening..."
                    : "Ask about colleges, exams, or how you're feeling..."
                  }
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text)', fontFamily: 'DM Sans, sans-serif',
                    fontSize: 14, lineHeight: 1.6, resize: 'none', maxHeight: 160,
                  }}
                />
                <button onClick={() => send()} disabled={!input.trim() || sending}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: input.trim() && !sending ? 'linear-gradient(135deg,#7c5cfc,#9b7dff)' : 'rgba(255,255,255,0.06)',
                    color: input.trim() && !sending ? '#fff' : 'var(--text3)',
                    cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                  }}>
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
              <p className="text-center text-xs mt-2" style={{ color: 'var(--text3)' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
