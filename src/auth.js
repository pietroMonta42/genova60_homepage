const AUTH_KEY = 'genova60_auth'
const AUTH_DURATION_MS = 24 * 60 * 60 * 1000

export function saveAuth(secretKey) {
  const payload = {
    key: secretKey,
    timestamp: Date.now()
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload))
}

export function getSavedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw)
    if (Date.now() - payload.timestamp > AUTH_DURATION_MS) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return payload.key
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}
