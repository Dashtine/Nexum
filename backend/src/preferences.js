const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'token',
  'tokenexpiry',
  'token_expiry',
  'password',
  'secret',
  'jwtsecret',
  'webhooksecret'
])

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase())
}

export function sanitizeProfile(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {}

  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !isSensitiveKey(key))
  )
}

export function sanitizePreferences(prefs = {}) {
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return { profiles: [] }
  }

  const safe = Object.fromEntries(
    Object.entries(prefs).filter(([key]) => !isSensitiveKey(key))
  )

  safe.profiles = Array.isArray(safe.profiles)
    ? safe.profiles.map(sanitizeProfile)
    : []

  return safe
}
