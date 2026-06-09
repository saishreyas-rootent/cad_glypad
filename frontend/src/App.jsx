import { useState, useEffect, useRef, useCallback } from 'react'
import ResultCard from './components/ResultCard'
import glypadLogo from './assets/glypad-logo.png'


function TolBtn({ label, sub, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'var(--accent-dim)' : 'var(--panel-hi)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--r-sm)', padding: '8px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
      cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: active ? '0 0 16px var(--accent-glow)' : 'none',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: 500, color: active ? 'var(--accent)' : 'var(--text-mid)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{sub}</span>
    </button>
  )
}

function SidebarLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '12px',
    }}>
      {children}
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

const LOAD_MSGS = [
  'PARSING GEOMETRY…', 'RUNNING VISION MODEL…', 'EXTRACTING DIMENSIONS…',
  'IDENTIFYING GD&T…', 'EVALUATING TOLERANCES…', 'COMPILING REPORT…',
]

function AnalyzerApp() {
  const [files, setFiles] = useState([])
  const [tolClass, setTolClass] = useState('m')
  const [apiUrl] = useState('')   // empty = same-origin; vite proxy handles /analyze in dev
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

  const addFiles = useCallback(incoming => {
    const valid = incoming.filter(f => /\.(pdf|jpe?g|png|tiff?)$/i.test(f.name))
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

    setLoading(true)
    setError(null)

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
      if (standardDoc && validationMode !== 'ISO') {
        fd.append('standard_doc', standardDoc)
      }

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
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(msgTimer.current)
      setLoading(false)
    }
  }

  const activePreview = files[activeFi]?.previewUrl || null

  return (
    <div className="app-container" style={{
      position: 'relative', zIndex: 1,
      display: 'grid',
      gridTemplateRows: '60px 1fr',
      gridTemplateColumns: isSidebarCollapsed ? '40px 1fr' : '310px 1fr',
      gridTemplateAreas: '"top top" "side main"',
      transition: 'grid-template-columns 0.3s ease',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* ── Topbar ── */}
      <header style={{
        gridArea: 'top', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(240,242,245,0.97)', backdropFilter: 'blur(12px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={glypadLogo} alt="GLYPAD Logo" style={{ height: '18px', width: 'auto', display: 'block', objectFit: 'contain' }} />
          <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em', lineHeight: 1.3 }}>
            CAD DRAWING<br />ANALYZER
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', transition: 'all 0.4s', background: apiOnline === null ? 'var(--text-dim)' : apiOnline ? 'var(--success)' : 'var(--error)', boxShadow: apiOnline === true ? `0 0 8px var(--success)` : apiOnline === false ? `0 0 8px var(--error)` : 'none' }} />
          <span>{apiOnline === null ? 'Checking…' : apiOnline ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside style={{
        gridArea: 'side', borderRight: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 0,
        position: 'relative',
      }}>
        {/* Toggle button — always visible */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            style={{
              width: '100%', height: '100%',
              background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            title="Expand sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: isSidebarCollapsed ? 'none' : 'block' }}>

          {/* Collapse button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
              title="Collapse sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.06em' }}>Collapse</span>
            </button>
          </div>

          {/* CAD Upload zone */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>CAD Drawings</SidebarLabel>
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (!loading) addFiles([...e.dataTransfer.files]) }}
              style={{ border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--border-hi)'}`, borderRadius: 'var(--r)', padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: dragOver ? 'var(--accent-dim)' : 'rgba(255,255,255,0.01)', marginBottom: '10px' }}
            >
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif" style={{ display: 'none' }}
                onChange={e => { addFiles([...e.target.files]); e.target.value = '' }} />
              <svg width="30" height="30" viewBox="0 0 36 36" fill="none" stroke={dragOver ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', transition: 'stroke 0.2s' }}>
                <rect x="4" y="5" width="22" height="28" rx="1" />
                <line x1="8" y1="13" x2="22" y2="13" /><line x1="8" y1="19" x2="22" y2="19" /><line x1="8" y1="25" x2="14" y2="25" />
                <circle cx="29" cy="28" r="5" />
                <line x1="29" y1="25.5" x2="29" y2="30.5" /><line x1="26.5" y1="28" x2="31.5" y2="28" />
              </svg>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-hi)', marginBottom: '3px' }}>Drop or click to browse</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>PDF · PNG · JPG · TIFF — max 10</div>
            </div>

            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {files.map(({ file }, i) => {
                  const ext = file.name.split('.').pop().toUpperCase()
                  const isActive = i === activeFi
                  return (
                    <div key={i} onClick={() => setActiveFi(i)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isActive ? 'var(--accent-dim)' : 'var(--panel-hi)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', padding: '7px 10px', fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s', animation: 'slideIn 0.18s ease' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--bg)', background: 'var(--accent)', padding: '1px 5px', borderRadius: '2px', flexShrink: 0 }}>{ext}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <button 
                        onClick={e => { e.stopPropagation(); removeFile(i) }}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-dim)', 
                          cursor: loading ? 'not-allowed' : 'pointer', 
                          padding: '4px', 
                          flexShrink: 0, 
                          pointerEvents: loading ? 'none' : 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '3px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'rgba(192,24,46,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {activePreview && (
              <div style={{ borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--panel-hi)' }}>
                <img src={activePreview} alt="Preview" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '160px' }} />
              </div>
            )}
          </div>

          {/* Org Standard Upload zone */}
          {validationMode !== 'ISO' && (
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <SidebarLabel>Organizational Standard</SidebarLabel>
              <div
                onClick={() => !loading && document.getElementById('stdDocInput').click()}
                style={{ 
                  border: `1px solid var(--border-hi)`, 
                  borderStyle: standardDoc ? 'solid' : 'dashed',
                  borderRadius: 'var(--r)', 
                  padding: '20px 16px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s', 
                  background: standardDoc ? 'var(--panel-hi)' : 'rgba(255,255,255,0.01)' 
                }}
              >
                <input id="stdDocInput" type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                  onChange={e => { if(e.target.files[0]) setStandardDoc(e.target.files[0]); e.target.value = '' }} />
                
                {!standardDoc && (
                  <svg width="30" height="30" viewBox="0 0 36 36" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
                    <path d="M12 4H24L32 12V32C32 33.1046 31.1046 34 30 34H6C4.89543 34 4 33.1046 4 32V6C4 4.89543 4.89543 4 6 4H12Z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M24 4V12H32" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18 16V26" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 20L18 16L22 20" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
 
                {standardDoc ? (
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-dim)' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px', fontFamily: 'var(--mono)' }}>{standardDoc.name}</span>
                    <button 
                      onClick={e => { e.stopPropagation(); setStandardDoc(null); document.getElementById('stdDocInput').value = '' }} 
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-dim)', 
                        cursor: 'pointer', 
                        padding: '4px', 
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'rgba(192,24,46,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-hi)', marginBottom: '3px' }}>Upload Document</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>PDF · DOCX · TXT</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Validation Mode selector */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>Validation Mode</SidebarLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px' }}>
              {[['ISO', 'ISO Only'], ['Org', 'Org Only'], ['Both', 'Both']].map(([val, label]) => (
                <button key={val} onClick={() => setValidationMode(val)} style={{
                  background: validationMode === val ? 'var(--accent-dim)' : 'var(--panel-hi)',
                  border: `1px solid ${validationMode === val ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)', padding: '8px 4px',
                  fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500,
                  color: validationMode === val ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: validationMode === val ? '0 0 12px var(--accent-glow)' : 'none',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Tolerance selector */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <SidebarLabel>ISO 2768 Tolerance</SidebarLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px' }}>
              {[['f', 'Fine'], ['m', 'Medium'], ['c', 'Coarse'], ['v', 'V.Coarse']].map(([val, sub]) => (
                <TolBtn key={val} label={val} sub={sub} active={tolClass === val} onClick={() => setTolClass(val)} />
              ))}
            </div>
          </div>
        </div>

        {/* Analyze button — pinned to bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: isSidebarCollapsed ? 'none' : 'block' }}>
          <button onClick={analyze} disabled={!files.some(f => !f.analyzed) || loading}
            style={{ width: '100%', background: files.some(f => !f.analyzed) && !loading ? 'var(--accent)' : 'var(--panel-hi)', border: 'none', borderRadius: 'var(--r-sm)', color: files.some(f => !f.analyzed) && !loading ? '#ffffff' : 'var(--text-dim)', fontFamily: 'var(--display)', fontSize: '16px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '12px', cursor: files.some(f => !f.analyzed) && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            onMouseEnter={e => { if (files.some(f => !f.analyzed) && !loading) Object.assign(e.currentTarget.style, { background: 'var(--accent-hi)', boxShadow: '0 2px 20px var(--accent-glow)', transform: 'translateY(-1px)' }) }}
            onMouseLeave={e => { e.currentTarget.style.background = files.some(f => !f.analyzed) && !loading ? 'var(--accent)' : 'var(--panel-hi)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
          >
            {loading ? 'Analyzing…' : files.some(f => !f.analyzed) ? `Analyze ${files.filter(f => !f.analyzed).length === files.length ? 'Drawing' : `${files.filter(f => !f.analyzed).length} New File${files.filter(f => !f.analyzed).length > 1 ? 's' : ''}`}` : 'All Analyzed'}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="main-container" style={{ gridArea: 'main', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Multi-result tab bar */}
        {results.length > 1 && (
          <div className="multi-tab-bar" style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)', overflowX: 'auto', flexShrink: 0 }}>
            {results.map((r, i) => {
              const fn = r.data._metadata?.source_file || r.data.drawing_info?.drawing_number || `File ${i + 1}`
              const isActive = i === activeResult
              return (
                <button key={i} onClick={() => !loading && setActiveResult(i)} style={{ fontFamily: 'var(--mono)', fontSize: '14px', letterSpacing: '0.06em', padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`, color: isActive ? 'var(--text-hi)' : 'var(--text-dim)', cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontSize: '8px', background: isActive ? 'var(--accent)' : 'var(--border-hi)', color: isActive ? '#fff' : 'var(--text-dim)', padding: '1px 5px', borderRadius: '2px' }}>{fn.split('.').pop().toUpperCase()}</span>
                  {fn.length > 28 ? fn.slice(0, 26) + '…' : fn}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

          {/* Idle state */}
          {!loading && results.length === 0 && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1">
                <rect x="8" y="4" width="28" height="38" rx="1" />
                <line x1="14" y1="14" x2="30" y2="14" /><line x1="14" y1="21" x2="30" y2="21" /><line x1="14" y1="28" x2="22" y2="28" />
                <circle cx="36" cy="36" r="8" /><line x1="33" y1="36" x2="39" y2="36" /><line x1="36" y1="33" x2="36" y2="39" />
              </svg>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>Upload a drawing and click Analyze</div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ width: '180px', height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '-50%', width: '50%', height: '100%', background: 'linear-gradient(to right, transparent, var(--accent), transparent)', animation: 'scan 1.3s ease-in-out infinite' }} />
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', letterSpacing: '0.1em', color: 'var(--accent)', animation: 'blink 2s ease-in-out infinite' }}>{loadMsg}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>Processing document, please wait</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', padding: '24px' }}>
              <div style={{ background: 'rgba(192,24,46,0.05)', border: '1px solid rgba(192,24,46,0.25)', borderRadius: 'var(--r)', padding: '18px', fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--error)', width: '100%' }}>
                <div style={{ fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.6 }}>Analysis Failed</div>
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
                onTabChange={(tab) => setIsSidebarCollapsed(tab === 'Comparision')}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return <AnalyzerApp />
}

