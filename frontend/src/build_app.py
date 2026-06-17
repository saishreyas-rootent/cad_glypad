import os

irrV_path = r'C:\Users\Dell\AppData\Roaming\Code\User\History\-2d84c114\irrV.jsx'
app_path = r'C:\Users\Dell\CAD-drawings-e6d565afe1da1b0f5ea65371f1a7757566818c71\frontend\src\App.jsx'

with open(irrV_path, 'r', encoding='utf-8') as f:
    irrV = f.read()

# Extract from start to `export default function App()`
parts = irrV.split('export default function App() {')
top_part = parts[0]

# Change import to include ComparisionTab
top_part = top_part.replace("import ResultCard from './components/ResultCard'", "import ResultCard, { ComparisionTab } from './components/ResultCard'")

# Replace user header in QCApp to have profile badge and logout
# In irrV.jsx, QCApp header right side looks like:
# <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
#   <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>
#   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>...
#   </div>
# </div>

qc_header_old = """<span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>"""
qc_header_new = """<div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', color: 'var(--text-dim)' }}>Sign out</button>"""
top_part = top_part.replace(qc_header_old, qc_header_new)

# Generate LoginPage, LandingPage, ComparisonApp, and App

rest_code = """

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--panel)', padding: 40, borderRadius: 'var(--r)', border: '1px solid var(--border)', width: 360, textAlign: 'center' }}>
        <img src={glypadLogo} alt="GLYPAD" style={{ height: 24, marginBottom: 24 }} />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 24, marginBottom: 24 }}>Welcome</h2>
        <input 
          type="text" placeholder="Username" 
          value={username} onChange={e => setUsername(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14 }}
        />
        <button 
          onClick={() => username && onLogin({ username })}
          style={{ width: '100%', padding: 12, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Sign In
        </button>
      </div>
    </div>
  )
}

function LandingPage({ user, onSelectMode, onLogout }) {
  const modes = [
    {
      id: 'qc',
      eyebrow: 'Quality Control',
      title: 'Analyze a drawing',
      description: 'Extract dimensions, validate tolerances, and review drawing quality against ISO or organizational standards.',
      color: 'var(--accent)',
    },
    {
      id: 'comparison',
      eyebrow: 'Revision Review',
      title: 'Compare drawings',
      description: 'Load an original drawing, add a revision, and inspect detected dimensional and visual changes.',
      color: 'var(--info)',
    },
  ]

  return (
    <main style={{
      position: 'relative', zIndex: 1, minHeight: '100vh',
      display: 'flex', flexDirection: 'column', padding: '0 32px 40px',
    }}>
      <header style={{
        height: 72, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
      }}>
        <img src={glypadLogo} alt="GLYPAD" style={{ height: 20, width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
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
          </button>
        </div>
      </header>

      <section style={{
        width: '100%', maxWidth: 980, margin: 'auto',
        padding: '56px 0', animation: 'riseIn 0.3s ease',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10,
        }}>
          Drawing Workspace
        </div>
        <h1 style={{
          maxWidth: 620, fontFamily: 'var(--display)', fontSize: 42,
          lineHeight: 1.1, color: 'var(--text-hi)', marginBottom: 12,
        }}>
          What would you like to inspect?
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: 34 }}>
          Choose a workflow to begin.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              style={{
                minHeight: 230, padding: 26, textAlign: 'left',
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid var(--border)', borderRadius: 'var(--r)',
                boxShadow: '0 12px 34px rgba(15,25,41,0.08)',
                cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={event => {
                event.currentTarget.style.transform = 'translateY(-3px)'
                event.currentTarget.style.borderColor = mode.color
              }}
              onMouseLeave={event => {
                event.currentTarget.style.transform = ''
                event.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{
                width: 38, height: 38, display: 'grid', placeItems: 'center',
                borderRadius: 'var(--r-sm)', background: mode.color,
                color: '#fff', fontFamily: 'var(--mono)', fontWeight: 700,
                marginBottom: 28,
              }}>
                {mode.id === 'qc' ? 'QC' : 'DIFF'}
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: mode.color, marginBottom: 8,
              }}>
                {mode.eyebrow}
              </div>
              <div style={{
                fontFamily: 'var(--display)', fontSize: 24, fontWeight: 600,
                color: 'var(--text-hi)', marginBottom: 8,
              }}>
                {mode.title}
              </div>
              <div style={{
                fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.5,
              }}>
                {mode.description}
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function ComparisonApp({ user, onBack }) {
  const [apiUrl] = useState('')
  const [apiOnline, setApiOnline] = useState(null)
  
  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) })
      setApiOnline(r.ok)
    } catch { setApiOnline(false) }
  }, [apiUrl])

  useEffect(() => { checkHealth() }, [checkHealth])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(240,242,245,0.97)', backdropFilter: 'blur(12px)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={glypadLogo} alt="GLYPAD" style={{ height: 16, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', lineHeight: 1.3 }}>
            CAD DRAWING<br />ANALYZER
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            <button onClick={onBack} style={{ background: 'none', border: 'none', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Home
            </button>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--info)' }}>Comparison</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{user?.username}</span>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', color: 'var(--text-dim)' }}>Sign out</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: apiOnline === null ? 'var(--text-dim)' : apiOnline ? 'var(--success)' : 'var(--error)', boxShadow: apiOnline === true ? '0 0 8px var(--success)' : 'none', transition: 'all 0.4s' }} />
            <span>{apiOnline === null ? 'Checking…' : apiOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ComparisionTab standalone={true} />
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)

  const handleLogin = (u) => { setUser(u); setScreen('landing') }
  const handleLogout = () => { window.location.reload() }
  const handleSelectMode = (mode) => setScreen(mode === 'qc' ? 'qc' : 'comparison')
  const handleBack = () => setScreen('landing')

  if (screen === 'login')      return <LoginPage onLogin={handleLogin} />
  if (screen === 'landing')    return <LandingPage user={user} onSelectMode={handleSelectMode} onLogout={handleLogout} />
  if (screen === 'qc')         return <QCApp user={user} onBack={handleBack} />
  if (screen === 'comparison') return <ComparisonApp user={user} onBack={handleBack} />
  return null
}
"""

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(top_part + rest_code)
