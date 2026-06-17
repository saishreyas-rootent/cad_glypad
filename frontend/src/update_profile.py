import os
import re

app_path = r'C:\Users\Dell\CAD-drawings-e6d565afe1da1b0f5ea65371f1a7757566818c71\frontend\src\App.jsx'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The new component
profile_component = """
function ProfileDropdown({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: isOpen ? 'var(--panel-hi)' : 'transparent', 
          border: '1px solid transparent', 
          borderColor: isOpen ? 'var(--border)' : 'transparent',
          borderRadius: '24px', padding: '4px 12px 4px 4px',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={e => !isOpen && (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
        onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ 
          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', 
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 
        }}>
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-hi)', fontWeight: 500 }}>
          {user?.username}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: '10px', width: 220,
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          zIndex: 100, overflow: 'hidden',
          animation: 'riseIn 0.2s ease',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel-hi)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Signed in as</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-hi)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
          </div>
          <div style={{ padding: '6px' }}>
            <DropdownItem label="Account Details" />
            <DropdownItem label="View Profile" />
            <DropdownItem label="Account Settings" />
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '0' }} />
          <div style={{ padding: '6px' }}>
            <button
              onClick={() => { setIsOpen(false); onLogout(); }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                background: 'transparent', border: 'none', borderRadius: '6px',
                fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--error)',
                cursor: 'pointer', transition: 'background 0.15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,24,46,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownItem({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '8px 10px',
        background: 'transparent', border: 'none', borderRadius: '6px',
        fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-hi)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </button>
  )
}

function QCApp({ user, onBack }) {
"""

# Inject component before QCApp
content = content.replace("function QCApp({ user, onBack }) {", profile_component)


qc_old = """<div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', color: 'var(--text-dim)' }}>Sign out</button>"""

qc_new = "<ProfileDropdown user={user} onLogout={() => window.location.reload()} />"

content = content.replace(qc_old, qc_new)


landing_old = """<div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {user?.username}
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '7px 11px',
              color: 'var(--text-dim)', fontFamily: 'var(--mono)',
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>"""

content = content.replace(landing_old, qc_new)

comp_old = """<div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', color: 'var(--text-dim)' }}>Sign out</button>"""

content = content.replace(comp_old, qc_new)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
