import { useState } from 'react'
import ImageViewer from './ImageViewer'

function toStr(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return Object.values(v).filter(x => x && x !== 'null').join(' · ')
  return String(v)
}

function Badge({ children, color }) {
  const colors = {
    blue: { color: 'var(--info)', border: 'rgba(96,165,250,0.25)', bg: 'rgba(96,165,250,0.07)' },
    amber: { color: 'var(--accent)', border: 'rgba(232,160,32,0.25)', bg: 'rgba(232,160,32,0.07)' },
    green: { color: 'var(--success)', border: 'rgba(52,211,153,0.25)', bg: 'rgba(52,211,153,0.07)' },
    red: { color: 'var(--error)', border: 'rgba(244,63,94,0.25)', bg: 'rgba(244,63,94,0.07)' },
    orange: { color: 'var(--warn)', border: 'rgba(251,146,60,0.25)', bg: 'rgba(251,146,60,0.07)' },
  }
  const c = colors[color] || colors.blue
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '3px', border: `1px solid ${c.border}`, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '20px 0 10px' }}>
      {children}
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function InfoGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>{children}</div>
}

function InfoCell({ label, value }) {
  if (!value || value === 'null' || value === 'N/A' || value === 'Not specified') return null
  return (
    <div style={{ background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text-hi)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '0.08em', textAlign: 'center', padding: '32px', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)' }}>
      {children}
    </div>
  )
}

// ── Gemini quota warning ──────────────────────────────────────────────────────
function GeminiWarning({ warning }) {
  if (!warning) return null

  const isQuota =
    warning.toLowerCase().includes('rate-limit') ||
    warning.toLowerCase().includes('quota') ||
    warning.toLowerCase().includes('429')

  return (
    <div style={{
      background: isQuota ? 'rgba(180,83,9,0.06)' : 'rgba(180,83,9,0.04)',
      border: `1px solid ${isQuota ? 'rgba(180,83,9,0.35)' : 'rgba(180,83,9,0.2)'}`,
      borderLeft: `4px solid ${isQuota ? 'var(--warn)' : 'rgba(180,83,9,0.4)'}`,
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warn)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {isQuota ? 'Gemini Free-Tier Quota Reached' : 'Gemini Warning'}
      </div>

      {/* Message */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {warning}
      </div>

      {/* Quota-specific help box */}
      {isQuota && (
        <div style={{ marginTop: '4px', padding: '8px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text)' }}>What you can do:</strong><br />
          · Wait ~1 minute and retry — free tier resets per minute &amp; per day<br />
          · The pixel-level diff below still shows all visual changes<br />
          · Upgrade to a paid Gemini API key for unlimited semantic analysis<br />
          · Check your quota at{' '}
          <a href="https://ai.dev/rate-limit" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            ai.dev/rate-limit
          </a>
        </div>
      )}
    </div>
  )
}

// ── Tab components ────────────────────────────────────────────────────────────
function OverviewTab({ info, stds, conc, genTol }) {
  const labelMap = { title: 'Title', part_number: 'Part No.', material: 'Material', scale: 'Scale', revision: 'Revision', drawing_number: 'Drawing No.', date: 'Date', author: 'Author', total_pages: 'Pages' }
  const genTolStandard = genTol?.standard || ''
  const genTolRanges = genTol?.ranges || []

  return (
    <div>
      <SectionLabel>Drawing Information</SectionLabel>
      <InfoGrid>
        {Object.entries(info).map(([k, v]) => <InfoCell key={k} label={labelMap[k] || k.replace(/_/g, ' ')} value={toStr(v)} />)}
      </InfoGrid>

      {stds.length > 0 && (
        <>
          <SectionLabel>Referenced Standards</SectionLabel>
          <InfoGrid>
            {stds.map((s, i) => {
              const name = typeof s === 'object' ? (s.standard || s.name || toStr(s)) : String(s)
              const desc = typeof s === 'object' ? (s.description || s.application || '') : ''
              return (
                <div key={i} style={{ background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 12px' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text-hi)', fontWeight: 500 }}>{name}</div>
                  {desc && <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '3px' }}>{desc}</div>}
                </div>
              )
            })}
          </InfoGrid>
        </>
      )}

      {conc?.summary && (
        <>
          <SectionLabel>Conclusions</SectionLabel>
          <div style={{ background: 'rgba(196,24,0,0.04)', border: '1px solid rgba(196,24,0,0.25)', borderRadius: 'var(--r-sm)', padding: '14px 16px', fontSize: '16px', lineHeight: 1.65, color: 'var(--text)' }}>{conc.summary}</div>
        </>
      )}

      {(genTolStandard || genTolRanges.length > 0) && (
        <>
          <SectionLabel>Generic Tolerances{genTolStandard ? ` · ${genTolStandard}` : ''}</SectionLabel>
          <InfoGrid>
            {genTolRanges.map((r, i) => <InfoCell key={i} label={String(r.range ?? r.size_range ?? '')} value={String(r.tolerance ?? r.value ?? '')} />)}
          </InfoGrid>
        </>
      )}
    </div>
  )
}

function DimensionsTab({ dims, validationMode }) {
  if (!dims.length) return <EmptyState>No dimensions extracted</EmptyState>
  const reasonHeader = validationMode === 'Org' ? 'Reason (Org Standard)' : (validationMode === 'Both' ? 'Reason (ISO / Org)' : 'Reason (ISO Standard)')
  const thStyle = { fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)', whiteSpace: 'nowrap' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '15px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Feature</th>
            <th style={thStyle}>Dimension</th>
            <th style={thStyle}>Tolerance</th>
            <th style={thStyle}>Critical</th>
            <th style={{ ...thStyle, width: '40%' }}>{reasonHeader}</th>
          </tr>
        </thead>
        <tbody>
          {dims.map((d, i) => (
            <tr key={i}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(34,37,48,0.6)', color: 'var(--text)' }}>{toStr(d.feature ?? d.type) || '—'}</td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(34,37,48,0.6)', color: 'var(--text-hi)', fontWeight: 500 }}>{toStr(d.dimension ?? d.value) || '—'}</td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(34,37,48,0.6)', color: 'var(--info)' }}>{toStr(d.tolerance) || '—'}</td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(34,37,48,0.6)' }}>
                {d.is_critical
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--error)', background: 'rgba(192,24,46,0.08)', border: '1px solid rgba(192,24,46,0.3)', padding: '2px 7px', borderRadius: '3px' }}>⚑ Critical</span>
                  : <span style={{ color: 'var(--text-dim)', fontSize: '14px' }}>—</span>}
              </td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(34,37,48,0.6)', color: 'var(--text-dim)', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'normal' }}>
                {d.is_critical ? (d.critical_reason || '') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GdtTab({ gdts, notes }) {
  return (
    <div>
      {gdts.length > 0
        ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {gdts.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 13px' }}>
                <span style={{ fontSize: '22px', lineHeight: 1 }}>{g.symbol ?? ''}</span>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text-hi)', fontWeight: 500 }}>{toStr(g.name ?? g.type)}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-dim)', marginTop: '1px' }}>{toStr(g.value ?? g.tolerance)}</div>
                </div>
              </div>
            ))}
          </div>
        )
        : <EmptyState>No GD&T symbols identified</EmptyState>}

      {notes.length > 0 && (
        <>
          <SectionLabel>Drawing Notations</SectionLabel>
          {notes.map((n, i) => {
            const txt = typeof n === 'string' ? n : toStr(n.notation ?? n.text ?? n)
            const interp = typeof n === 'object' ? toStr(n.interpretation ?? '') : ''
            return (
              <div key={i} style={{ background: 'var(--panel-hi)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--r-sm) var(--r-sm) 0', padding: '11px 14px', marginBottom: '7px', fontFamily: 'var(--mono)', fontSize: '15px', lineHeight: 1.6 }}>
                <div style={{ color: 'var(--text-hi)', fontWeight: 500 }}>{txt}</div>
                {interp && <div style={{ color: 'var(--text-dim)', fontSize: '14px', marginTop: '3px' }}>→ {interp}</div>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function ManufacturingTab({ gauge, mfg }) {
  const gaugeReq = gauge?.required || gauge?.requires_go_nogo || false
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px 16px', marginBottom: '14px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: gaugeReq ? 'var(--warn)' : 'var(--success)', boxShadow: `0 0 10px ${gaugeReq ? 'var(--warn)' : 'var(--success)'}` }} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text)', lineHeight: 1.5 }}>
          {gaugeReq ? 'Go/No-Go gauges required' : 'No gauge requirements detected'}
          {gaugeDims.length > 0 && <div style={{ color: 'var(--text-dim)', fontSize: '14px', marginTop: '2px' }}>Applies to: {gaugeDims.join(', ')}</div>}
        </div>
      </div>

      {mfgCells.length > 0
        ? (
          <>
            <SectionLabel>Requirements</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {mfgCells.map(({ key, val }) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
                  <div style={{ padding: '9px 12px', borderRight: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.04)' }}>{key.replace(/_/g, ' ')}</div>
                  <div style={{ padding: '9px 14px', fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--text-hi)', lineHeight: 1.5 }}>{val}</div>
                </div>
              ))}
            </div>
          </>
        )
        : <EmptyState>No additional manufacturing requirements</EmptyState>}
    </div>
  )
}

function ReportTab({ report, info = {}, dims = [], gdts = [], mfg = {}, gauge = {}, critCount = 0, validationMode = 'ISO', genTol = {}, filename = '' }) {
  const handlePrint = () => { window.print() }

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
    if (!line.trim()) return <div key={i} style={{ height: '5px' }} />

    const dimMatch = line.match(/^\s{2,}(.+?):\s(.+?)\s[–-]\s(.+)$/)
    if (dimMatch) {
      const isCrit = line.includes('[CRITICAL]')
      return (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '5px 12px', background: isCrit ? 'rgba(244,63,94,0.05)' : 'transparent', borderLeft: `2px solid ${isCrit ? 'var(--error)' : 'transparent'}`, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text)' }}>{dimMatch[1]}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-hi)', fontWeight: 500 }}>{dimMatch[2]}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: isCrit ? 'var(--error)' : 'var(--info)' }}>{dimMatch[3].replace('[CRITICAL]', '').trim()}{isCrit && <span style={{ marginLeft: '6px', fontSize: '13px' }}>⚑</span>}</span>
        </div>
      )
    }

    const bulletBoldMatch = line.match(/^[·•*-]+\*\*(.+?):\*\*\s*(.*)$/)
    if (bulletBoldMatch) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 12px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontFamily: 'var(--mono)' }}>•</span>
          <div style={{ fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-hi)', fontWeight: 700 }}>{bulletBoldMatch[1]}:</strong> {bulletBoldMatch[2]}
          </div>
        </div>
      )
    }

    if (/^\s*[-•*–→]\s*/.test(line)) {
      const text = line.replace(/^\s*[-•*–→]\s*/, '')
      const arrowIdx = text.indexOf('→')
      if (arrowIdx > -1) {
        return (
          <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 12px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px', fontFamily: 'var(--mono)' }}>→</span>
            <div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-hi)', fontWeight: 500 }}>{text.slice(0, arrowIdx).trim()}</span>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-dim)', marginTop: '2px' }}>{text.slice(arrowIdx + 1).trim()}</div>
            </div>
          </div>
        )
      }
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 12px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontFamily: 'var(--mono)' }}>·</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text)' }}>{renderInline(text)}</span>
        </div>
      )
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '')
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 12px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontFamily: 'var(--mono)' }}>•</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text)', lineHeight: 1.7 }}>{renderInline(text)}</span>
        </div>
      )
    }

    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/)
    if (orderedMatch) {
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', padding: '4px 12px', alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '999px', background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{orderedMatch[1]}</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text)', lineHeight: 1.7 }}>{renderInline(orderedMatch[2])}</span>
        </div>
      )
    }

    if (/^\s*>\s+/.test(line)) {
      const text = line.replace(/^\s*>\s+/, '')
      return <div key={i} style={{ margin: '4px 12px', padding: '8px 12px', borderLeft: '3px solid var(--accent)', background: 'var(--accent-dim)', fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text-dim)', lineHeight: 1.7 }}>{renderInline(text)}</div>
    }

    return <div key={i} style={{ fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--text)', padding: '2px 12px', lineHeight: 1.7 }}>{renderInline(line)}</div>
  })

  const hasMissingGenTol = report.toLowerCase().includes('absence') && report.toLowerCase().includes('general tolerance')
  const isCompliant = critCount === 0 && !hasMissingGenTol

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media print {
          html, body, #root { height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          .app-container, .main-container, .result-wrapper, .result-card-container, .tab-content-container { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; position: static !important; display: block !important; margin: 0 !important; padding: 0 !important; border: none !important; background: transparent !important; box-shadow: none !important; }
          header, aside, .multi-tab-bar, .result-header, .result-tab-bar, .no-print { display: none !important; }
          #glypad-report-print-container { position: static !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; background: white !important; color: #000000 !important; display: flex !important; flex-direction: column !important; gap: 20px !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 14px', background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-dim)' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>QA COMPLIANCE REPORT GENERATED & READY</span>
        </div>
        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--panel)', color: 'var(--text-hi)', border: '1px solid var(--border-hi)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-hi)'; e.currentTarget.style.borderColor = 'var(--accent)' }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; e.currentTarget.style.borderColor = 'var(--border-hi)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          Print All
        </button>
      </div>

      <div id="glypad-report-print-container" style={{ background: '#ffffff', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '36px 40px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ height: '4px', background: 'var(--accent)', margin: '-36px -40px 10px -40px', borderTopLeftRadius: 'var(--r)', borderTopRightRadius: 'var(--r)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #0f1929', paddingBottom: '12px', gap: '20px' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', color: '#0f1929', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>GLYPAD METROLOGY SYSTEMS</div>
            <div style={{ fontSize: '9px', color: '#3d4f66', marginTop: '2px', fontFamily: 'var(--mono)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Automated QA & Metrological Verification</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', color: '#0f1929', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>METROLOGICAL COMPLIANCE REPORT</div>
            <div style={{ fontSize: '9px', color: '#3d4f66', marginTop: '2px', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>Ref: GLY-{(info.part_number || '2022001').replace(/\s+/g, '')}-A</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px', fontFamily: 'var(--mono)' }}>Drawing Title Block Data</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1.5px solid var(--text)', background: '#ffffff' }}>
            <div style={{ borderRight: '1px solid var(--text)', borderBottom: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Drawing Title</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.title || filename || 'N/A'}</div></div>
            <div style={{ borderRight: '1px solid var(--text)', borderBottom: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Drawing Number</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.drawing_number || 'N/A'}</div></div>
            <div style={{ borderRight: '1px solid var(--text)', borderBottom: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Part Number</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.part_number || 'N/A'}</div></div>
            <div style={{ borderBottom: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Revision</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px' }}>{info.revision || 'A'}</div></div>
            <div style={{ borderRight: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Material</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.material || 'N/A'}</div></div>
            <div style={{ borderRight: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Scale</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px' }}>{info.scale || 'N/A'}</div></div>
            <div style={{ borderRight: '1px solid var(--text)', padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Validation Standard</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px' }}>{validationMode === 'Both' ? 'ISO / Org Std' : `${validationMode} Standard`}</div></div>
            <div style={{ padding: '8px 12px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Date of Review</div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', marginTop: '2px' }}>{info.date || new Date().toLocaleDateString()}</div></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ padding: '12px 16px', background: 'var(--panel-hi)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}><div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Dimensions Checked</div><div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-hi)', marginTop: '4px' }}>{dims.length}</div></div>
          <div style={{ padding: '12px 16px', background: critCount > 0 ? 'rgba(192,24,46,0.04)' : 'var(--panel-hi)', border: critCount > 0 ? '1px solid rgba(192,24,46,0.15)' : '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}><div style={{ fontSize: '10px', textTransform: 'uppercase', color: critCount > 0 ? 'var(--error)' : 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Critical Features</div><div style={{ fontSize: '24px', fontWeight: 800, color: critCount > 0 ? 'var(--error)' : 'var(--text-hi)', marginTop: '4px' }}>{critCount}</div></div>
          <div style={{ padding: '12px 16px', background: hasMissingGenTol ? 'rgba(180,83,9,0.04)' : 'var(--panel-hi)', border: hasMissingGenTol ? '1px solid rgba(180,83,9,0.15)' : '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}><div style={{ fontSize: '10px', textTransform: 'uppercase', color: hasMissingGenTol ? 'var(--warn)' : 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>General Tolerance</div><div style={{ fontSize: '14px', fontWeight: 800, color: hasMissingGenTol ? 'var(--warn)' : 'var(--success)', marginTop: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{genTol.standard || (hasMissingGenTol ? 'Missing Standard' : 'None')}</div></div>
          <div style={{ padding: '12px 16px', background: isCompliant ? 'rgba(14,124,74,0.04)' : 'rgba(192,24,46,0.04)', border: isCompliant ? '1px solid rgba(14,124,74,0.15)' : '1px solid rgba(192,24,46,0.15)', borderRadius: 'var(--r-sm)' }}><div style={{ fontSize: '10px', textTransform: 'uppercase', color: isCompliant ? 'var(--success)' : 'var(--error)', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>Verification Status</div><div style={{ fontSize: '13px', fontWeight: 800, color: isCompliant ? 'var(--success)' : 'var(--error)', marginTop: '12px' }}>{isCompliant ? '✓ CONFORMING' : '⚠ ACTION REQUIRED'}</div></div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px 24px', background: '#ffffff' }}>
          <div style={{ borderBottom: '1.5px solid var(--text)', paddingBottom: '8px', marginBottom: '12px' }}><span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-hi)' }}>1.0 Metrological Narrative & Executive Analysis</span></div>
          <div style={{ fontFamily: 'var(--body)', fontSize: '13.5px', color: 'var(--text)', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sections.filter(s => s.rows.length || s.title).map((sec, si) => {
              if (sec.isPreamble) return (
                <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sec.rows.filter(r => r.trim()).map((r, i) => <p key={i} style={{ margin: 0 }}>{renderInline(r)}</p>)}
                </div>
              )
              return (
                <div key={si} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--panel-hi)', marginTop: '4px' }}>
                  {sec.title && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
                      {sec.num && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '3px', background: 'var(--accent)', color: '#ffffff', fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700 }}>{sec.num}</span>}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{sec.title}</span>
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

function DrawingTab({ previewUrl, isPdf }) {
  if (!previewUrl && !isPdf) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', height: '100%', minHeight: '320px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: '16px', letterSpacing: '0.06em' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1.2"><rect x="8" y="4" width="28" height="38" rx="1" /><line x1="14" y1="14" x2="30" y2="14" /><line x1="14" y1="21" x2="30" y2="21" /><line x1="14" y1="28" x2="22" y2="28" /></svg>
      No preview available
    </div>
  )
  return <div style={{ height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column' }}><ImageViewer src={previewUrl} isPdf={isPdf} isTab /></div>
}

function VisualAuditTab({ previewUrl, isPdf, processedImage, visualMarkup }) {
  const src = processedImage || previewUrl
  if (!src && !isPdf) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', height: '100%', minHeight: '320px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: '16px', letterSpacing: '0.06em' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--border-hi)" strokeWidth="1.2"><rect x="8" y="4" width="28" height="38" rx="1" /><line x1="14" y1="14" x2="30" y2="14" /><line x1="14" y1="21" x2="30" y2="21" /><line x1="14" y1="28" x2="22" y2="28" /></svg>
      No visual audit data available
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', height: '100%', minHeight: '500px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--panel-hi)' }}>
        <ImageViewer src={src} isPdf={isPdf && !processedImage} isTab />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: '15px', fontWeight: 800, color: 'var(--text-hi)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quality Audit Report</div>
        {visualMarkup?.length > 0
          ? visualMarkup.map((item, i) => (
            <div key={i} style={{ border: `1px solid ${item.status === 'valid' ? 'rgba(52,211,153,0.2)' : 'rgba(244,63,94,0.2)'}`, background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: '16px', borderLeft: `4px solid ${item.status === 'valid' ? 'var(--success)' : 'var(--error)'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.3 }}>{item.label}</div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 800, padding: '3px 6px', borderRadius: '3px', background: item.status === 'valid' ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)', color: item.status === 'valid' ? 'var(--success)' : 'var(--error)', marginLeft: '8px', flexShrink: 0 }}>{item.status.toUpperCase()}</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>{item.reason}</div>
            </div>
          ))
          : <EmptyState>No critical issues or title block errors detected.</EmptyState>}
      </div>
    </div>
  )
}

// ── ComparisionTab ────────────────────────────────────────────────────────────
function ComparisionTab({ previewUrl, originalFile, originalDims = [] }) {
  const [comparedFile, setComparedFile] = useState(null)
  const [isComparing, setIsComparing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [rightView, setRightView] = useState('highlighted')
  const [filter, setFilter] = useState('all')
  const [zoomL, setZoomL] = useState(100)
  const [zoomR, setZoomR] = useState(100)

  const runComparison = async (file) => {
    if (!originalFile) { setError('Original file is not available. Please re-analyse the drawing first.'); return }
    setIsComparing(true); setError(null); setResult(null); setRightView('highlighted')
    try {
      const fd = new FormData()
      fd.append('file1', originalFile)
      fd.append('file2', file)
      const res = await fetch('/compare', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      if (!data.success) throw new Error(data.error || 'Comparison failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsComparing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) { setComparedFile(files[0]); runComparison(files[0]) }
  }

  const handleBrowse = () => {
    if (isComparing) return
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'image/*,.pdf'
    inp.onchange = (e) => { if (e.target.files.length > 0) { setComparedFile(e.target.files[0]); runComparison(e.target.files[0]) } }
    inp.click()
  }

  const rows = result?.comparison_rows || []
  const simPct = result?.similarity_percent ?? null
  const filteredRows = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const statusCounts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})

  const rightSrc = (() => {
    if (!result) return null
    if (rightView === 'highlighted') return result.highlighted_image_base64
    if (rightView === 'diff') return result.diff_image_base64
    return comparedFile ? URL.createObjectURL(comparedFile) : null
  })()

  const monoSm = { fontFamily: 'var(--mono)', fontSize: '12px', letterSpacing: '0.08em' }

  const statusStyle = (s) => ({
    match: { color: 'var(--success)', bg: 'rgba(14,124,74,0.08)', border: 'rgba(14,124,74,0.25)' },
    deviation: { color: 'var(--warn)', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)' },
    added: { color: 'var(--info)', bg: 'rgba(29,95,180,0.08)', border: 'rgba(29,95,180,0.25)' },
    removed: { color: 'var(--error)', bg: 'rgba(192,24,46,0.08)', border: 'rgba(192,24,46,0.25)' },
  }[s] || { color: 'var(--success)', bg: 'rgba(14,124,74,0.08)', border: 'rgba(14,124,74,0.25)' })

  const statusIcon = (s) => ({ match: '✓', deviation: '⚠', added: '+', removed: '−' }[s] || '?')

  const thStyle = { ...monoSm, textTransform: 'uppercase', color: 'var(--text-dim)', padding: '9px 12px', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)', whiteSpace: 'nowrap', textAlign: 'left' }

  const ZoomBar = ({ zoom, setZoom }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <button onClick={() => setZoom(z => Math.max(20, z - 20))} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '13px' }}>−</button>
      <span style={{ ...monoSm, color: 'var(--text-dim)', minWidth: '40px', textAlign: 'center' }}>{zoom}%</span>
      <button onClick={() => setZoom(z => Math.min(400, z + 20))} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '13px' }}>+</button>
    </div>
  )



  const FilterChip = ({ value, label, count }) => {
    const active = filter === value
    const st = value === 'all' ? { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'var(--accent)' } : statusStyle(value)
    return (
      <button onClick={() => setFilter(value)} style={{ ...monoSm, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '3px', border: `1px solid ${active ? st.border || 'var(--accent)' : 'var(--border)'}`, background: active ? st.bg || 'var(--accent-dim)' : 'transparent', color: active ? st.color || 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.12s' }}>
        {label}{count !== undefined ? ` (${count})` : ''}
      </button>
    )
  }

  const ViewChip = ({ value, label }) => {
    const active = rightView === value
    return (
      <button onClick={() => setRightView(value)} style={{ ...monoSm, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '3px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.12s' }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>


      {/* ── Split pane ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', minHeight: '420px' }}>

        {/* LEFT — Original */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--panel-hi)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ ...monoSm, textTransform: 'uppercase', color: 'var(--text-dim)' }}>Original Drawing</span>
            <ZoomBar zoom={zoomL} setZoom={setZoomL} />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            {previewUrl
              ? <img src={previewUrl} alt="Original" style={{ width: `${zoomL}%`, objectFit: 'contain', display: 'block' }} />
              : <div style={{ ...monoSm, color: 'var(--text-dim)', margin: 'auto', paddingTop: '80px' }}>No preview available</div>}
          </div>
        </div>

        {/* RIGHT — Highlighted / Raw / Diff */}
        <div
          onDragOver={e => { e.preventDefault(); if (!isComparing) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ border: `2px ${dragOver ? 'solid' : result ? 'solid' : 'dashed'} ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', background: dragOver ? 'var(--accent-dim)' : 'var(--panel-hi)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'border-color 0.15s, background 0.15s' }}
        >
          {/* Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...monoSm, textTransform: 'uppercase', color: 'var(--text-dim)' }}>Comparison Drawing</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {result && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ViewChip value="highlighted" label="Highlights" />
                  <ViewChip value="original" label="Raw" />
                  <ViewChip value="diff" label="Pixel Diff" />
                </div>
              )}
              {result && <ZoomBar zoom={zoomR} setZoom={setZoomR} />}
              <button onClick={handleBrowse} style={{ ...monoSm, textTransform: 'uppercase', padding: '4px 10px', background: 'var(--accent)', border: 'none', borderRadius: '3px', color: '#fff', cursor: 'pointer' }}>
                {result ? 'Upload New' : 'Browse'}
              </button>
            </div>
          </div>

          {/* Image */}
          <div
            style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', cursor: !result && !isComparing ? 'pointer' : 'default' }}
            onClick={() => { if (!result && !isComparing) handleBrowse() }}
          >
            {rightSrc ? (
              <img src={rightSrc} alt="Comparison" style={{ width: `${zoomR}%`, objectFit: 'contain', display: 'block', opacity: isComparing ? 0.25 : 1, transition: 'opacity 0.2s' }} />
            ) : !isComparing ? (
              <div style={{ textAlign: 'center', paddingTop: '80px', pointerEvents: 'none' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Drop revised drawing here</div>
                <div style={{ ...monoSm, color: 'var(--text-dim)', marginTop: '4px', opacity: 0.5 }}>or click to browse</div>
              </div>
            ) : null}
          </div>

          {/* Highlight legend */}
          {result && rightView === 'highlighted' && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '14px', flexWrap: 'wrap', flexShrink: 0, background: 'rgba(0,0,0,0.03)' }}>
              {[{ colour: 'rgb(0,140,255)', label: 'Deviation' }, { colour: 'rgb(0,200,60)', label: 'Added' }, { colour: 'rgb(0,60,220)', label: 'Removed' }].map(({ colour, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: colour, flexShrink: 0 }} />
                  <span style={{ ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading overlay */}
          {isComparing && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(240,242,245,0.82)', backdropFilter: 'blur(4px)', gap: '14px', zIndex: 10 }}>
              <div style={{ width: '160px', height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '-50%', width: '50%', height: '100%', background: 'linear-gradient(to right, transparent, var(--accent), transparent)', animation: 'scan 1.3s ease-in-out infinite' }} />
              </div>
              <div style={{ ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Extracting &amp; comparing all dimensions</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Hard error (fetch failed) ── */}
      {error && (
        <div style={{ background: 'rgba(192,24,46,0.05)', border: '1px solid rgba(192,24,46,0.3)', borderRadius: 'var(--r)', padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--error)', lineHeight: 1.6 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7, marginBottom: '5px' }}>Comparison Failed</div>
          {error}
        </div>
      )}

      {/* ── Gemini quota / warning (non-fatal) ── */}
      <GeminiWarning warning={result?.gemini_error} />

      {/* ── Comparison table ── */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...monoSm, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              Dimensions Comparison
              <div style={{ height: '1px', width: '60px', background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <FilterChip value="all" label="All" count={rows.length} />
              <FilterChip value="deviation" label="Deviation" count={statusCounts.deviation || 0} />
              <FilterChip value="added" label="Added" count={statusCounts.added || 0} />
              <FilterChip value="removed" label="Removed" count={statusCounts.removed || 0} />
              <FilterChip value="match" label="Match" count={statusCounts.match || 0} />
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--panel)', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '4%' }}>#</th>
                  <th style={{ ...thStyle, width: '16%' }}>Feature</th>
                  <th style={{ ...thStyle, width: '10%' }}>Type</th>
                  <th style={{ ...thStyle, width: '11%' }}>Orig Val</th>
                  <th style={{ ...thStyle, width: '11%' }}>Rev Val</th>
                  <th style={{ ...thStyle, width: '11%' }}>Orig Tol</th>
                  <th style={{ ...thStyle, width: '11%' }}>Rev Tol</th>
                  <th style={{ ...thStyle, width: '15%' }}>Change</th>
                  <th style={{ ...thStyle, width: '11%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => {
                  const st = statusStyle(row.status)
                  const odd = i % 2 !== 0
                  return (
                    <tr key={i}
                      style={{ background: odd ? 'var(--panel-hi)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,78,216,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = odd ? 'var(--panel-hi)' : 'transparent'}
                    >
                      <td style={{ ...monoSm, color: 'var(--text-dim)', padding: '9px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center', wordBreak: 'break-word' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text-hi)', padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.feature || '—'}</td>
                      <td style={{ ...monoSm, color: 'var(--text-dim)', padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.type || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text)', padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.original_value || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: row.status !== 'match' ? st.color : 'var(--text)', fontWeight: row.status !== 'match' ? 600 : 400, padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.compared_value || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--info)', padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.original_tolerance || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: row.original_tolerance !== row.compared_tolerance && row.status !== 'match' ? st.color : 'var(--info)', fontWeight: row.original_tolerance !== row.compared_tolerance && row.status !== 'match' ? 600 : 400, padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>{row.compared_tolerance || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-dim)', padding: '9px 8px', borderBottom: '1px solid var(--border)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {row.change_description && row.change_description !== 'No change'
                          ? row.change_description
                          : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)', wordBreak: 'break-word' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 6px', borderRadius: '3px', color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                          {statusIcon(row.status)} {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase' }}>No rows match the selected filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ ...monoSm, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>
            Showing {filteredRows.length} of {rows.length} items
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !isComparing && !error && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '32px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 2 }}>
          Upload a revised drawing in the right pane to begin the comparison.<br />
          <span style={{ opacity: 0.55, fontSize: '12px' }}>
            Tesseract OCR extracts every dimension, tolerance, GD&amp;T symbol and annotation from both drawings and highlights all changes on the revised image.
            <br />
            A pixel-level diff overlay is also produced as a secondary visual reference.
          </span>
        </div>
      )}
    </div>
  )
}

// ── ResultCard ────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Visual Audit', 'Dimensions', 'GD&T', 'Manufacturing', 'Drawing', 'Report', 'Comparision']

export default function ResultCard({ data, previewUrl, isPdf: isPdfProp = false, validationMode = 'ISO', onTabChange, originalFile }) {
  const [activeTab, setActiveTab] = useState('Overview')

  if (data?.error) {
    const sourceFile = data?._metadata?.source_file || data?.filename || 'Drawing'
    return (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--text-hi)', fontWeight: 500 }}>{sourceFile}</div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ background: 'rgba(192,24,46,0.05)', border: '1px solid rgba(192,24,46,0.25)', borderRadius: 'var(--r)', padding: '18px', fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--error)', lineHeight: 1.7 }}>
            <div style={{ fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.7 }}>Analysis Unavailable</div>
            {data.error}
          </div>
        </div>
      </div>
    )
  }

  const analysis = (data.analysis && data.analysis.drawing_info) ? data.analysis : data
  const meta = analysis._metadata || data._metadata || {}
  const filename = data.filename || meta.source_file || analysis.drawing_info?.drawing_number || 'Drawing'
  const ext = filename.split('.').pop().toUpperCase()

  const info = analysis.drawing_info || {}
  const dims = analysis.dimensions_with_tolerances || analysis.dimensions || []
  const gdts = analysis.gdts_identified || analysis.gdts || []
  const stds = analysis.standards_identified || analysis.standards || []
  const notes = analysis.drawing_notations || []
  const mfg = analysis.manufacturing_requirements || {}
  const gauge = analysis.gauge_requirements || {}
  const conc = analysis.conclusions || {}
  const genTol = analysis.generic_tolerances_applied || {}
  const report = analysis.technical_report || data.report || ''
  const visualMarkup = analysis.visual_markup || data.visual_markup || []
  const processedImage = data.processed_image_base64 || analysis.processed_image_base64

  const critCount = dims.filter(d => d.is_critical).length
  const gaugeReq = gauge.required || gauge.requires_go_nogo || false

  const visibleTabs = TABS.filter(t => {
    if (t === 'Report' && !report) return false
    if (t === 'Drawing' && !previewUrl && !isPdfProp) return false
    if (t === 'Visual Audit' && !processedImage && visualMarkup.length === 0) return false
    return true
  })

  return (
    <div className="result-card-container" style={{ background: 'var(--panel)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="result-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 500, color: '#fff', background: 'var(--accent)', padding: '2px 6px', borderRadius: '2px', letterSpacing: '0.06em', flexShrink: 0 }}>{ext}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--text-hi)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
            {(info.part_number || info.revision) && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px', letterSpacing: '0.04em' }}>
                {info.part_number && `PN: ${info.part_number}`}
                {info.part_number && info.revision && '  ·  '}
                {info.revision && `Rev: ${info.revision}`}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
          {info.material && <Badge color="blue">{info.material}</Badge>}
          {dims.length > 0 && <Badge color="blue">{dims.length} Dims</Badge>}
          {critCount > 0 && <Badge color="red">{critCount} Critical</Badge>}
          {gaugeReq ? <Badge color="orange">Gauge Req'd</Badge> : <Badge color="green">No Gauge</Badge>}
          {info.scale && <Badge color="amber">{info.scale}</Badge>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="result-tab-bar" style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)', overflowX: 'auto', flexShrink: 0 }}>
        {visibleTabs.map(tab => (
          <button key={tab}
            onClick={() => { setActiveTab(tab); if (onTabChange) onTabChange(tab) }}
            style={{ fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: activeTab === tab ? 'var(--accent)' : 'var(--text-dim)', padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content-container" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px', minHeight: 0 }}>
        {activeTab === 'Overview' && <OverviewTab info={info} stds={stds} conc={conc} genTol={genTol} />}
        {activeTab === 'Visual Audit' && <VisualAuditTab previewUrl={previewUrl} isPdf={isPdfProp} processedImage={processedImage} visualMarkup={visualMarkup} />}
        {activeTab === 'Dimensions' && <DimensionsTab dims={dims} validationMode={validationMode} />}
        {activeTab === 'GD&T' && <GdtTab gdts={gdts} notes={notes} />}
        {activeTab === 'Manufacturing' && <ManufacturingTab gauge={gauge} mfg={mfg} />}
        {activeTab === 'Drawing' && <DrawingTab previewUrl={previewUrl} isPdf={isPdfProp} />}
        {activeTab === 'Report' && <ReportTab report={report} info={info} dims={dims} gdts={gdts} mfg={mfg} gauge={gauge} critCount={critCount} validationMode={validationMode} genTol={genTol} filename={filename} />}
        {activeTab === 'Comparision' && <ComparisionTab previewUrl={previewUrl} originalFile={originalFile} originalDims={dims} />}
      </div>
    </div>
  )
}