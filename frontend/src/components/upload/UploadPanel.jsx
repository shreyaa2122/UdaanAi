import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Trash2, CheckCircle, Loader2, AlertCircle, GraduationCap } from 'lucide-react'
import clsx from 'clsx'

const fmt = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`

export default function UploadPanel() {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = () => uploadAPI.getDocuments().then(({ data }) => setDocs(data.documents)).catch(() => {})
  useEffect(() => { load() }, [])

  const onDrop = useCallback(async (accepted, rejected) => {
    if (rejected.length) { toast.error('Only readable PDF or TXT files under 10MB accepted'); return }
    const file = accepted[0]; if (!file) return
    const fd = new FormData(); fd.append('document', file)
    setUploading(true)
    try {
      const { data } = await uploadAPI.upload(fd)
      toast.success(data.message)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed') }
    finally { setUploading(false) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: uploading,
  })

  const deleteAll = async () => {
    setDeleting(true)
    try { await uploadAPI.deleteDocuments(); setDocs([]); toast.success('All documents removed from AI memory') }
    catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Upload Your Marksheet
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text2)' }}>
          Upload your marksheet, counselling brochure, cutoff PDF, or notes. UdaanAI can use them for
          <strong style={{ color: '#56cfbf' }}> college prediction, branch fit, and counselling advice</strong>.
        </p>

        <div className="mb-6 p-5 rounded-2xl flex gap-3"
          style={{ background: 'linear-gradient(135deg, rgba(86,207,191,0.12), rgba(124,92,252,0.1))', border: '1px solid rgba(86,207,191,0.24)' }}>
          <GraduationCap size={20} className="shrink-0 mt-0.5" style={{ color: '#56cfbf' }} />
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#d8fffa' }}>Get advice based on your actual marks</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
              Ask about eligible colleges, possible branches, rank cutoffs, fees, hostels,
              placements, counselling rounds, and backup choices.
            </p>
          </div>
        </div>

        <div {...getRootProps()}
          className={clsx('rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6',
            isDragActive ? 'border-2 border-teal-400' : 'border-2 border-dashed',
            uploading && 'opacity-50 cursor-not-allowed')}
          style={{ borderColor: isDragActive ? '#56cfbf' : 'rgba(86,207,191,0.28)', background: isDragActive ? 'rgba(86,207,191,0.1)' : 'rgba(255,255,255,0.055)' }}>
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            {uploading
              ? <Loader2 size={42} className="animate-spin" style={{ color: '#56cfbf' }} />
              : <Upload size={42} style={{ color: isDragActive ? '#56cfbf' : '#8be9dd' }} />}
            <div>
              <p className="font-medium text-base mb-1" style={{ color: isDragActive ? '#d8fffa' : 'var(--text)' }}>
                {uploading ? 'Uploading...' : isDragActive ? 'Drop it here!' : 'Drag & drop your marksheet'}
              </p>
              <p style={{ color: 'var(--text3)', fontSize: 12 }}>PDF or TXT - Max 10MB</p>
            </div>
            {!uploading && (
              <button className="btn-ghost text-sm px-5 py-2.5" type="button">Browse file</button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {docs.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Uploaded ({docs.length})
                </p>
                <button onClick={deleteAll} disabled={deleting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete All
                </button>
              </div>
              <div className="space-y-2">
                {docs.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    <FileText size={15} style={{ color: 'var(--text3)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text2)' }}>{doc.originalName}</p>
                      <p style={{ color: 'var(--text3)', fontSize: 11 }}>
                        {fmt(doc.sizeBytes)} - {new Date(doc.uploadedAt).toLocaleDateString()}
                        {doc.chunkCount > 0 && ` - ${doc.chunkCount} chunks`}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={doc.processed
                        ? { background: 'rgba(86,207,191,0.1)', color: '#56cfbf', border: '1px solid rgba(86,207,191,0.25)' }
                        : { background: 'rgba(248,168,75,0.1)', color: '#f8a84b', border: '1px solid rgba(248,168,75,0.25)' }}>
                      {doc.processed ? <><CheckCircle size={10} /> Ready</> : <><Loader2 size={10} className="animate-spin" /> Processing</>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl flex gap-2"
                style={{ background: 'rgba(86,207,191,0.05)', border: '1px solid rgba(86,207,191,0.15)' }}>
                <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#56cfbf' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                  Go to Chat and ask: <em style={{ color: '#56cfbf' }}>"Based on my marksheet, rank, category, and preferred location, which colleges fit me?"</em>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {docs.length === 0 && !uploading && (
          <div className="text-center py-6">
            <AlertCircle size={18} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p style={{ color: 'var(--text3)', fontSize: 12 }}>
              No documents yet. You can still ask general college and counselling questions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
