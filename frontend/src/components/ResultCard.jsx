import { useState, useEffect } from 'react'
import ImageViewer from './ImageViewer'
import { logActivity } from '../api/activityApi'

/* ── Utilities ────────────────────────────────────────────────────────────── */
function toStr(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return Object.values(v).filter(x => x && x !== 'null').join(' · ')
  return String(v)
}

/* ── Badge ────────────────────────────────────────────────────────────────── */
function Badge({ children, color }) {
  const palette = {
    blue:   { color: 'var(--info)',    border: 'rgba(29,95,180,0.22)',   bg: 'var(--info-dim)' },
    amber:  { color: 'var(--warn)',    border: 'rgba(180,83,9,0.22)',    bg: 'var(--warn-dim)' },
    green:  { color: 'var(--success)', border: 'rgba(14,124,74,0.22)',   bg: 'var(--success-dim)' },
    red:    { color: 'var(--error)',   border: 'rgba(192,24,46,0.22)',   bg: 'var(--error-dim)' },
    orange: { color: 'var(--warn)',    border: 'rgba(180,83,9,0.22)',    bg: 'var(--warn-dim)' },
  }
  const c = palette[color] || palette.blue
  return (
    <span className="badge" style={{ color: c.color, borderColor: c.border, background: c.bg }}>
      {children}
    </span>
  )
}

/* ── Section label ────────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

/* ── Info grid ────────────────────────────────────────────────────────────── */
function InfoGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 8 }}>
      {children}
    </div>
  )
}

/* ── Info cell ────────────────────────────────────────────────────────────── */
function InfoCell({ label, value }) {
  if (!value || value === 'null' || value === 'N/A' || value === 'Not specified') return null
  return (
    <div className="info-cell">
      <div className="info-cell-label">{label}</div>
      <div className="info-cell-value">{value}</div>
    </div>
  )
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
function EmptyState({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)',
      fontSize: 13,
      color: 'var(--text-faint)',
      letterSpacing: '0.08em',
      textAlign: 'center',
      padding: '36px 24px',
      border: '1px dashed var(--border)',
      borderRadius: 'var(--r)',
      background: 'var(--panel-hi)',
    }}>
      {children}
    </div>
  )
}

/* ── OCR warning ──────────────────────────────────────────────────────────── */
function OcrWarning({ warning }) {
  if (!warning) return null
  return (
    <div style={{
      background: 'var(--warn-dim)',
      border: '1px solid rgba(180,83,9,0.2)',
      borderLeft: '3px solid var(--warn)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--mono)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--warn)',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        OCR Warning
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {warning}
      </div>
      <div style={{
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-dim)',
        lineHeight: 1.8,
      }}>
        <strong style={{ color: 'var(--text)' }}>Suggested actions:</strong><br />
        · Install the native Tesseract OCR binary on the host machine<br />
        · Set <code>TESSERACT_CMD</code> if the binary is not on PATH<br />
        · The OpenCV pixel diff still shows visual changes<br />
        · Retry with a higher-resolution scan if OCR confidence is low
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Tab components
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Overview tab ─────────────────────────────────────────────────────────── */
function OverviewTab({ info, stds, conc, genTol }) {
  const labelMap = {
    title: 'Title', part_number: 'Part No.', material: 'Material',
    scale: 'Scale', revision: 'Revision', drawing_number: 'Drawing No.',
    date: 'Date', author: 'Author', total_pages: 'Pages',
  }
  const genTolStandard = genTol?.standard || ''
  const genTolRanges   = genTol?.ranges || []

  return (
    <div>
      <SectionLabel>Drawing Information</SectionLabel>
      <InfoGrid>
        {Object.entries(info).map(([k, v]) => (
          <InfoCell key={k} label={labelMap[k] || k.replace(/_/g, ' ')} value={toStr(v)} />
        ))}
      </InfoGrid>

      {stds.length > 0 && (
        <>
          <SectionLabel>Referenced Standards</SectionLabel>
          <InfoGrid>
            {stds.map((s, i) => {
              const name = typeof s === 'object' ? (s.standard || s.name || toStr(s)) : String(s)
              const desc = typeof s === 'object' ? (s.description || s.application || '') : ''
              return (
                <div key={i} className="info-cell">
                  <div className="info-cell-value">{name}</div>
                  {desc && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{desc}</div>}
                </div>
              )
            })}
          </InfoGrid>
        </>
      )}

      {conc?.summary && (
        <>
          <SectionLabel>Conclusions</SectionLabel>
          <div style={{
            background: 'rgba(15,25,41,0.025)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--r-sm)',
            padding: '14px 16px',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            fontFamily: 'var(--body)',
          }}>
            {conc.summary}
          </div>
        </>
      )}

      {(genTolStandard || genTolRanges.length > 0) && (
        <>
          <SectionLabel>
            Generic Tolerances{genTolStandard ? ` · ${genTolStandard}` : ''}
          </SectionLabel>
          <InfoGrid>
            {genTolRanges.map((r, i) => (
              <InfoCell key={i} label={String(r.range ?? r.size_range ?? '')} value={String(r.tolerance ?? r.value ?? '')} />
            ))}
          </InfoGrid>
        </>
      )}
    </div>
  )
}

/* ── Dimensions tab ───────────────────────────────────────────────────────── */
function DimensionsTab({ dims, validationMode }) {
  if (!dims.length) return <EmptyState>No dimensions extracted from this drawing</EmptyState>

  const reasonHeader =
    validationMode === 'Org'  ? 'Reason (Org Standard)'  :
    validationMode === 'Both' ? 'Reason (ISO / Org)'     : 'Reason (ISO Standard)'

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Dimension</th>
            <th>Tolerance</th>
            <th>Critical</th>
            <th style={{ width: '38%' }}>{reasonHeader}</th>
          </tr>
        </thead>
        <tbody>
          {dims.map((d, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text)' }}>{toStr(d.feature ?? d.type) || '—'}</td>
              <td style={{ color: 'var(--text-hi)', fontWeight: 600 }}>{toStr(d.dimension ?? d.value) || '—'}</td>
              <td style={{ color: 'var(--info)' }}>{toStr(d.tolerance) || '—'}</td>
              <td>
                {d.is_critical ? (
                  <span className="status-chip" style={{
                    color: 'var(--error)',
                    background: 'var(--error-dim)',
                    border: '1px solid rgba(192,24,46,0.22)',
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                    Critical
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>—</span>
                )}
              </td>
              <td style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>
                {d.is_critical ? (d.critical_reason || '') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── GD&T tab ─────────────────────────────────────────────────────────────── */
function GdtTab({ gdts, notes }) {
  return (
    <div>
      {gdts.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {gdts.map((g, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              boxShadow: 'var(--shadow-xs)',
              transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)' }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{g.symbol ?? ''}</span>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-hi)', fontWeight: 600 }}>
                  {toStr(g.name ?? g.type)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                  {toStr(g.value ?? g.tolerance)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No GD&T symbols identified in this drawing</EmptyState>
      )}

      {notes.length > 0 && (
        <>
          <SectionLabel>Drawing Notations</SectionLabel>
          {notes.map((n, i) => {
            const txt   = typeof n === 'string' ? n : toStr(n.notation ?? n.text ?? n)
            const interp = typeof n === 'object' ? toStr(n.interpretation ?? '') : ''
            return (
              <div key={i} style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                padding: '11px 14px',
                marginBottom: 6,
                fontFamily: 'var(--mono)',
                fontSize: 14,
                lineHeight: 1.6,
                boxShadow: 'var(--shadow-xs)',
              }}>
                <div style={{ color: 'var(--text-hi)', fontWeight: 500 }}>{txt}</div>
                {interp && <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 4 }}>→ {interp}</div>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── Manufacturing tab ────────────────────────────────────────────────────── */
function ManufacturingTab({ gauge, mfg }) {
  const gaugeReq  = gauge?.required || gauge?.requires_go_nogo || false
  const gaugeDims = gauge?.dimensions_needing_gauges || gauge?.dimensions || []

  const mfgCells = Object.entries(mfg || {}).map(([k, v]) => {
    let val
    if (Array.isArray(v)) {
      if (!v.length) return null
      val = v.map(item =>
        typeof item === 'object'
          ? Object.entries(item).map(([ik, iv]) => iv && iv !== 'Unknown' && iv !== 'null' ? `${ik}: ${iv}` : '').filter(Boolean).join(' · ')
          : String(item)
      ).filter(Boolean).join('; ')
    } else {
      val = v && String(v) !== 'null' ? String(v) : ''
    }
    if (!val) return null
    return { key: k, val }
  }).filter(Boolean)

  return (
    <div>
      <SectionLabel>Gauge Requirements</SectionLabel>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--panel)',
        border: `1px solid ${gaugeReq ? 'rgba(180,83,9,0.25)' : 'rgba(14,124,74,0.2)'}`,
        borderLeft: `3px solid ${gaugeReq ? 'var(--warn)' : 'var(--success)'}`,
        borderRadius: 'var(--r-sm)',
        padding: '14px 16px',
        marginBottom: 14,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          background: gaugeReq ? 'var(--warn)' : 'var(--success)',
          boxShadow: `0 0 10px ${gaugeReq ? 'rgba(180,83,9,0.4)' : 'var(--success-glow)'}`,
        }} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
          {gaugeReq ? 'Go/No-Go gauges required' : 'No gauge requirements detected'}
          {gaugeDims.length > 0 && (
            <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>
              Applies to: {gaugeDims.join(', ')}
            </div>
          )}
        </div>
      </div>

      {mfgCells.length > 0 ? (
        <>
          <SectionLabel>Requirements</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mfgCells.map(({ key, val }) => (
              <div key={key} style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xs)',
              }}>
                <div style={{
                  padding: '9px 12px',
                  borderRight: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  background: 'var(--panel-hi)',
                }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ padding: '9px 14px', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-hi)', lineHeight: 1.5 }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState>No additional manufacturing requirements detected</EmptyState>
      )}
    </div>
  )
}

/* ── Drawing tab ──────────────────────────────────────────────────────────── */
function DrawingTab({ previewUrl, isPdf }) {
  if (!previewUrl && !isPdf) return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      height: '100%',
      minHeight: 320,
      color: 'var(--text-faint)',
      fontFamily: 'var(--mono)',
      fontSize: 14,
      letterSpacing: '0.06em',
    }}>
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1.2">
        <rect x="8" y="4" width="28" height="38" rx="1" />
        <line x1="14" y1="14" x2="30" y2="14" />
        <line x1="14" y1="21" x2="30" y2="21" />
        <line x1="14" y1="28" x2="22" y2="28" />
      </svg>
      No preview available
    </div>
  )
  return (
    <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <ImageViewer src={previewUrl} isPdf={isPdf} isTab />
    </div>
  )
}

/* ── Visual audit tab ─────────────────────────────────────────────────────── */
function VisualAuditTab({ previewUrl, isPdf, processedImage, visualMarkup }) {
  const [selectedIdx, setSelectedIdx] = useState(null)

  const src = previewUrl || processedImage
  if (!src && !isPdf) return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      height: '100%',
      minHeight: 320,
      color: 'var(--text-faint)',
      fontFamily: 'var(--mono)',
      fontSize: 14,
    }}>
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1.2">
        <rect x="8" y="4" width="28" height="38" rx="1" />
      </svg>
      No visual audit data available
    </div>
  )

  const highlights = selectedIdx !== null && visualMarkup?.[selectedIdx]
    ? [visualMarkup[selectedIdx]]
    : (visualMarkup || [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, height: '100%', minHeight: 500 }}>
      {/* Left — Image */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        background: 'var(--panel-hi)',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <ImageViewer src={src} isPdf={isPdf && !processedImage} isTab highlights={highlights} />
      </div>

      {/* Right — Audit list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 2 }}>
        <div style={{
          fontFamily: 'var(--display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-hi)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}>
          Quality Audit Report
        </div>

        {selectedIdx !== null && (
          <button
            onClick={() => setSelectedIdx(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--r-sm)',
              padding: '5px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'background var(--t-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,78,216,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Show all highlights
          </button>
        )}

        {visualMarkup?.length > 0 ? visualMarkup.map((item, i) => {
          const isSelected = selectedIdx === i
          const isValid    = item.status === 'valid'
          const color      = isValid ? 'var(--success)' : 'var(--error)'
          const colorDim   = isValid ? 'rgba(14,124,74,0.2)' : 'rgba(192,24,46,0.2)'
          const colorBg    = isValid ? 'var(--success-dim)' : 'var(--error-dim)'
          return (
            <div
              key={i}
              onClick={() => setSelectedIdx(prev => prev === i ? null : i)}
              style={{
                borderTop: `1px solid ${isSelected ? color : colorDim}`,
                borderRight: `1px solid ${isSelected ? color : colorDim}`,
                borderBottom: `1px solid ${isSelected ? color : colorDim}`,
                borderLeft: `3px solid ${color}`,
                background: isSelected ? colorBg : 'var(--panel)',
                borderRadius: 'var(--r-sm)',
                padding: 14,
                boxShadow: isSelected ? `0 0 0 2px ${colorDim}` : 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: 'all var(--t-base)',
                transform: isSelected ? 'scale(1.01)' : 'scale(1)',
              }}
              onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = colorDim; e.currentTarget.style.transform = 'scale(1.005)' } }}
              onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'scale(1)' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                  )}
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.3 }}>
                    {item.label}
                  </div>
                </div>
                <span className="status-chip" style={{
                  color,
                  background: colorBg,
                  border: `1px solid ${colorDim}`,
                  marginLeft: 6,
                  flexShrink: 0,
                }}>
                  {item.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {item.reason}
              </div>
              {!isSelected && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-faint)', marginTop: 6, opacity: 0.7 }}>
                  Click to highlight in drawing
                </div>
              )}
            </div>
          )
        }) : <EmptyState>No critical issues or title block errors detected.</EmptyState>}
      </div>
    </div>
  )
}

/* ── Report tab ───────────────────────────────────────────────────────────── */
function ReportTab({ report, info = {}, dims = [], gdts = [], mfg = {}, gauge = {}, critCount = 0, validationMode = 'ISO', genTol = {}, filename = '' }) {
  const handlePrint = () => window.print()

  const renderInline = (text) => {
    const cleanText = String(text ?? '').replace(/^[·•*-]+\**/g, '')
    const parts = cleanText.split(/(\*\*[^*]+\*\*|\*\*[^*:]+:)/g)
    return parts.filter(Boolean).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} style={{ color: 'var(--text-hi)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      if (/^\*\*[^*:]+:$/.test(part)) return <strong key={i} style={{ color: 'var(--text-hi)', fontWeight: 700 }}>{part.slice(2)}</strong>
      return <span key={i}>{part}</span>
    })
  }

  const sourceLines = report.split('\n')
  const lines = []
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i]
    const trimmed = line.trim()
    if ((trimmed === '·' || trimmed === '-' || trimmed === '*' || trimmed === '•') && i + 1 < sourceLines.length) {
      const next = sourceLines[i + 1].trim()
      if (next) { lines.push(`${trimmed} ${next}`); i += 1; continue }
    }
    lines.push(line)
  }

  const sections = []
  let current = null
  for (const raw of lines) {
    let line = raw.trimEnd()
    if (/^={4,}/.test(line) || /^-{4,}/.test(line)) continue
    line = line.replace(/^[·•*-]*\*+(\d+)\.\s+(.+?)\*+$/, '$1. $2')
    const markdownHeading = line.match(/^(#{1,6})\s+(.+)/)
    if (markdownHeading) {
      current = { title: markdownHeading[2].trim().replace(/\*+$/, ''), rows: [], num: null, isTitle: markdownHeading[1].length === 1, headingLevel: markdownHeading[1].length }
      sections.push(current); continue
    }
    const headMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (headMatch) { current = { title: headMatch[2].trim().replace(/\*+$/, ''), rows: [], num: headMatch[1] }; sections.push(current); continue }
    if (!current && line && line === line.toUpperCase() && line.length > 3 && !/^\d/.test(line)) {
      current = { title: line.trim().replace(/\*+$/, ''), rows: [], isTitle: true }; sections.push(current); continue
    }
    if (current) { current.rows.push(line) }
    else { if (!sections.length || !sections[0].isPreamble) sections.unshift({ isPreamble: true, rows: [] }); sections[0].rows.push(line) }
  }
  sections.forEach(s => {
    while (s.rows.length && !s.rows[s.rows.length - 1].trim()) s.rows.pop()
    while (s.rows.length && !s.rows[0].trim()) s.rows.shift()
  })

  const renderRows = (rows) => rows.map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 5 }} />
    const dimMatch = line.match(/^\s{2,}(.+?):\s(.+?)\s[–-]\s(.+)$/)
    if (dimMatch) {
      const isCrit = line.includes('[CRITICAL]')
      return (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: 12,
          padding: '5px 12px',
          background: isCrit ? 'rgba(192,24,46,0.04)' : 'transparent',
          borderLeft: `2px solid ${isCrit ? 'var(--error)' : 'transparent'}`,
          alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>{dimMatch[1]}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-hi)', fontWeight: 600 }}>{dimMatch[2]}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: isCrit ? 'var(--error)' : 'var(--info)' }}>
            {dimMatch[3].replace('[CRITICAL]', '').trim()}
            {isCrit && <span style={{ marginLeft: 6, fontSize: 12 }}>⚑</span>}
          </span>
        </div>
      )
    }

    if (/^\s*[-•*–→]\s*/.test(line)) {
      const text = line.replace(/^\s*[-•*–→]\s*/, '')
      return (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 12px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontFamily: 'var(--mono)' }}>·</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{renderInline(text)}</span>
        </div>
      )
    }

    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/)
    if (orderedMatch) {
      return (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 12px', alignItems: 'flex-start' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {orderedMatch[1]}
          </span>
          <span style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
            {renderInline(orderedMatch[2])}
          </span>
        </div>
      )
    }

    return (
      <div key={i} style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--text)', padding: '2px 12px', lineHeight: 1.7 }}>
        {renderInline(line)}
      </div>
    )
  })

  const hasMissingGenTol = report.toLowerCase().includes('absence') && report.toLowerCase().includes('general tolerance')
  const isCompliant = critCount === 0 && !hasMissingGenTol

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media print {
          html, body, #root { height: auto !important; overflow: visible !important; background: #ffffff !important; }
          .app-container, .main-container, .result-wrapper, .result-card-container, .tab-content-container { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; position: static !important; display: block !important; border: none !important; background: transparent !important; box-shadow: none !important; }
          header, aside, .multi-tab-bar, .result-header, .result-tab-bar, .no-print { display: none !important; }
          #glypad-report-print-container { position: static !important; width: 100% !important; padding: 0 !important; box-shadow: none !important; border: none !important; background: white !important; color: #000 !important; display: flex !important; flex-direction: column !important; gap: 20px !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>

      {/* Print toolbar */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        padding: '10px 14px',
        background: 'var(--panel-hi)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            QA Compliance Report Ready
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="btn btn-ghost"
          style={{ padding: '5px 12px', fontSize: 10 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print All
        </button>
      </div>

      {/* Report body */}
      <div
        id="glypad-report-print-container"
        style={{
          background: '#ffffff',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '36px 40px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Accent stripe */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, var(--accent), var(--info))',
          margin: '-36px -40px 10px -40px',
          borderRadius: 'var(--r) var(--r) 0 0',
        }} />

        {/* Report header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid var(--text-hi)',
          paddingBottom: 12,
          gap: 20,
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-hi)', fontFamily: 'var(--mono)' }}>GLYPAD METROLOGY SYSTEMS</div>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Automated QA &amp; Metrological Verification</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-hi)', fontFamily: 'var(--mono)' }}>METROLOGICAL COMPLIANCE REPORT</div>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--mono)' }}>Ref: GLY-{(info.part_number || '2022001').replace(/\s+/g, '')}-A</div>
          </div>
        </div>

        {/* Title block */}
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--mono)' }}>
            Drawing Title Block Data
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1.5px solid var(--text)', background: '#ffffff' }}>
            {[
              ['Drawing Title',       info.title || filename || 'N/A'],
              ['Drawing Number',      info.drawing_number || 'N/A'],
              ['Part Number',         info.part_number || 'N/A'],
              ['Revision',            info.revision || 'A'],
              ['Material',            info.material || 'N/A'],
              ['Scale',               info.scale || 'N/A'],
              ['Validation Standard', validationMode === 'Both' ? 'ISO / Org Std' : `${validationMode} Standard`],
              ['Date of Review',      info.date || new Date().toLocaleDateString()],
            ].map(([label, value], idx) => (
              <div key={label} style={{
                borderRight: idx % 4 < 3 ? '1px solid var(--text)' : 'none',
                borderBottom: idx < 4 ? '1px solid var(--text)' : 'none',
                padding: '8px 12px',
              }}>
                <div style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600, letterSpacing: '0.06em', fontFamily: 'var(--mono)', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Dimensions Checked', value: dims.length,   color: null, bg: 'var(--panel-hi)' },
            { label: 'Critical Features',  value: critCount,      color: critCount > 0 ? 'var(--error)' : null, bg: critCount > 0 ? 'var(--error-dim)' : 'var(--panel-hi)', border: critCount > 0 ? 'rgba(192,24,46,0.15)' : null },
            { label: 'General Tolerance',  value: genTol.standard || (hasMissingGenTol ? 'Missing' : 'None'), color: hasMissingGenTol ? 'var(--warn)' : 'var(--success)', bg: hasMissingGenTol ? 'var(--warn-dim)' : 'var(--success-dim)', border: hasMissingGenTol ? 'rgba(180,83,9,0.15)' : 'rgba(14,124,74,0.15)', small: true },
            { label: 'Verification Status', value: isCompliant ? '✓ CONFORMING' : '⚠ ACTION REQUIRED', color: isCompliant ? 'var(--success)' : 'var(--error)', bg: isCompliant ? 'var(--success-dim)' : 'var(--error-dim)', border: isCompliant ? 'rgba(14,124,74,0.15)' : 'rgba(192,24,46,0.15)', small: true },
          ].map(({ label, value, color, bg, border, small }) => (
            <div key={label} style={{
              padding: '12px 16px',
              background: bg || 'var(--panel-hi)',
              border: `1px solid ${border || 'var(--border)'}`,
              borderRadius: 'var(--r-sm)',
            }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', color: color || 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: small ? 13 : 24, fontWeight: 800, color: color || 'var(--text-hi)', lineHeight: 1, marginTop: small ? 10 : 0 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Narrative */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px 24px', background: '#ffffff' }}>
          <div style={{ borderBottom: '1.5px solid var(--text-hi)', paddingBottom: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-hi)' }}>
              1.0 Metrological Narrative &amp; Executive Analysis
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.filter(s => s.rows.length || s.title).map((sec, si) => {
              if (sec.isPreamble) return (
                <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sec.rows.filter(r => r.trim()).map((r, i) => (
                    <p key={i} style={{ margin: 0, fontFamily: 'var(--body)', fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
                      {renderInline(r)}
                    </p>
                  ))}
                </div>
              )
              return (
                <div key={si} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--panel-hi)', marginTop: 4 }}>
                  {sec.title && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
                      {sec.num && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 17,
                          height: 17,
                          borderRadius: 'var(--r-xs)',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontFamily: 'var(--mono)',
                          fontSize: 9,
                          fontWeight: 700,
                        }}>
                          {sec.num}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {sec.title}
                      </span>
                    </div>
                  )}
                  <div style={{ padding: '8px 6px' }}>{renderRows(sec.rows)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Comparison Tab
   ══════════════════════════════════════════════════════════════════════════ */
export function ComparisionTab({ previewUrl, originalFile, originalDims = [], standalone = false }) {
  const [leftFile, setLeftFile]       = useState(originalFile || null)
  const [leftPreview, setLeftPreview] = useState(previewUrl || null)
  const [comparedFile, setComparedFile] = useState(null)
  const [isComparing, setIsComparing] = useState(false)
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const [dragOverL, setDragOverL]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const [rightView, setRightView]     = useState('highlighted')
  const [filter, setFilter]           = useState('all')
  const [zoomL, setZoomL]             = useState(100)
  const [zoomR, setZoomR]             = useState(100)

  useEffect(() => {
    if (!standalone) { setLeftFile(originalFile); setLeftPreview(previewUrl) }
  }, [originalFile, previewUrl, standalone])

  const fileMeta = (file) => ({
    fileName: file?.name,
    fileType: file?.name?.split('.').pop()?.toLowerCase() || file?.type,
    fileSize: file?.size,
    uploadTimestamp: new Date().toISOString(),
  })

  const runComparison = async (f1, f2) => {
    if (!f1) { setError('Original file is not available.'); return }
    if (!f2) { setError('Comparison file is not available.'); return }
    setIsComparing(true); setError(null); setResult(null); setRightView('highlighted')
    logActivity('COMPARISON_STARTED', { originalDrawing: f1.name, comparisonDrawing: f2.name })
    try {
      const fd = new FormData()
      fd.append('file1', f1); fd.append('file2', f2)
      const res = await fetch('/compare', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      if (!data.success) throw new Error(data.error || 'Comparison failed')
      setResult(data)
      logActivity('COMPARISON_COMPLETED', {
        originalDrawing: f1.name, comparisonDrawing: f2.name,
        totalDifferences: data.summary?.total_items || 0,
        addedCount: data.summary?.added || 0,
        removedCount: data.summary?.removed || 0,
        changedCount: data.summary?.changed || 0,
        deviatedCount: data.summary?.deviations || 0,
      })
    } catch (e) { setError(e.message) }
    finally { setIsComparing(false) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) { setComparedFile(files[0]); runComparison(leftFile, files[0]) }
  }

  const handleBrowse = () => {
    if (isComparing) return
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'image/*,.pdf'
    inp.onchange = (e) => { if (e.target.files.length > 0) { setComparedFile(e.target.files[0]); runComparison(leftFile, e.target.files[0]) } }
    inp.click()
  }

  const handleDropL = (e) => {
    e.preventDefault(); setDragOverL(false)
    if (!standalone) return
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setLeftFile(files[0]); setLeftPreview(URL.createObjectURL(files[0]))
      if (comparedFile) runComparison(files[0], comparedFile)
    }
  }

  const handleBrowseL = () => {
    if (isComparing || !standalone) return
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'image/*,.pdf'
    inp.onchange = (e) => {
      if (e.target.files.length > 0) {
        setLeftFile(e.target.files[0]); setLeftPreview(URL.createObjectURL(e.target.files[0]))
        if (comparedFile) runComparison(e.target.files[0], comparedFile)
      }
    }
    inp.click()
  }

  const rows         = result?.comparison_rows || []
  const filteredRows = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const statusCounts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})

  const rightSrc = (() => {
    if (!result) return null
    if (rightView === 'highlighted') return result.highlighted_image_base64
    if (rightView === 'diff')        return result.diff_image_base64
    return comparedFile ? URL.createObjectURL(comparedFile) : null
  })()

  const monoSm = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em' }

  const statusStyle = (s) => ({
    match:     { color: 'var(--success)', bg: 'var(--success-dim)', border: 'rgba(14,124,74,0.25)' },
    deviation: { color: 'var(--warn)',    bg: 'var(--warn-dim)',    border: 'rgba(180,83,9,0.25)' },
    added:     { color: 'var(--info)',    bg: 'var(--info-dim)',    border: 'rgba(29,95,180,0.25)' },
    removed:   { color: 'var(--error)',   bg: 'var(--error-dim)',   border: 'rgba(192,24,46,0.25)' },
    changed:   { color: 'var(--warn)',    bg: 'var(--warn-dim)',    border: 'rgba(180,83,9,0.25)' },
  }[s] || { color: 'var(--success)', bg: 'var(--success-dim)', border: 'rgba(14,124,74,0.25)' })

  const statusIcon = (s) => ({ match: '✓', deviation: '⚠', added: '+', removed: '−', changed: '→' }[s] || '?')

  const ZoomBar = ({ zoom, setZoom }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setZoom(z => Math.max(20, z - 20))} className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 13 }}>−</button>
      <span style={{ ...monoSm, color: 'var(--text-faint)', minWidth: 38, textAlign: 'center' }}>{zoom}%</span>
      <button onClick={() => setZoom(z => Math.min(400, z + 20))} className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 13 }}>+</button>
    </div>
  )

  const FilterChip = ({ value, label, count }) => {
    const active = filter === value
    const st = value === 'all'
      ? { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'var(--accent)' }
      : statusStyle(value)
    return (
      <button
        onClick={() => { setFilter(value); logActivity(`FILTER_${value.toUpperCase()}_SELECTED`) }}
        style={{
          ...monoSm,
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 'var(--r-xs)',
          border: `1px solid ${active ? st.border || 'var(--accent)' : 'var(--border)'}`,
          background: active ? st.bg || 'var(--accent-dim)' : 'transparent',
          color: active ? st.color || 'var(--accent)' : 'var(--text-faint)',
          cursor: 'pointer',
          transition: 'all var(--t-fast)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}{count !== undefined ? ` (${count})` : ''}
      </button>
    )
  }

  const ViewChip = ({ value, label }) => {
    const active = rightView === value
    return (
      <button
        onClick={() => setRightView(value)}
        style={{
          ...monoSm,
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 'var(--r-xs)',
          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          background: active ? 'var(--accent-dim)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--text-faint)',
          cursor: 'pointer',
          transition: 'all var(--t-fast)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </button>
    )
  }

  const PaneHeader = ({ label, children }) => (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
      flexWrap: 'wrap',
      gap: 8,
      background: 'var(--panel-hi)',
    }}>
      <span style={{ ...monoSm, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  )

  const DropOverlay = ({ text }) => (
    <div style={{ textAlign: 'center', paddingTop: 80, pointerEvents: 'none' }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ margin: '0 auto 12px', display: 'block' }}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <div style={{ ...monoSm, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{text}</div>
      <div style={{ ...monoSm, color: 'var(--text-faint)', marginTop: 4, opacity: 0.5, fontSize: 10 }}>or click to browse</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Split pane */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 420 }}>
        {/* LEFT — Original */}
        <div
          className={dragOverL ? 'drop-zone drag-over' : ''}
          onDragOver={e => { e.preventDefault(); if (standalone && !isComparing) setDragOverL(true) }}
          onDragLeave={() => setDragOverL(false)}
          onDrop={handleDropL}
          style={{
            border: `1.5px ${dragOverL ? 'solid' : (standalone && !leftPreview ? 'dashed' : 'solid')} ${dragOverL ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--r)',
            background: dragOverL ? 'var(--accent-dim)' : 'var(--panel)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
            transition: 'border-color var(--t-base), background var(--t-base)',
          }}
        >
          <PaneHeader label="Original Drawing">
            {leftPreview && <ZoomBar zoom={zoomL} setZoom={setZoomL} />}
            {standalone && (
              <button onClick={handleBrowseL} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10 }}>
                {leftPreview ? 'Upload New' : 'Browse'}
              </button>
            )}
          </PaneHeader>
          <div
            style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', cursor: standalone && !leftPreview && !isComparing ? 'pointer' : 'default' }}
            onClick={() => { if (standalone && !leftPreview && !isComparing) handleBrowseL() }}
          >
            {leftPreview
              ? <img src={leftPreview} alt="Original" style={{ width: `${zoomL}%`, objectFit: 'contain', display: 'block' }} />
              : standalone ? <DropOverlay text="Drop original drawing here" /> : <div style={{ ...monoSm, color: 'var(--text-faint)', margin: 'auto', paddingTop: 80 }}>No preview available</div>
            }
          </div>
        </div>

        {/* RIGHT — Comparison */}
        <div
          onDragOver={e => { e.preventDefault(); if (!isComparing) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px ${dragOver ? 'solid' : result ? 'solid' : 'dashed'} ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--r)',
            background: dragOver ? 'var(--accent-dim)' : 'var(--panel)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: 'var(--shadow-xs)',
            transition: 'border-color var(--t-base), background var(--t-base)',
          }}
        >
          <PaneHeader label="Comparison Drawing">
            {result && (
              <div style={{ display: 'flex', gap: 4 }}>
                <ViewChip value="highlighted" label="Highlights" />
                <ViewChip value="original"    label="Raw" />
                <ViewChip value="diff"        label="Pixel Diff" />
              </div>
            )}
            {result && <ZoomBar zoom={zoomR} setZoom={setZoomR} />}
            <button onClick={handleBrowse} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 10 }}>
              {result ? 'Upload New' : 'Browse'}
            </button>
          </PaneHeader>

          <div
            style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', cursor: !result && !isComparing ? 'pointer' : 'default' }}
            onClick={() => { if (!result && !isComparing) handleBrowse() }}
          >
            {rightSrc ? (
              <img src={rightSrc} alt="Comparison" style={{ width: `${zoomR}%`, objectFit: 'contain', display: 'block', opacity: isComparing ? 0.2 : 1, transition: 'opacity 0.2s' }} />
            ) : !isComparing ? (
              <DropOverlay text="Drop revised drawing here" />
            ) : null}
          </div>

          {/* Highlight legend */}
          {result && rightView === 'highlighted' && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, flexWrap: 'wrap', flexShrink: 0, background: 'var(--panel-hi)' }}>
              {[
                { colour: 'rgb(249,115,22)',  label: 'Deviation' },
                { colour: 'rgb(34,197,94)',   label: 'Added' },
                { colour: 'rgb(59,130,246)',  label: 'Removed' },
                { colour: 'rgb(234,179,8)',   label: 'Changed' },
              ].map(({ colour, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: colour, flexShrink: 0 }} />
                  <span style={{ ...monoSm, color: 'var(--text-faint)', textTransform: 'uppercase', fontSize: 10 }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading overlay */}
          {isComparing && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(240,242,245,0.85)',
              backdropFilter: 'blur(4px)',
              gap: 14,
              zIndex: 10,
            }}>
              <div className="loading-track">
                <div className="loading-bar" />
              </div>
              <div style={{ ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Extracting &amp; comparing all dimensions
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'var(--error-dim)',
          border: '1px solid rgba(192,24,46,0.3)',
          borderLeft: '3px solid var(--error)',
          borderRadius: 'var(--r)',
          padding: '13px 16px',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          color: 'var(--error)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7, marginBottom: 4 }}>Comparison Failed</div>
          {error}
        </div>
      )}

      {/* OCR warning */}
      <OcrWarning warning={result?.ocr_warning} />

      {/* Comparison table */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ ...monoSm, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
              Dimensions Comparison
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--border-lo)' }} />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <FilterChip value="all"       label="All"       count={rows.length} />
              <FilterChip value="deviation" label="Deviation" count={statusCounts.deviation || 0} />
              <FilterChip value="added"     label="Added"     count={statusCounts.added || 0} />
              <FilterChip value="removed"   label="Removed"   count={statusCounts.removed || 0} />
              <FilterChip value="changed"   label="Changed"   count={statusCounts.changed || 0} />
              <FilterChip value="match"     label="Match"     count={statusCounts.match || 0} />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-xs)' }}>
            <table className="data-table" style={{ background: 'var(--panel)', tableLayout: 'fixed', minWidth: 760 }}>
              <thead>
                <tr>
                  {[
                    ['#', '4%'], ['Feature', '16%'], ['Type', '10%'],
                    ['Orig Val', '11%'], ['Rev Val', '11%'],
                    ['Orig Tol', '11%'], ['Rev Tol', '11%'],
                    ['Change', '15%'], ['Status', '11%'],
                  ].map(([label, width]) => (
                    <th key={label} style={{ width }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => {
                  const st = statusStyle(row.status)
                  return (
                    <tr key={i} style={{ background: i % 2 !== 0 ? 'var(--panel-hi)' : 'transparent' }}>
                      <td style={{ color: 'var(--text-faint)', textAlign: 'center', wordBreak: 'break-word' }}>{i + 1}</td>
                      <td style={{ color: 'var(--text-hi)', fontWeight: 600, wordBreak: 'break-word' }}>{row.feature || '—'}</td>
                      <td style={{ color: 'var(--text-faint)', wordBreak: 'break-word' }}>{row.type || '—'}</td>
                      <td style={{ wordBreak: 'break-word' }}>{row.original_value || '—'}</td>
                      <td style={{ color: row.status !== 'match' ? st.color : 'var(--text)', fontWeight: row.status !== 'match' ? 600 : 400, wordBreak: 'break-word' }}>
                        {row.compared_value || '—'}
                      </td>
                      <td style={{ color: 'var(--info)', wordBreak: 'break-word' }}>{row.original_tolerance || '—'}</td>
                      <td style={{ color: row.original_tolerance !== row.compared_tolerance && row.status !== 'match' ? st.color : 'var(--info)', fontWeight: row.original_tolerance !== row.compared_tolerance && row.status !== 'match' ? 600 : 400, wordBreak: 'break-word' }}>
                        {row.compared_tolerance || '—'}
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {row.change_description && row.change_description !== 'No change'
                          ? row.change_description
                          : <span style={{ opacity: 0.35 }}>—</span>
                        }
                      </td>
                      <td style={{ wordBreak: 'break-word' }}>
                        <span className="status-chip" style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                          {statusIcon(row.status)} {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      No rows match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ ...monoSm, color: 'var(--text-faint)', textTransform: 'uppercase', textAlign: 'right', fontSize: 10 }}>
            Showing {filteredRows.length} of {rows.length} items
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !isComparing && !error && (
        <div style={{
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r)',
          padding: '32px 24px',
          textAlign: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 2,
          background: 'var(--panel-hi)',
        }}>
          Upload a revised drawing in the right pane to begin the comparison.<br />
          <span style={{ opacity: 0.55, fontSize: 11 }}>
            Tesseract OCR extracts every dimension, tolerance, GD&amp;T symbol and annotation from both drawings
            and highlights all changes on the revised image. A pixel-level diff overlay is also produced.
          </span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Result Card
   ══════════════════════════════════════════════════════════════════════════ */
const TABS = ['Overview', 'Visual Audit', 'Dimensions', 'GD&T', 'Manufacturing', 'Drawing', 'Report']

export default function ResultCard({ data, previewUrl, isPdf: isPdfProp = false, validationMode = 'ISO', onTabChange, originalFile }) {
  const [activeTab, setActiveTab] = useState('Overview')

  if (data?.error) {
    const sourceFile = data?._metadata?.source_file || data?.filename || 'Drawing'
    return (
      <div style={{ background: 'var(--panel)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-hi)', fontWeight: 500 }}>{sourceFile}</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{
            background: 'var(--error-dim)',
            border: '1px solid rgba(192,24,46,0.25)',
            borderLeft: '3px solid var(--error)',
            borderRadius: 'var(--r)',
            padding: 18,
            fontFamily: 'var(--mono)',
            fontSize: 14,
            color: 'var(--error)',
            lineHeight: 1.7,
          }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, opacity: 0.7 }}>
              Analysis Unavailable
            </div>
            {data.error}
          </div>
        </div>
      </div>
    )
  }

  const analysis = (data.analysis && data.analysis.drawing_info) ? data.analysis : data
  const meta     = analysis._metadata || data._metadata || {}
  const filename = data.filename || meta.source_file || analysis.drawing_info?.drawing_number || 'Drawing'
  const ext      = filename.split('.').pop().toUpperCase()

  const info        = analysis.drawing_info || {}
  const dims        = analysis.dimensions_with_tolerances || analysis.dimensions || []
  const gdts        = analysis.gdts_identified || analysis.gdts || []
  const stds        = analysis.standards_identified || analysis.standards || []
  const notes       = analysis.drawing_notations || []
  const mfg         = analysis.manufacturing_requirements || {}
  const gauge       = analysis.gauge_requirements || {}
  const conc        = analysis.conclusions || {}
  const genTol      = analysis.generic_tolerances_applied || {}
  const report      = analysis.technical_report || data.report || ''
  const visualMarkup   = analysis.visual_markup || data.visual_markup || []
  const processedImage = data.processed_image_base64 || analysis.processed_image_base64

  const critCount = dims.filter(d => d.is_critical).length
  const gaugeReq  = gauge.required || gauge.requires_go_nogo || false

  const visibleTabs = TABS.filter(t => {
    if (t === 'Report'       && !report)                                    return false
    if (t === 'Drawing'      && !previewUrl && !isPdfProp)                  return false
    if (t === 'Visual Audit' && !processedImage && visualMarkup.length === 0) return false
    return true
  })

  return (
    <div
      className="result-card-container"
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="result-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--panel-hi) 0%, var(--panel) 100%)',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
            background: 'var(--accent)',
            padding: '2px 7px',
            borderRadius: 'var(--r-xs)',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            {ext}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-hi)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filename}
            </div>
            {(info.part_number || info.revision) && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {info.part_number && `PN: ${info.part_number}`}
                {info.part_number && info.revision && '  ·  '}
                {info.revision && `Rev: ${info.revision}`}
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
          {info.material  && <Badge color="blue">{info.material}</Badge>}
          {dims.length > 0 && <Badge color="blue">{dims.length} Dims</Badge>}
          {critCount > 0   && <Badge color="red">{critCount} Critical</Badge>}
          {gaugeReq ? <Badge color="orange">Gauge Req'd</Badge> : <Badge color="green">No Gauge</Badge>}
          {info.scale     && <Badge color="amber">{info.scale}</Badge>}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="tab-bar result-tab-bar" style={{ background: 'var(--panel)' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => { setActiveTab(tab); if (onTabChange) onTabChange(tab) }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div
        className="tab-content-container"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16, minHeight: 0 }}
      >
        {activeTab === 'Overview'      && <OverviewTab info={info} stds={stds} conc={conc} genTol={genTol} />}
        {activeTab === 'Visual Audit'  && <VisualAuditTab previewUrl={previewUrl} isPdf={isPdfProp} processedImage={processedImage} visualMarkup={visualMarkup} />}
        {activeTab === 'Dimensions'    && <DimensionsTab dims={dims} validationMode={validationMode} />}
        {activeTab === 'GD&T'          && <GdtTab gdts={gdts} notes={notes} />}
        {activeTab === 'Manufacturing' && <ManufacturingTab gauge={gauge} mfg={mfg} />}
        {activeTab === 'Drawing'       && <DrawingTab previewUrl={previewUrl} isPdf={isPdfProp} />}
        {activeTab === 'Report'        && <ReportTab report={report} info={info} dims={dims} gdts={gdts} mfg={mfg} gauge={gauge} critCount={critCount} validationMode={validationMode} genTol={genTol} filename={filename} />}
        {activeTab === 'Comparision'   && <ComparisionTab previewUrl={previewUrl} originalFile={originalFile} originalDims={dims} />}
      </div>
    </div>
  )
}