async function getJson(path) {
  // If in dev mode with Vite, proxy to backend
  // For absolute paths we just use them, else append to /api or base url
  const response = await fetch(path.startsWith('/admin') ? `http://localhost:8000${path}` : path)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`)
  return payload.data || payload
}

export function getOverview() {
  return getJson('/analytics/overview')
}

export function getUsers() {
  return getJson('http://localhost:8000/admin/users?limit=50')
}

export async function getUserAnalytics(email) {
  const encEmail = encodeURIComponent(email)
  const [usersRes, activitiesRes, sessionsRes, trendsRes] = await Promise.all([
    getJson(`http://localhost:8000/admin/users`),
    getJson(`http://localhost:8000/admin/users/${encEmail}/activities`),
    getJson(`http://localhost:8000/admin/users/${encEmail}/sessions`),
    getJson(`http://localhost:8000/admin/users/${encEmail}/trends?days=30`)
  ])
  
  const profile = (usersRes || []).find(u => u.email === email) || { email }
  return {
    profile: profile,
    stats: profile,
    activities: activitiesRes || [],
    sessions: sessionsRes || [],
    trends: trendsRes || []
  }
}
