import { useState, useEffect, useRef, useCallback } from 'react'
import ResultCard, { ComparisionTab } from './components/ResultCard'
import UserAnalyticsModal from './components/UserAnalyticsModal'
import glypadLogo from './assets/glypad-logo.png'
import { logActivity, logQcActivity } from './api/activityApi'
import * as authApi from './api/authApi'
import * as adminApi from './api/adminApi'

/* ── Tolerance button ─────────────────────────────────────────────────────── */
function TolBtn({ label, sub, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent-dim)' : 'var(--panel-hi)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--r-sm)',
        padding: '9px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        cursor: 'pointer',
        transition: 'all var(--t-base)',
        boxShadow: active ? '0 0 0 2px var(--accent-glow)' : 'none',
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: '17px',
        fontWeight: 600,
        color: active ? 'var(--accent)' : 'var(--text-mid)',
        lineHeight: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: '10px',
        letterSpacing: '0.06em',
        color: active ? 'var(--accent)' : 'var(--text-faint)',
        textTransform: 'uppercase',
      }}>
        {sub}
      </span>
    </button>
  )
}

/* ── Sidebar divider label ────────────────────────────────────────────────── */
function SidebarLabel({ children }) {
  return (
    <div className="sidebar-label">
      {children}
    </div>
  )
}

const LOAD_MSGS = [
  'PARSING GEOMETRY…',
  'RUNNING VISION MODEL…',
  'EXTRACTING DIMENSIONS…',
  'IDENTIFYING GD&T…',
  'EVALUATING TOLERANCES…',
  'COMPILING REPORT…',
]

/* ── Profile dropdown ─────────────────────────────────────────────────────── */
function ProfileDropdown({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: isOpen ? 'var(--accent-dim)' : 'transparent',
          border: `1px solid ${isOpen ? 'var(--accent)' : 'transparent'}`,
          borderRadius: 'var(--r-pill)',
          padding: '2px',
          cursor: 'pointer',
          transition: 'all var(--t-base)',
        }}
      >
        <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: 'var(--glass-hi)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          width: 224,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          overflow: 'hidden',
          animation: 'riseIn 0.2s ease',
        }}>
          {/* User info header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, var(--accent-dim), transparent)',
          }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 4,
            }}>
              Signed in as
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 13,
              color: 'var(--text-hi)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.username}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px' }}>
            {['Account Details', 'View Profile', 'Account Settings'].map(label => (
              <button
                key={label}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'background var(--t-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-hi)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Sign out */}
          <div style={{ padding: '6px' }}>
            <button
              onClick={() => { setIsOpen(false); onLogout(); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--error)',
                cursor: 'pointer',
                transition: 'background var(--t-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--error-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── API status dot ───────────────────────────────────────────────────────── */
function ApiStatus({ apiOnline }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--text-dim)',
      letterSpacing: '0.05em',
    }}>
      <div style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        transition: 'background 0.4s, box-shadow 0.4s',
        background: apiOnline === null
          ? 'var(--text-faint)'
          : apiOnline ? 'var(--success)' : 'var(--error)',
        boxShadow: apiOnline === true
          ? '0 0 8px var(--success-glow)'
          : apiOnline === false
          ? '0 0 8px var(--error-dim)'
          : 'none',
      }} />
      <span>
        {apiOnline === null ? 'Checking…' : apiOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */
function Breadcrumb({ onBack, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'color var(--t-fast)',
          padding: '2px 4px',
          borderRadius: 'var(--r-xs)',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Home
      </button>
      <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: color || 'var(--accent)',
        fontWeight: 600,
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── QC App ───────────────────────────────────────────────────────────────── */
function QCApp({ user, onBack, onLogout }) {
  const [files, setFiles] = useState([])
  const [tolClass, setTolClass] = useState('m')
  const [apiUrl] = useState('')
  const [apiOnline, setApiOnline] = useState(null)
  const [results, setResults] = useState([])
  const [activeResult, setActiveResult] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState(LOAD_MSGS[0])
  const [error, setError] = useState(null)
  const [activeFi, setActiveFi] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [validationMode, setValidationMode] = useState('ISO')
  const [standardDoc, setStandardDoc] = useState(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const fileInputRef = useRef(null)
  const msgTimer = useRef(null)

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) })
      setApiOnline(r.ok)
    } catch { setApiOnline(false) }
  }, [apiUrl])

  useEffect(() => { checkHealth() }, [checkHealth])
  useEffect(() => { logActivity('QC_MODULE_ENTERED') }, [])

  const addFiles = useCallback(incoming => {
    const valid = incoming.filter(f => /\.(pdf|jpe?g|png|tiff?)$/i.test(f.name))
    valid.forEach(file => {
      logActivity('QC_FILE_UPLOADED', {
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || file.type,
        fileSize: file.size,
        uploadTimestamp: new Date().toISOString(),
        analysisStatus: 'Uploaded',
      })
    })
    setFiles(prev => {
      if (prev.length + valid.length > 10) { alert('Maximum 10 files.'); return prev }
      const next = [...prev, ...valid.map(file => ({
        file,
        previewUrl: /\.(jpe?g|png|tiff?)$/i.test(file.name) ? URL.createObjectURL(file) : null,
        analyzed: false,
      }))]
      setActiveFi(next.length - 1)
      return next
    })
  }, [])

  const removeFile = useCallback(idx => {
    setFiles(prev => {
      if (prev[idx]?.previewUrl) URL.revokeObjectURL(prev[idx].previewUrl)
      const next = prev.filter((_, i) => i !== idx)
      setActiveFi(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
    setResults(prev => {
      const next = prev.filter((_, i) => i !== idx)
      setActiveResult(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }, [])

  const analyze = async () => {
    const pending = files.filter(f => !f.analyzed)
    if (!pending.length) return
    setLoading(true); setError(null)
    const startedAt = performance.now()
    logActivity('QC_ANALYSIS_STARTED', {
      fileCount: pending.length,
      fileNames: pending.map(({ file }) => file.name),
      validationMode,
      toleranceClass: tolClass,
    })
    let mi = 0
    setLoadMsg(LOAD_MSGS[0])
    msgTimer.current = setInterval(() => {
      mi = (mi + 1) % LOAD_MSGS.length
      setLoadMsg(LOAD_MSGS[mi])
    }, 2200)
    try {
      const isBatch = pending.length > 1
      const fd = new FormData()
      if (isBatch) pending.forEach(({ file }) => fd.append('files', file))
      else fd.append('file', pending[0].file)
      fd.append('tolerance_class', tolClass)
      fd.append('validation_mode', validationMode)
      if (standardDoc && validationMode !== 'ISO') fd.append('standard_doc', standardDoc)
      const res = await fetch(`${apiUrl}/analyze${isBatch ? '/batch' : ''}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      const list = isBatch ? (data.results || [data]) : [data]
      const newResults = list.map((r, i) => {
        const entry = pending[i] || pending[0]
        return { data: r, previewUrl: entry?.previewUrl || null, isPdf: entry ? /\.pdf$/i.test(entry.file.name) : false, originalFile: entry?.file || null }
      })
      setResults(prev => {
        const merged = [...prev, ...newResults]
        setActiveResult(merged.length - 1)
        return merged
      })
      setFiles(prev => prev.map(f => pending.includes(f) ? { ...f, analyzed: true } : f))
      logQcActivity({
        processingTimeMs: Math.round(performance.now() - startedAt),
        fileCount: pending.length,
        fileNames: pending.map(({ file }) => file.name),
        validationMode,
        toleranceClass: tolClass,
        dimensionsCount: list.reduce((sum, item) => sum + (item.dimensions_with_tolerances?.length || 0), 0),
        criticalDimensionsCount: list.reduce((sum, item) => sum + (item.conclusions?.critical_features_count || 0), 0),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(msgTimer.current)
      setLoading(false)
    }
  }

  const activePreview = files[activeFi]?.previewUrl || null
  const pendingCount = files.filter(f => !f.analyzed).length

  return (
    <div
      className="app-container"
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateRows: '56px 1fr',
        gridTemplateColumns: isSidebarCollapsed ? '40px 1fr' : '340px 1fr',
        gridTemplateAreas: '"top top" "side main"',
        transition: 'grid-template-columns 0.3s ease',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* ── Topbar ── */}
      <header
        className="topbar"
        style={{
          gridArea: 'top',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={glypadLogo} alt="GLYPAD" style={{ height: 17, width: 'auto', objectFit: 'contain', display: 'block' }} />
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--text-faint)',
            letterSpacing: '0.1em',
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}>
            CAD Drawing<br />Analyzer
          </div>
          <Breadcrumb onBack={onBack} label="QC Check" color="var(--accent)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ApiStatus apiOnline={apiOnline} />
          <ProfileDropdown user={user} onLogout={onLogout} />
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside
        className="sidebar"
        style={{
          gridArea: 'side',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* Collapsed state — expand button */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            title="Expand sidebar"
            style={{
              width: '100%',
              height: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-faint)',
              transition: 'color var(--t-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: isSidebarCollapsed ? 'none' : 'flex', flexDirection: 'column' }}>
          {/* Collapse control */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 10px 0' }}>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="btn-ghost btn"
              style={{ padding: '4px 9px', fontSize: 10 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Collapse
            </button>
          </div>

          {/* CAD Upload */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>CAD Drawings</SidebarLabel>
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onClick={() => { if (!loading) { logActivity('QC_FILE_UPLOAD_STARTED'); fileInputRef.current?.click() } }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (!loading) addFiles([...e.dataTransfer.files]) }}
              style={{ marginBottom: 10 }}
            >
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                style={{ display: 'none' }}
                onChange={e => { addFiles([...e.target.files]); e.target.value = '' }}
              />
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none"
                stroke={dragOver ? 'var(--accent)' : 'var(--text-faint)'}
                strokeWidth="1.5"
                style={{ margin: '0 auto 8px', display: 'block', transition: 'stroke 0.2s' }}
              >
                <rect x="4" y="5" width="22" height="28" rx="1" />
                <line x1="8" y1="13" x2="22" y2="13" />
                <line x1="8" y1="19" x2="22" y2="19" />
                <line x1="8" y1="25" x2="14" y2="25" />
                <circle cx="29" cy="28" r="5" />
                <line x1="29" y1="25.5" x2="29" y2="30.5" />
                <line x1="26.5" y1="28" x2="31.5" y2="28" />
              </svg>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 3,
                fontFamily: 'var(--body)',
              }}>
                Drop or click to browse
              </div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text-faint)',
                letterSpacing: '0.06em',
              }}>
                PDF · PNG · JPG · TIFF — max 10
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {files.map(({ file, analyzed }, i) => {
                  const ext = file.name.split('.').pop().toUpperCase()
                  const isActive = i === activeFi
                  return (
                    <div
                      key={i}
                      className={`file-chip${isActive ? ' active' : ''}`}
                      onClick={() => setActiveFi(i)}
                    >
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#fff',
                        background: analyzed ? 'var(--success)' : 'var(--accent)',
                        padding: '1px 5px',
                        borderRadius: 'var(--r-xs)',
                        flexShrink: 0,
                        transition: 'background var(--t-base)',
                      }}>
                        {ext}
                      </span>
                      <span style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                      }}>
                        {file.name}
                      </span>
                      {analyzed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); removeFile(i) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-faint)',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          padding: '3px',
                          flexShrink: 0,
                          pointerEvents: loading ? 'none' : 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 'var(--r-xs)',
                          transition: 'all var(--t-fast)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-dim)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'none' }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Image preview */}
            {activePreview && (
              <div style={{
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--panel-hi)',
                boxShadow: 'var(--shadow-xs)',
              }}>
                <img
                  src={activePreview}
                  alt="Preview"
                  style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 160 }}
                />
              </div>
            )}
          </div>

          {/* Org Standard upload */}
          {validationMode !== 'ISO' && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <SidebarLabel>Organizational Standard</SidebarLabel>
              <div
                className={`drop-zone${standardDoc ? '' : ''}`}
                style={{ borderStyle: standardDoc ? 'solid' : 'dashed' }}
                onClick={() => !loading && document.getElementById('stdDocInput').click()}
              >
                <input id="stdDocInput" type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) setStandardDoc(e.target.files[0]); e.target.value = '' }}
                />
                {standardDoc ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-mid)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-faint)' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, fontSize: 12 }}>
                      {standardDoc.name}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setStandardDoc(null) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 3, borderRadius: 'var(--r-xs)', display: 'flex' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-dim)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'none' }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3, fontFamily: 'var(--body)' }}>Upload Document</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>PDF · DOCX · TXT</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Validation mode */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>Validation Mode</SidebarLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
              {[['ISO', 'ISO Only'], ['Org', 'Org Only'], ['Both', 'Both']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setValidationMode(val); logActivity('VALIDATION_MODE_CHANGED', { value: label, rawValue: val }) }}
                  style={{
                    background: validationMode === val ? 'var(--accent-dim)' : 'var(--panel-hi)',
                    border: `1px solid ${validationMode === val ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-sm)',
                    padding: '8px 4px',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    fontWeight: validationMode === val ? 600 : 400,
                    color: validationMode === val ? 'var(--accent)' : 'var(--text-faint)',
                    cursor: 'pointer',
                    transition: 'all var(--t-base)',
                    boxShadow: validationMode === val ? '0 0 0 2px var(--accent-glow)' : 'none',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ISO tolerance */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>ISO 2768 Tolerance</SidebarLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
              {[['f', 'Fine'], ['m', 'Medium'], ['c', 'Coarse'], ['v', 'V.Coarse']].map(([val, sub]) => (
                <TolBtn key={val} label={val} sub={sub} active={tolClass === val} onClick={() => {
                  setTolClass(val)
                  logActivity('ISO_TOLERANCE_SELECTED', { value: sub, rawValue: val })
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Analyze button — pinned bottom */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--panel-lo)',
          display: isSidebarCollapsed ? 'none' : 'block',
        }}>
          <button
            onClick={analyze}
            disabled={!files.some(f => !f.analyzed) || loading}
            style={{
              width: '100%',
              background: pendingCount > 0 && !loading ? 'var(--accent)' : 'var(--panel-hi)',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              color: pendingCount > 0 && !loading ? '#ffffff' : 'var(--text-faint)',
              fontFamily: 'var(--display)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '12px',
              cursor: pendingCount > 0 && !loading ? 'pointer' : 'not-allowed',
              transition: 'all var(--t-base)',
              boxShadow: pendingCount > 0 && !loading ? '0 2px 10px var(--accent-glow)' : 'none',
            }}
            onMouseEnter={e => {
              if (pendingCount > 0 && !loading) {
                e.currentTarget.style.background = 'var(--accent-hi)'
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = pendingCount > 0 && !loading ? 'var(--accent)' : 'var(--panel-hi)'
              e.currentTarget.style.boxShadow = pendingCount > 0 && !loading ? '0 2px 10px var(--accent-glow)' : 'none'
              e.currentTarget.style.transform = ''
            }}
          >
            {loading
              ? 'Analyzing…'
              : pendingCount > 0
              ? `Analyze${pendingCount === files.length ? '' : ` ${pendingCount} New`} ${pendingCount === 1 ? 'Drawing' : `${pendingCount} Files`}`
              : 'All Analyzed ✓'
            }
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main
        className="main-container"
        style={{
          gridArea: 'main',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {/* Multi-result tab bar */}
        {results.length > 1 && (
          <div className="tab-bar multi-tab-bar" style={{ background: 'var(--panel)', boxShadow: 'var(--shadow-xs)' }}>
            {results.map((r, i) => {
              const fn = r.data._metadata?.source_file || r.data.drawing_info?.drawing_number || `File ${i + 1}`
              const isActive = i === activeResult
              return (
                <button
                  key={i}
                  className={`tab-item${isActive ? ' active' : ''}`}
                  onClick={() => !loading && setActiveResult(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  <span style={{
                    fontSize: 9,
                    background: isActive ? 'var(--accent)' : 'var(--border-hi)',
                    color: isActive ? '#fff' : 'var(--text-faint)',
                    padding: '1px 5px',
                    borderRadius: 'var(--r-xs)',
                    fontWeight: 600,
                  }}>
                    {fn.split('.').pop().toUpperCase()}
                  </span>
                  {fn.length > 28 ? fn.slice(0, 26) + '…' : fn}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Idle state */}
          {!loading && results.length === 0 && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              animation: 'riseIn 0.4s ease',
            }}>
              <div style={{
                width: 72,
                height: 72,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1.2">
                  <rect x="8" y="4" width="28" height="38" rx="1" />
                  <line x1="14" y1="14" x2="30" y2="14" />
                  <line x1="14" y1="21" x2="30" y2="21" />
                  <line x1="14" y1="28" x2="22" y2="28" />
                  <circle cx="36" cy="36" r="8" />
                  <line x1="33" y1="36" x2="39" y2="36" />
                  <line x1="36" y1="33" x2="36" y2="39" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-mid)',
                  marginBottom: 6,
                }}>
                  No drawing loaded
                </div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  letterSpacing: '0.06em',
                }}>
                  Upload a drawing in the sidebar and click Analyze
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}>
              <div className="loading-track">
                <div className="loading-bar" />
              </div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 13,
                letterSpacing: '0.1em',
                color: 'var(--accent)',
                fontWeight: 500,
                animation: 'blink 2s ease-in-out infinite',
              }}>
                {loadMsg}
              </div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text-faint)',
                letterSpacing: '0.06em',
              }}>
                Processing document, please wait
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', padding: 24 }}>
              <div style={{
                background: 'var(--error-dim)',
                border: '1px solid rgba(192,24,46,0.25)',
                borderLeft: '3px solid var(--error)',
                borderRadius: 'var(--r)',
                padding: '16px 18px',
                fontFamily: 'var(--mono)',
                fontSize: 14,
                color: 'var(--error)',
                width: '100%',
              }}>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, opacity: 0.7 }}>Analysis Failed</div>
                {error}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !loading && (
            <div className="result-wrapper" style={{ position: 'absolute', inset: 0 }}>
              <ResultCard
                key={activeResult}
                data={results[activeResult].data}
                previewUrl={results[activeResult].previewUrl}
                isPdf={results[activeResult].isPdf}
                validationMode={validationMode}
                originalFile={results[activeResult].originalFile}
                onTabChange={(tab) => {
                  setIsSidebarCollapsed(tab === 'Comparision')
                  const tabEvents = {
                    Overview: 'OVERVIEW_TAB_OPENED',
                    'Visual Audit': 'VISUAL_AUDIT_TAB_OPENED',
                    Dimensions: 'DIMENSIONS_TAB_OPENED',
                    'GD&T': 'GDT_TAB_OPENED',
                    Manufacturing: 'MANUFACTURING_TAB_OPENED',
                    Drawing: 'DRAWING_TAB_OPENED',
                    Report: 'REPORT_TAB_OPENED',
                  }
                  if (tabEvents[tab]) logActivity(tabEvents[tab])
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/* ── Login page ───────────────────────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    let errs = { email: '', password: '' }
    if (!email) errs.email = 'Email is required'
    if (!password) errs.password = 'Password is required'
    if (email && password) {
      setErrors({ email: '', password: '' }); setSubmitError(''); setIsSubmitting(true)
      try { await onLogin({ email, password }) }
      catch (error) { setSubmitError(error.message) }
      finally { setIsSubmitting(false) }
    } else { setErrors(errs) }
  }

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '11px 14px',
    border: `1px solid ${hasError ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: 'var(--r-sm)',
    background: 'var(--panel)',
    color: 'var(--text)',
    fontFamily: 'var(--mono)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <div
        className="modal-panel"
        style={{
          background: 'var(--glass-hi)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          width: 420,
          padding: 40,
          textAlign: 'center',
          animation: 'spinIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 3, background: 'var(--accent)', margin: '-40px -40px 32px', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }} />

        <img src={glypadLogo} alt="GLYPAD" style={{ height: 22, marginBottom: 8 }} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28 }}>
          Metrology Systems
        </div>

        <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: 'var(--text-hi)', marginBottom: 24 }}>
          Sign in to continue
        </h2>

        <div style={{ marginBottom: 14, textAlign: 'left' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle(!!errors.email)}
            onFocus={e => e.target.style.boxShadow = 'var(--shadow-glow)'}
            onBlur={e => e.target.style.boxShadow = 'none'}
          />
          {errors.email && <div style={{ color: 'var(--error)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
        </div>

        <div style={{ marginBottom: 24, textAlign: 'left' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle(!!errors.password)}
            onFocus={e => e.target.style.boxShadow = 'var(--shadow-glow)'}
            onBlur={e => e.target.style.boxShadow = 'none'}
          />
          {errors.password && <div style={{ color: 'var(--error)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4 }}>{errors.password}</div>}
        </div>

        <button
          onClick={handleLogin}
          disabled={isSubmitting}
          className={`btn btn-primary${isSubmitting ? '' : ''}`}
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '12px',
            fontSize: 13,
          }}
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        {submitError && (
          <div style={{ color: 'var(--warn)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 12 }}>
            {submitError}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Landing page ─────────────────────────────────────────────────────────── */
function LandingPage({ user, onSelectMode, onLogout }) {
  useEffect(() => { logActivity('HOME_VIEWED') }, [])

  const modes = [
    {
      id: 'qc',
      eyebrow: 'Quality Control',
      title: 'Analyze a drawing',
      description: 'Extract dimensions, validate tolerances against ISO or organizational standards, and generate compliance reports.',
      color: 'var(--accent)',
      iconBg: 'var(--accent)',
      letter: 'QC',
    },
    {
      id: 'comparison',
      eyebrow: 'Revision Review',
      title: 'Compare drawings',
      description: 'Load an original drawing, add a revision, and inspect all detected dimensional and visual changes.',
      color: 'var(--info)',
      iconBg: 'var(--info)',
      letter: '⇄',
    },
  ]

  if (user?.role === 'admin') {
    modes.push({
      id: 'admin',
      eyebrow: 'Administration',
      title: 'View user activity',
      description: 'Platform-wide user management, session tracking, and activity metrics.',
      color: 'var(--success)',
      iconBg: 'var(--success)',
      letter: '⊞',
    })
  }

  return (
    <main style={{
      position: 'relative',
      zIndex: 1,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 32px 40px',
      overflowY: 'auto',
    }}>
      <header style={{
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <img src={glypadLogo} alt="GLYPAD" style={{ height: 19, width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProfileDropdown user={user} onLogout={onLogout} />
        </div>
      </header>

      <section style={{
        width: '100%',
        maxWidth: 960,
        margin: 'auto',
        padding: '60px 0',
        animation: 'riseIn 0.35s ease',
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          fontWeight: 600,
          marginBottom: 12,
        }}>
          Drawing Workspace
        </div>
        <h1 style={{
          maxWidth: 580,
          fontFamily: 'var(--display)',
          fontSize: 40,
          fontWeight: 800,
          lineHeight: 1.1,
          color: 'var(--text-hi)',
          marginBottom: 14,
          letterSpacing: '-0.01em',
        }}>
          What would you like to inspect?
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: 36, fontSize: 15 }}>
          Choose a workflow below to begin.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
        }}>
          {modes.map((mode, idx) => (
            <button
              key={mode.id}
              className="landing-card"
              onClick={() => onSelectMode(mode.id)}
              style={{
                animation: `riseIn ${0.3 + idx * 0.08}s ease`,
                textAlign: 'left',
                display: 'block',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)'
                e.currentTarget.style.borderColor = mode.color
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px ${mode.color}30`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.borderColor = 'var(--border-glass)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
            >
              {/* Icon */}
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--r-sm)',
                background: mode.iconBg,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: mode.id === 'comparison' ? 18 : 13,
                marginBottom: 26,
                boxShadow: `0 4px 12px ${mode.color}40`,
                letterSpacing: 0,
              }}>
                {mode.letter}
              </div>

              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: mode.color,
                fontWeight: 600,
                marginBottom: 7,
              }}>
                {mode.eyebrow}
              </div>
              <div style={{
                fontFamily: 'var(--display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-hi)',
                marginBottom: 8,
                letterSpacing: '-0.01em',
              }}>
                {mode.title}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                lineHeight: 1.6,
                fontFamily: 'var(--body)',
              }}>
                {mode.description}
              </div>

              {/* Arrow indicator */}
              <div style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: mode.color,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}>
                Open workflow
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

/* ── Comparison App ───────────────────────────────────────────────────────── */
function ComparisonApp({ user, onBack, onLogout }) {
  const [apiUrl] = useState('')
  const [apiOnline, setApiOnline] = useState(null)

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) })
      setApiOnline(r.ok)
    } catch { setApiOnline(false) }
  }, [apiUrl])

  useEffect(() => { checkHealth() }, [checkHealth])
  useEffect(() => {
    logActivity('COMPARISON_MODULE_ENTERED')
    logActivity('COMPARISON_WORKFLOW_ENTERED')
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <header
        className="topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 56,
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={glypadLogo} alt="GLYPAD" style={{ height: 16, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em', lineHeight: 1.4, textTransform: 'uppercase' }}>
            CAD Drawing<br />Analyzer
          </div>
          <Breadcrumb onBack={onBack} label="Comparison" color="var(--info)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ApiStatus apiOnline={apiOnline} />
          <ProfileDropdown user={user} onLogout={onLogout} />
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px 24px' }}>
        <ComparisionTab standalone={true} />
      </div>
    </div>
  )
}

/* ── Admin Dashboard ──────────────────────────────────────────────────────── */
function AdminDashboard({ user, onBack, onLogout }) {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('lastActivity')
  const [selectedUserEmail, setSelectedUserEmail] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all([adminApi.getOverview(), adminApi.getUsers()])
      .then(([overviewData, userRows]) => {
        if (!active) return
        setOverview(overviewData); setUsers(userRows)
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const visibleUsers = users
    .filter(row => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return row.name?.toLowerCase().includes(q) || row.email?.toLowerCase().includes(q) || row.role?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (['email', 'name', 'status'].includes(sortKey)) return String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
      return Number(b[sortKey] || 0) - Number(a[sortKey] || 0)
    })



  return (
    <main style={{ position: 'relative', zIndex: 1, height: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <header
        className="topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          height: 60,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={glypadLogo} alt="GLYPAD" style={{ height: 17, width: 'auto' }} />
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color var(--t-fast)', display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Home
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <span style={{ color: 'var(--success)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Admin</span>
        </div>
        <ProfileDropdown user={user} onLogout={onLogout} />
      </header>

      <div style={{ padding: '28px 28px 40px' }}>
        {/* Page heading */}
        <section style={{ paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
            Administration
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 28, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 4, letterSpacing: '-0.01em' }}>
            User Activity
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Platform-wide user management and activity tracking.
          </p>
        </section>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', fontFamily: 'var(--mono)', color: 'var(--text-faint)', fontSize: 12 }}>
            <div className="loading-track" style={{ width: 120 }}>
              <div className="loading-bar" />
            </div>
            Loading admin data…
          </div>
        )}

        {error && (
          <div style={{ padding: '14px 16px', border: '1px solid rgba(192,24,46,0.2)', borderLeft: '3px solid var(--error)', borderRadius: 'var(--r-sm)', color: 'var(--error)', background: 'var(--error-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>


            {/* Users table */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              {/* Table toolbar */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: 'var(--panel-hi)',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                  Users · {visibleUsers.length}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    >
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search users…"
                      style={{
                        width: 200,
                        padding: '7px 10px 7px 30px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        outline: 'none',
                        transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'var(--shadow-glow)' }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="lastActivity">Sort: Last Activity</option>
                    <option value="name">Sort: Name</option>
                    <option value="email">Sort: Email</option>
                    <option value="status">Sort: Status</option>
                    <option value="totalQcChecks">Sort: QC Checks</option>
                    <option value="totalComparisons">Sort: Comparisons</option>
                    <option value="totalSessions">Sort: Sessions</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Role', 'Status', 'QC', 'Comparisons', 'Sessions', 'Minutes'].map(head => (
                        <th key={head}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map(row => (
                      <tr key={row.email} onClick={() => setSelectedUserEmail(row.email)} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--text-hi)', fontWeight: 600, fontFamily: 'var(--body)' }}>{row.name}</td>
                        <td style={{ color: 'var(--text-dim)' }}>{row.email}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            padding: '2px 7px',
                            borderRadius: 'var(--r-xs)',
                            background: row.role === 'admin' ? 'var(--accent-dim)' : 'var(--panel-hi)',
                            color: row.role === 'admin' ? 'var(--accent)' : 'var(--text-faint)',
                            border: `1px solid ${row.role === 'admin' ? 'rgba(29,78,216,0.2)' : 'var(--border)'}`,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                          }}>
                            {row.role}
                          </span>
                        </td>
                        <td>
                          <span className="status-chip" style={{
                            color: row.status === 'Online' ? 'var(--success)' : 'var(--text-faint)',
                            background: row.status === 'Online' ? 'var(--success-dim)' : 'transparent',
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: row.status === 'Online' ? 'var(--success)' : 'var(--border-hi)',
                              boxShadow: row.status === 'Online' ? '0 0 6px var(--success-glow)' : 'none',
                            }} />
                            {row.status || 'Offline'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-mid)', fontWeight: 500 }}>{row.totalQcChecks}</td>
                        <td style={{ color: 'var(--text-mid)', fontWeight: 500 }}>{row.totalComparisons}</td>
                        <td>{row.totalSessions}</td>
                        <td style={{ color: 'var(--text-faint)' }}>{row.totalTimeSpentMinutes}</td>
                      </tr>
                    ))}
                    {visibleUsers.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          No users match the search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedUserEmail && (
              <UserAnalyticsModal email={selectedUserEmail} onClose={() => setSelectedUserEmail(null)} />
            )}
          </>
        )}
      </div>
    </main>
  )
}

/* ── Root ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail')
    if (storedEmail) {
      const role = storedEmail.toLowerCase().includes('admin') ? 'admin' : 'user'
      setUser({ username: storedEmail, email: storedEmail, role })
      setScreen('landing')
    }
  }, [])

  const handleLogin = async ({ email, password }) => {
    const authenticatedUser = await authApi.login(email, password)
    setUser({ username: authenticatedUser.email, ...authenticatedUser })
    localStorage.setItem('userEmail', authenticatedUser.email)
    setScreen('landing')
  }

  const handleLogout = async () => {
    await authApi.logout()
    localStorage.removeItem('userEmail')
    window.location.reload()
  }

  const handleSelectMode = (mode) => {
    if (mode === 'qc') logActivity('QC_WORKFLOW_SELECTED')
    if (mode === 'comparison') logActivity('COMPARISON_WORKFLOW_SELECTED')
    setScreen(mode === 'qc' ? 'qc' : mode === 'admin' ? 'admin' : 'comparison')
  }

  const handleBack = () => {
    logActivity('HOME_BUTTON_CLICKED')
    setScreen('landing')
  }

  if (screen === 'login') return <LoginPage onLogin={handleLogin} />
  if (screen === 'landing') return <LandingPage user={user} onSelectMode={handleSelectMode} onLogout={handleLogout} />
  if (screen === 'qc') return <QCApp user={user} onBack={handleBack} onLogout={handleLogout} />
  if (screen === 'comparison') return <ComparisonApp user={user} onBack={handleBack} onLogout={handleLogout} />
  if (screen === 'admin') return <AdminDashboard user={user} onBack={handleBack} onLogout={handleLogout} />
  return null
}