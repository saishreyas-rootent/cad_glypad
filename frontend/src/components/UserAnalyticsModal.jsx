import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import * as adminApi from '../api/adminApi'

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const ACTION_LABELS = {
  QC_ANALYSIS_COMPLETED: 'Completed QC analysis',
  COMPARISON_COMPLETED: 'Completed comparison',
  QC_WORKFLOW_SELECTED: 'Opened QC workflow',
  COMPARISON_WORKFLOW_SELECTED: 'Opened comparison workflow',
  QC_FILE_UPLOADED: 'Uploaded file (QC)',
  QC_FILE_UPLOAD_STARTED: 'Started file upload',
  ORIGINAL_DRAWING_UPLOADED: 'Uploaded original drawing',
  COMPARISON_DRAWING_UPLOADED: 'Uploaded comparison drawing',
  OVERVIEW_TAB_OPENED: 'Viewed Overview tab',
  VISUAL_AUDIT_TAB_OPENED: 'Viewed Visual Audit tab',
  DIMENSIONS_TAB_OPENED: 'Viewed Dimensions tab',
  GDT_TAB_OPENED: 'Viewed GD&T tab',
  MANUFACTURING_TAB_OPENED: 'Viewed Manufacturing tab',
  DRAWING_TAB_OPENED: 'Viewed Drawing tab',
  REPORT_TAB_OPENED: 'Viewed Report tab',
  VALIDATION_MODE_CHANGED: 'Changed validation mode',
  ISO_TOLERANCE_SELECTED: 'Changed ISO tolerance',
  HOME_VIEWED: 'Viewed home page',
  HOME_BUTTON_CLICKED: 'Navigated home',
  COMPARISON_MODULE_ENTERED: 'Entered comparison module',
  COMPARISON_WORKFLOW_ENTERED: 'Started comparison workflow',
  LOGIN: 'Logged in',
  LOGOUT: 'Logged out',
}

const ACTION_COLORS = {
  QC_ANALYSIS_COMPLETED: 'var(--success)',
  COMPARISON_COMPLETED:  'var(--info)',
  LOGIN:                 'var(--success)',
  LOGOUT:                'var(--error)',
  QC_FILE_UPLOADED:      'var(--warn)',
  ORIGINAL_DRAWING_UPLOADED:   'var(--warn)',
  COMPARISON_DRAWING_UPLOADED: 'var(--warn)',
}

function actionLabel(action) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function actionColor(action) {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action]
  if (action.includes('QC'))         return 'var(--success)'
  if (action.includes('COMPARISON')) return 'var(--info)'
  if (action.includes('UPLOAD'))     return 'var(--warn)'
  return 'var(--text-faint)'
}

function relativeTime(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function initials(name) {
  if (!name) return '??'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

/* ── Loading skeleton ─────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  const bar = (w, h = 12) => ({
    width: w,
    height: h,
    borderRadius: 'var(--r-sm)',
    background: 'linear-gradient(90deg, var(--panel-hi) 25%, var(--surface) 50%, var(--panel-hi) 75%)',
    backgroundSize: '800px 100%',
    animation: 'shimmer 1.6s infinite linear',
  })

  return (
    <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', ...bar(52, 52) }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={bar(170, 17)} />
          <div style={bar(230)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--panel)' }}>
            <div style={{ ...bar(55, 9), marginBottom: 10 }} />
            <div style={bar(75, 22)} />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ ...bar(8, 8), borderRadius: '50%' }} />
          <div style={bar(300 - i * 40)} />
        </div>
      ))}
    </div>
  )
}

/* ── KPI card ─────────────────────────────────────────────────────────────── */
function KpiCard({ icon, value, label, color }) {
  return (
    <div
      className="kpi-card"
      style={{ '--hover-color': color || 'var(--accent)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color || 'var(--accent)'
        e.currentTarget.style.boxShadow = `0 4px 20px ${color || 'var(--accent)'}20, var(--shadow-sm)`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
        e.currentTarget.style.transform = ''
      }}
    >
      <div className="kpi-card-label">
        <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
        {label}
      </div>
      <div className="kpi-card-value" style={{ color: color || 'var(--text-hi)' }}>
        {value}
      </div>
    </div>
  )
}

/* ── Tab bar ──────────────────────────────────────────────────────────────── */
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="tab-bar" style={{ borderRadius: 0 }}>
      {tabs.map(tab => (
        <button
          key={tab}
          className={`tab-item${active === tab ? ' active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

/* ── Overview tab ─────────────────────────────────────────────────────────── */
function OverviewTab({ data }) {
  const { profile, stats, activities } = data
  const avgSessionMin = stats.totalSessions > 0
    ? Math.round(stats.totalTimeSpentMinutes / stats.totalSessions)
    : 0

  const kpis = [
    { icon: '🔍', label: 'QC Checks',     value: stats.totalQcChecks,         color: 'var(--success)' },
    { icon: '⇄',  label: 'Comparisons',   value: stats.totalComparisons,       color: 'var(--info)' },
    { icon: '🔐', label: 'Sessions',       value: stats.totalSessions,          color: 'var(--accent)' },
    { icon: '⏱',  label: 'Time Spent',    value: formatDuration(stats.totalTimeSpentMinutes), color: '#7c3aed' },
    { icon: '📁', label: 'Files Uploaded', value: stats.uploadedFilesCount,     color: 'var(--warn)' },
    { icon: '📊', label: 'Avg Session',   value: formatDuration(avgSessionMin), color: '#0f766e' },
  ]

  const recent = activities.slice(0, 8)

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Key dates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          ['Joined', profile.createdAt],
          ['Last Login', profile.lastLogin],
          ['Last Active', profile.lastActivity],
        ].map(([label, val]) => (
          <div key={label} className="info-cell">
            <div className="info-cell-label">{label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-hi)', fontWeight: 500 }}>
              {formatDate(val)}
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          Recent Activity
          <div style={{ flex: 1, height: 1, background: 'var(--border-lo)' }} />
        </div>

        {recent.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            No activity recorded
          </div>
        ) : (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {recent.map((a, i) => (
              <div
                key={a.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 14px',
                  borderBottom: i < recent.length - 1 ? '1px solid var(--border-lo)' : 'none',
                  animation: `riseIn ${0.15 + i * 0.04}s ease`,
                  transition: 'background var(--t-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-hi)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: actionColor(a.action),
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--text-hi)' }}>
                    {actionLabel(a.action)}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(a.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Activity log tab ─────────────────────────────────────────────────────── */
function ActivityLogTab({ activities }) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activities
    return activities.filter(a =>
      actionLabel(a.action).toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q)
    )
  }, [activities, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activities…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--panel-hi)',
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
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
          {filtered.length} of {activities.length} activities
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {activities.length === 0 ? 'No activity recorded' : 'No matching activities'}
          </div>
        ) : filtered.map((a, i) => {
          const hasMeta = a.metadata && Object.keys(a.metadata).length > 0
          const isExpanded = expandedId === (a.id || i)
          return (
            <div
              key={a.id || i}
              onClick={() => hasMeta && setExpandedId(isExpanded ? null : (a.id || i))}
              style={{
                padding: '11px 20px',
                borderBottom: '1px solid var(--border-lo)',
                cursor: hasMeta ? 'pointer' : 'default',
                transition: 'background var(--t-fast)',
                background: isExpanded ? 'var(--panel-hi)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(0,0,0,0.015)' }}
              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Timeline dot */}
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: actionColor(a.action),
                  flexShrink: 0,
                  marginTop: 5,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--text-hi)', fontWeight: 500 }}>
                      {actionLabel(a.action)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 'var(--r-xs)',
                      background: 'var(--panel-hi)',
                      color: 'var(--text-faint)',
                      border: '1px solid var(--border)',
                    }}>
                      {a.action}
                    </span>
                    {hasMeta && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
                    {formatDate(a.timestamp)}
                    {a.sessionId && (
                      <span style={{ marginLeft: 10, opacity: 0.6 }}>
                        Session: {a.sessionId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </div>

                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(a.timestamp)}
                </span>
              </div>

              {/* Expanded metadata */}
              {isExpanded && hasMeta && (
                <div style={{
                  marginTop: 10,
                  marginLeft: 19,
                  padding: '10px 14px',
                  background: 'var(--panel)',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  lineHeight: 1.8,
                  color: 'var(--text-mid)',
                  animation: 'riseIn 0.15s ease',
                }}>
                  {Object.entries(a.metadata).map(([k, v]) => (
                    <div key={k}>
                      <span style={{ color: 'var(--text-faint)' }}>{k}: </span>
                      <span style={{ color: 'var(--text-hi)' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Sessions tab ─────────────────────────────────────────────────────────── */
function SessionsTab({ sessions }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {sessions.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No sessions recorded
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {['Login', 'Logout', 'Duration', 'IP Address', 'Status'].map(h => (
                <th key={h} style={{ position: 'sticky', top: 0, background: 'var(--panel-hi)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id || s.sessionId || i}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatDate(s.loginTime)}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  {s.logoutTime ? formatDate(s.logoutTime) : '—'}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-hi)' }}>
                  {s.sessionDurationMinutes != null ? formatDuration(s.sessionDurationMinutes) : '—'}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>
                  {s.ipAddress || '—'}
                </td>
                <td>
                  <span className="status-chip" style={{
                    color: s.status === 'Active' ? 'var(--success)' : 'var(--text-faint)',
                    background: s.status === 'Active' ? 'var(--success-dim)' : 'transparent',
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: s.status === 'Active' ? 'var(--success)' : 'var(--border-hi)',
                    }} />
                    {s.status || 'Closed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ── Trends tab ───────────────────────────────────────────────────────────── */
function TrendsTab({ trends }) {
  const chartData = useMemo(() => {
    const dateMap = {}
    trends.forEach(t => {
      if (!dateMap[t.date]) dateMap[t.date] = { total: 0, actions: {} }
      dateMap[t.date].total += t.count
      dateMap[t.date].actions[t.action] = (dateMap[t.date].actions[t.action] || 0) + t.count
    })
    const entries = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      entries.push({ date: key, total: dateMap[key]?.total || 0, actions: dateMap[key]?.actions || {} })
    }
    return entries
  }, [trends])

  const maxVal = Math.max(1, ...chartData.map(d => d.total))

  const allActions = useMemo(() => {
    const set = new Set()
    trends.forEach(t => set.add(t.action))
    return [...set]
  }, [trends])

  const svgW = 660
  const svgH = 160
  const barW = Math.max(5, Math.floor((svgW - 60) / 30) - 2)
  const startX = 44
  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-faint)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        Activity — Last 30 Days
        <div style={{ flex: 1, height: 1, background: 'var(--border-lo)' }} />
      </div>

      {trends.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r-sm)',
        }}>
          No activity data for the last 30 days
        </div>
      ) : (
        <>
          {/* SVG chart */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '18px 14px 10px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <svg width="100%" viewBox={`0 0 ${svgW} ${svgH + 28}`} style={{ display: 'block' }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                const y = svgH - frac * svgH + 4
                const val = Math.round(frac * maxVal)
                return (
                  <g key={frac}>
                    <line
                      x1={startX - 4} y1={y} x2={svgW - 10} y2={y}
                      stroke="rgba(160,174,196,0.35)" strokeWidth="0.5"
                      strokeDasharray={frac === 0 ? 'none' : '3,4'}
                    />
                    <text x={startX - 8} y={y + 3.5} textAnchor="end" fill="rgba(74,94,120,0.7)" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="400">
                      {val}
                    </text>
                  </g>
                )
              })}

              {/* Bars */}
              {chartData.map((d, i) => {
                const barH = Math.max(2, (d.total / maxVal) * svgH)
                const x = startX + i * ((svgW - startX - 10) / 30)
                const y = svgH - barH + 4
                const isHovered = hoveredIdx === i
                const isEmpty = d.total === 0
                return (
                  <g
                    key={d.date}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Hover zone */}
                    <rect
                      x={x - 1} y={4} width={barW + 2} height={svgH}
                      fill={isHovered ? 'rgba(29,78,216,0.04)' : 'transparent'}
                      rx="2"
                    />
                    {/* Bar */}
                    <rect
                      x={x} y={y} width={barW} height={barH}
                      fill={isEmpty ? 'rgba(160,174,196,0.3)' : isHovered ? '#2563eb' : '#1d4ed8'}
                      rx="2" ry="2"
                    />
                    {/* Top cap (accent) */}
                    {!isEmpty && (
                      <rect
                        x={x} y={y} width={barW} height={2}
                        fill={isHovered ? '#60a5fa' : '#3b82f6'}
                        rx="1"
                      />
                    )}
                    {/* Tooltip */}
                    {isHovered && !isEmpty && (
                      <>
                        <rect x={x - 18} y={y - 24} width={barW + 36} height={18} rx="4" fill="rgba(15,25,41,0.85)" />
                        <text x={x + barW / 2} y={y - 12} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
                          {d.total} · {d.date.slice(5)}
                        </text>
                      </>
                    )}
                    {/* X labels */}
                    {i % 5 === 0 && (
                      <text x={x + barW / 2} y={svgH + 20} textAnchor="middle" fill="rgba(74,94,120,0.7)" fontSize="8" fontFamily="IBM Plex Mono, monospace">
                        {d.date.slice(5)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Legend */}
          {allActions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {allActions.slice(0, 8).map(a => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-faint)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: actionColor(a), flexShrink: 0, display: 'inline-block' }} />
                  {actionLabel(a)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Main modal ───────────────────────────────────────────────────────────── */
export default function UserAnalyticsModal({ email, onClose }) {
  const [data, setData]     = useState(null)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState('Overview')
  const panelRef            = useRef(null)

  useEffect(() => {
    if (!email) return
    let active = true
    setLoading(true); setError(''); setData(null); setTab('Overview')
    adminApi.getUserAnalytics(email)
      .then(d => { if (active) setData(d) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [email])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleBackdropClick = useCallback(e => {
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
  }, [onClose])

  if (!email) return null

  const profile = data?.profile || {}
  const isOnline = profile.status === 'Online'

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        className="modal-panel"
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Top accent bar ── */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--info))', flexShrink: 0 }} />

        {/* ── Header ── */}
        <div style={{
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          background: 'linear-gradient(180deg, rgba(29,78,216,0.03) 0%, transparent 100%)',
          flexShrink: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: isOnline
              ? 'linear-gradient(135deg, var(--accent), var(--accent-sat))'
              : 'linear-gradient(135deg, var(--border-hi), var(--surface))',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--display)',
            fontSize: 17,
            fontWeight: 700,
            color: isOnline ? '#fff' : 'var(--text-dim)',
            flexShrink: 0,
            boxShadow: isOnline ? '0 4px 16px rgba(29,78,216,0.3)' : 'var(--shadow-xs)',
            animation: isOnline ? 'pulseGlow 2.5s infinite' : 'none',
            position: 'relative',
          }}>
            {initials(profile.name)}
            <div style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isOnline ? 'var(--success)' : 'var(--border-hi)',
              border: '2px solid var(--panel)',
              boxShadow: isOnline ? '0 0 6px var(--success-glow)' : 'none',
            }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--text-hi)', margin: 0, letterSpacing: '-0.01em' }}>
                {loading ? 'Loading…' : profile.name || email}
              </h2>
              {!loading && (
                <>
                  <span className="badge" style={{
                    background: profile.role === 'admin' ? 'var(--accent-dim)' : 'var(--panel-hi)',
                    color: profile.role === 'admin' ? 'var(--accent)' : 'var(--text-faint)',
                    borderColor: profile.role === 'admin' ? 'rgba(29,78,216,0.2)' : 'var(--border)',
                    fontSize: 10,
                  }}>
                    {profile.role}
                  </span>
                  <span className="badge" style={{
                    background: isOnline ? 'var(--success-dim)' : 'transparent',
                    color: isOnline ? 'var(--success)' : 'var(--text-faint)',
                    borderColor: isOnline ? 'rgba(14,124,74,0.22)' : 'var(--border)',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isOnline ? 'var(--success)' : 'var(--border-hi)',
                    }} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </>
              )}
            </div>
            {!loading && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>
                {profile.email}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              flexShrink: 0,
              transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--error)'
              e.currentTarget.style.color = 'var(--error)'
              e.currentTarget.style.background = 'var(--error-dim)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-faint)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? <LoadingSkeleton /> : error ? (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{
              padding: 18,
              background: 'var(--error-dim)',
              border: '1px solid rgba(192,24,46,0.2)',
              borderLeft: '3px solid var(--error)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--error)',
              fontFamily: 'var(--mono)',
              fontSize: 13,
            }}>
              {error}
            </div>
          </div>
        ) : data ? (
          <>
            <TabBar
              tabs={['Overview', 'Activity Log', 'Sessions', 'Trends']}
              active={tab}
              onChange={setTab}
            />
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {tab === 'Overview'      && <OverviewTab data={data} />}
                {tab === 'Activity Log'  && <ActivityLogTab activities={data.activities} />}
                {tab === 'Sessions'      && <SessionsTab sessions={data.sessions} />}
                {tab === 'Trends'        && <TrendsTab trends={data.trends} />}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}