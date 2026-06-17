async function getJson(path) {
  const response = await fetch(path)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`)
  return payload.data || payload
}

export function getOverview() {
  return getJson('/analytics/overview')
}

export function getUsers() {
  return getJson('/admin/users?limit=50')
}

export async function getUserAnalytics(email) {
  const encEmail = encodeURIComponent(email)
  const [usersRes, activitiesRes, sessionsRes, trendsRes] = await Promise.all([
    getJson(`/admin/users`),
    getJson(`/admin/users/${encEmail}/activities`),
    getJson(`/admin/users/${encEmail}/sessions`),
    getJson(`/admin/users/${encEmail}/trends?days=30`)
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
