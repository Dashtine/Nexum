// Server-synced preferences hook.
// Loads preferences from server on mount, saves to server on change.
// Also caches non-sensitive UI preferences in localStorage for instant reloads.

import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE, authHeaders } from '../utils/auth'

const DEFAULTS = {
  profiles: [],
  colorScheme: 'amber',
  theme: 'dark',
  autoRenew: { enabled: false, intervalHours: 6 }
}

const SENSITIVE_KEYS = new Set(['apiKey', 'token', 'token_expiry', 'tokenExpiry'])

function sanitizePreferences(input = {}) {
  const safe = { ...DEFAULTS, ...(input && typeof input === 'object' ? input : {}) }

  for (const key of SENSITIVE_KEYS) delete safe[key]

  safe.profiles = Array.isArray(safe.profiles)
    ? safe.profiles.map(profile => {
        const clean = { ...profile }
        for (const key of SENSITIVE_KEYS) delete clean[key]
        return clean
      })
    : []

  return safe
}

function localKey(userId) {
  return `nexum-prefs-${userId || 'default'}`
}

function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(localKey(userId))
    const sanitized = sanitizePreferences(raw ? JSON.parse(raw) : {})
    localStorage.setItem(localKey(userId), JSON.stringify(sanitized))
    return sanitized
  } catch {
    return { ...DEFAULTS }
  }
}

export function usePreferences(userId) {
  const [prefs, setPrefs] = useState(() => loadLocal(userId))
  const saveTimer = useRef(null)

  // Load from server on mount / userId change
  useEffect(() => {
    if (!userId) return
    // Load and migrate the local cache immediately.
    setPrefs(loadLocal(userId))

    // Then fetch the server copy and sanitize legacy data before caching it.
    fetch(`${API_BASE}/api/preferences`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        const sanitized = sanitizePreferences(data)
        setPrefs(sanitized)
        localStorage.setItem(localKey(userId), JSON.stringify(sanitized))
      })
      .catch(() => {})
  }, [userId])

  // Debounced save to server (300ms)
  const persistToServer = useCallback((updated) => {
    const sanitized = sanitizePreferences(updated)
    localStorage.setItem(localKey(userId), JSON.stringify(sanitized))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`${API_BASE}/api/preferences`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(sanitized)
      }).catch(() => {})
    }, 300)
  }, [userId])

  const updatePrefs = useCallback((partial) => {
    setPrefs(prev => {
      const updated = sanitizePreferences({ ...prev, ...partial })
      persistToServer(updated)
      return updated
    })
  }, [persistToServer])

  return { prefs, updatePrefs }
}
