import { useState, useEffect } from 'react'
import { chatAPI, authAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import { Award, Building2, Compass, Loader2, Heart, MapPin, GraduationCap, Save } from 'lucide-react'
import { motion } from 'framer-motion'

const COLORS = ['#56cfbf', '#7c5cfc', '#f8a84b', '#60a5fa', '#34d399', '#f87171']
const INTENTS = {
  engineering: 'Engineering', medical: 'Medical', commerce: 'Commerce',
  law: 'Law', design: 'Design', abroad: 'Study Abroad',
  emotional_support: 'Support', recovery: 'Drop/Backup',
  tech_career: 'Tech Career', arts: 'Arts', cuet: 'CUET',
  management: 'Management', general: 'General',
}

const COLLEGE_HINTS = {
  JEE: ['NIT / IIIT', 'State counselling', 'BITS/VIT/COMEDK backups'],
  NEET: ['AIQ/state quota', 'BDS/BAMS/BHMS', 'Nursing/BPT backup'],
  CLAT: ['NLU list', 'AILET/private law', 'State law colleges'],
  CUET: ['DU/BHU', 'Central universities', 'State/private universities'],
  VITEEE: ['VIT Vellore', 'VIT Chennai', 'VIT AP/Bhopal'],
  BITSAT: ['BITS Pilani', 'BITS Goa', 'BITS Hyderabad'],
  COMEDK: ['RVCE/BMS/MSRIT', 'Bangalore options', 'Fee backup list'],
  GATE: ['MTech', 'PSU', 'Research/branch upgrade'],
  IPMAT: ['IIM Indore', 'IIM Rohtak', 'BBA backups'],
  Other: ['Safe list', 'Possible list', 'Reach list'],
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-xl text-xs"
      style={{ background: 'rgba(10,22,40,0.97)', border: '1px solid var(--border)', color: 'var(--text)' }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    preferredCollege: user?.profile?.preferredCollege || '',
    preferredBranch: user?.profile?.preferredBranch || '',
    preferredLocation: user?.profile?.preferredLocation || user?.profile?.state || '',
    category: user?.profile?.category || '',
    budget: user?.profile?.budget || '',
  }))

  useEffect(() => {
    chatAPI.getAnalytics()
      .then(({ data: d }) => setData(d.analytics))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setForm({
      preferredCollege: user?.profile?.preferredCollege || '',
      preferredBranch: user?.profile?.preferredBranch || '',
      preferredLocation: user?.profile?.preferredLocation || user?.profile?.state || '',
      category: user?.profile?.category || '',
      budget: user?.profile?.budget || '',
    })
  }, [user])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveProfile = async () => {
    setSaving(true)
    try {
      await authAPI.updateProfile({ profile: form })
      await refreshUser()
      toast.success('Preferences saved for future chats')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={26} className="animate-spin" style={{ color: 'var(--text3)' }} />
    </div>
  )

  const profile = user?.profile || {}
  const exam = profile.targetExam || 'Not set'
  const collegeList = COLLEGE_HINTS[profile.targetExam] || COLLEGE_HINTS.Other
  const intentData = (data?.intentBreakdown || []).map(i => ({ name: INTENTS[i._id] || i._id, value: i.count }))
  const shortlistData = collegeList.map((name, i) => ({ name, value: collegeList.length - i }))

  const metrics = [
    { label: 'Exam Focus', value: exam, icon: <Compass size={18} />, color: '#56cfbf' },
    { label: 'Rank Status', value: 'Share in chat', icon: <Award size={18} />, color: '#7c5cfc' },
    { label: 'Preferred College', value: form.preferredCollege || 'Add one', icon: <Building2 size={18} />, color: '#f8a84b' },
    { label: 'Stress Signals', value: `${data?.stressRatio || 0}%`, icon: <Heart size={18} />, color: '#60a5fa' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>Student Planner</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text2)' }}>
          Track exam focus, preferred colleges, stress patterns, and the details the chatbot needs for prediction.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {metrics.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} className="glass-card p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: m.color + '22', color: m.color }}>{m.icon}</div>
              <p className="font-display text-lg font-bold truncate" style={{ color: 'var(--text)' }}>{m.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>{m.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap size={17} style={{ color: '#56cfbf' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Preferred College Details</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="input-glass" value={form.preferredCollege} onChange={e => set('preferredCollege', e.target.value)} placeholder="Preferred college, e.g. NIT Durgapur" />
              <input className="input-glass" value={form.preferredBranch} onChange={e => set('preferredBranch', e.target.value)} placeholder="Preferred branch/course, e.g. CSE or ECE" />
              <input className="input-glass" value={form.preferredLocation} onChange={e => set('preferredLocation', e.target.value)} placeholder="Home state / preferred location" />
              <input className="input-glass" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Category, e.g. General, OBC-NCL, SC" />
              <input className="input-glass md:col-span-2" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="Budget or fee comfort, e.g. under 12 lakh total" />
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary mt-4 py-2.5 px-4 text-xs">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save preferences
            </button>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={17} style={{ color: '#f8a84b' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Stress Support</p>
            </div>
            <p className="text-3xl font-display font-bold mb-1" style={{ color: '#f8a84b' }}>{data?.stressRatio || 0}%</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>
              {data?.stressMessages || 0} stress-related messages detected. The bot will slow down, validate feelings, and still help with the actual decision.
            </p>
            <div className="space-y-2">
              {(data?.recentStress || []).slice(0, 2).map((item, i) => (
                <div key={i} className="p-3 rounded-xl text-xs" style={{ background: 'rgba(248,168,75,0.07)', border: '1px solid rgba(248,168,75,0.18)', color: 'var(--text2)' }}>
                  {item.content}
                </div>
              ))}
              {(!data?.recentStress || data.recentStress.length === 0) && (
                <p className="text-xs" style={{ color: 'var(--text3)' }}>No stress spikes yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="glass-card p-5">
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>Question Focus</p>
            {intentData.length === 0
              ? <p className="text-xs text-center py-8" style={{ color: 'var(--text3)' }}>Ask a few questions to see your focus</p>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={intentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {intentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} style={{ color: '#56cfbf' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>College Option Track</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shortlistData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={132} tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" fill="#56cfbf" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Next Best Step</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            In chat, share: exam name, rank/score/percentile, category, home state, preferred branch, preferred college, and budget.
            UdaanAI will respond with a Safe / Possible / Reach list and ask one follow-up question to refine it.
          </p>
        </div>
      </div>
    </div>
  )
}
