const sessionKey = 'glypad_session_id'

export async function logActivity(action, metadata = {}) {
  const email = localStorage.getItem('userEmail')
  if (!email || !action) return

  try {
    const response = await fetch('/activity/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        action,
        sessionId: localStorage.getItem(sessionKey),
        metadata,
      }),
    })
    if (!response.ok) {
      console.warn('Activity tracking failed (non-critical):', response.status)
    }
  } catch (error) {
    console.warn('Activity tracking failed (non-critical):', error)
  }
}

export function logQcActivity(metadata) {
  return logActivity('QC_ANALYSIS_COMPLETED', metadata)
}

export function logComparisonActivity(metadata) {
  return logActivity('COMPARISON_COMPLETED', metadata)
}
