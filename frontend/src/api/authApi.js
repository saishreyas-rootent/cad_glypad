const sessionKey = 'glypad_session_id'

export function getStoredSessionId() {
  return localStorage.getItem(sessionKey)
}

export function storeSessionId(sessionId) {
  localStorage.setItem(sessionKey, sessionId)
}

export function clearSessionId() {
  localStorage.removeItem(sessionKey)
}

export async function login(email, password) {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`)
  const data = payload.data || payload
  if (data.sessionId) storeSessionId(data.sessionId)
  return data.user
}

export async function logout() {
  const sessionId = getStoredSessionId()
  const email = localStorage.getItem('userEmail')
  if (!email) {
    clearSessionId()
    return
  }
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sessionId }),
    })
  } finally {
    clearSessionId()
  }
}
