// Server-synced preferences hook.
// Loads preferences from server on mount, saves to server on change.
// Also caches in localStorage for instant UI on reload.

import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE, authHeaders } from '../utils/auth'

const DEFAULTS = {
  profiles: [],
  colorScheme: 'amber',
  theme: 'dark',
  autoRenew: { enabled: false, intervalHours: 6 }
}

function localKey(userId) {
  return `nexum-prefs-${userId || 'default'}`
}

function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(localKey(userId))
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
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
    // Load local cache immediately
    setPrefs(loadLocal(userId))

    // Then fetch from server
    fetch(`${API_BASE}/api/preferences`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        const merged = { ...DEFAULTS, ...data }
        setPrefs(merged)
        localStorage.setItem(localKey(userId), JSON.stringify(merged))
      })
      .catch(() => {})
  }, [userId])

  // Debounced save to server (300ms)
  const persistToServer = useCallback((updated) => {
    localStorage.setItem(localKey(userId), JSON.stringify(updated))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`${API_BASE}/api/preferences`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updated)
      }).catch(() => {})
    }, 300)
  }, [userId])

  const updatePrefs = useCallback((partial) => {
    setPrefs(prev => {
      const updated = { ...prev, ...partial }
      persistToServer(updated)
      return updated
    })
  }, [persistToServer])

  return { prefs, updatePrefs }
}
