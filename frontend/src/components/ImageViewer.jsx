import { useRef, useState, useEffect, useCallback } from 'react'

export default function ImageViewer({ src, isPdf, isTab = false, highlights = [], imageNaturalSize = null }) {
  const vpRef = useRef(null)
  const imgRef = useRef(null)
  const drag = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [naturalSize, setNaturalSize] = useState(null)

  const zoomPct = Math.round(zoom * 100)

  const clampPan = useCallback((z, px, py) => {
    const vp = vpRef.current
    const img = imgRef.current
    if (!vp || !img) return { x: px, y: py }
    const vw = vp.clientWidth, vh = vp.clientHeight
    const iw = img.naturalWidth * z, ih = img.naturalHeight * z
    const maxX = Math.max(0, (iw - vw) / 2)
    const maxY = Math.max(0, (ih - vh) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, px)), y: Math.min(maxY, Math.max(-maxY, py)) }
  }, [])

  const handleWheel = useCallback(e => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setZoom(z => {
      const nz = Math.min(8, Math.max(0.2, z * factor))
      setPan(p => clampPan(nz, p.x, p.y))
      return nz
    })
  }, [clampPan])

  const handleMouseDown = useCallback(e => {
    drag.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback(e => {
    if (!drag.current) return
    const np = clampPan(zoom, e.clientX - drag.current.startX, e.clientY - drag.current.startY)
    setPan(np)
  }, [zoom, clampPan])

  const handleMouseUp = useCallback(() => { drag.current = null }, [])

  const fitToScreen = useCallback(() => {
    setReady(true)
    const vp = vpRef.current
    const img = imgRef.current
    if (!vp || !img) return
    const vw = vp.clientWidth, vh = vp.clientHeight
    const iw = img.naturalWidth, ih = img.naturalHeight
    setNaturalSize({ w: iw, h: ih })
    const z = Math.min((vw - 40) / iw, (vh - 40) / ih)
    setZoom(z)
    setPan({ x: 0, y: 0 })
  }, [])

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    vp.addEventListener('wheel', handleWheel, { passive: false })
    return () => vp.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    setReady(false)
  }, [src])

  const panelStyle = {
    display: 'flex', flexDirection: 'column',
    background: 'var(--panel-hi)', borderRight: '1px solid var(--border)',
    width: isTab ? '100%' : '380px', flexShrink: isTab ? 1 : 0,
    minHeight: 0, flex: isTab ? 1 : undefined,
  }
  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderBottom: '1px solid var(--border)',
    background: 'var(--panel-hi)', flexShrink: 0,
  }
  const titleStyle = {
    fontFamily: 'var(--mono)', fontSize: '13px',
    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)',
  }

  if (isPdf && !src) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>Drawing Preview</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" stroke="var(--border-hi)" strokeWidth="1.2">
            <rect x="2" y="2" width="26" height="34" rx="1" />
            <line x1="7" y1="12" x2="21" y2="12" />
            <line x1="7" y1="18" x2="21" y2="18" />
            <line x1="7" y1="24" x2="15" y2="24" />
            <line x1="26" y1="22" x2="34" y2="22" /><line x1="30" y1="18" x2="30" y2="26" />
          </svg>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '0.06em', lineHeight: 1.8, textAlign: 'center' }}>
            PDF — preview not available<br />Analysis results shown in tabs →
          </p>
        </div>
      </div>
    )
  }

  if (!src) return null

  // Convert box_2d [ymin, xmin, ymax, xmax] (0-1000 range) to pixel-based CSS overlay
  const renderHighlights = () => {
    if (!highlights.length || !ready || !naturalSize) return null
    const iw = naturalSize.w
    const ih = naturalSize.h

    return highlights.map((hl, idx) => {
      const box = hl.box_2d
      if (!box || box.length !== 4) return null
      const [ymin, xmin, ymax, xmax] = box

      // Convert from 0-1000 normalized to actual image pixels
      const left = (xmin / 1000) * iw
      const top = (ymin / 1000) * ih
      const w = ((xmax - xmin) / 1000) * iw
      const h = ((ymax - ymin) / 1000) * ih

      const isError = hl.status === 'error'
      const color = isError ? 'rgba(244, 63, 94, 0.85)' : 'rgba(52, 211, 153, 0.85)'
      const bgColor = isError ? 'rgba(244, 63, 94, 0.15)' : 'rgba(52, 211, 153, 0.15)'
      const borderColor = isError ? 'rgba(244, 63, 94, 0.9)' : 'rgba(52, 211, 153, 0.9)'

      return (
        <div key={idx} style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {/* Highlight box */}
          <div style={{
            position: 'absolute',
            left: `${left}px`, top: `${top}px`,
            width: `${w}px`, height: `${h}px`,
            background: bgColor,
            border: `3px solid ${borderColor}`,
            borderRadius: '2px',
            boxShadow: `0 0 12px ${color}, 0 0 24px ${isError ? 'rgba(244,63,94,0.3)' : 'rgba(52,211,153,0.3)'}`,
            animation: 'highlightPulse 1.5s ease-in-out infinite',
          }} />
          {/* Label */}
          {hl.label && (
            <div style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top - 24}px`,
              background: borderColor,
              color: '#fff',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '3px 3px 0 0',
              whiteSpace: 'nowrap',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {hl.label}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div style={panelStyle}>
      <style>{`
        @keyframes highlightPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <div style={headerStyle}>
        <span style={titleStyle}>Drawing Preview</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            ['−', () => setZoom(z => Math.max(0.1, z * 0.8))], 
            ['⟳', resetView], 
            ['FIT', fitToScreen],
            ['+', () => setZoom(z => Math.min(10, z * 1.25))]
          ].map(([label, fn]) => (
            <button key={label} onClick={fn} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', cursor: 'pointer', transition: 'all 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-mid)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >{label}</button>
          ))}
        </div>
      </div>
      <div
        ref={vpRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHovered(false) }}
        onMouseEnter={() => setHovered(true)}
        style={{ flex: 1, overflow: 'hidden', cursor: drag.current ? 'grabbing' : 'grab', position: 'relative', background: 'var(--panel-hi)', userSelect: 'none' }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: 'center', transition: drag.current ? 'none' : 'transform 0.05s',
        }}>
          <img
            ref={imgRef}
            src={src}
            alt="CAD Drawing"
            onLoad={fitToScreen}
            draggable={false}
            style={{
              maxWidth: 'none', display: 'block',
            }}
          />
          {/* Overlay highlights on top of image, inside the same transform container */}
          {renderHighlights()}
        </div>

        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-hi)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>LOADING…</span>
          </div>
        )}

        {ready && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', fontFamily: 'var(--mono)', fontSize: '13px', color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 7px', borderRadius: '3px', pointerEvents: 'none' }}>
            {zoomPct}%
          </div>
        )}

        {ready && hovered && (
          <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: '13px', color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '3px 10px', borderRadius: '12px', pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
            Scroll to zoom · Drag to pan
          </div>
        )}
      </div>
    </div>
  )
}
