import { useState, useEffect, useCallback } from 'react'

const SENSITIVE_KEYS = ['apiKey', 'token', 'token_expiry', 'tokenExpiry']

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function sanitizeProfile(data = {}) {
  const safe = { ...data }
  for (const key of SENSITIVE_KEYS) delete safe[key]
  return safe
}

function loadProfiles(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    const profiles = raw ? JSON.parse(raw) : []
    const sanitized = Array.isArray(profiles) ? profiles.map(sanitizeProfile) : []
    localStorage.setItem(storageKey, JSON.stringify(sanitized))
    return sanitized
  } catch {
    return []
  }
}

export function useProfiles(userId) {
  const storageKey = `nexum-profiles-${userId || 'default'}`

  const [profiles, setProfiles] = useState(() => loadProfiles(storageKey))

  // Re-load and migrate legacy profiles when userId changes.
  useEffect(() => {
    setProfiles(loadProfiles(storageKey))
  }, [storageKey])

  const saveProfile = useCallback((data) => {
    const safeData = sanitizeProfile(data)
    setProfiles(prev => {
      const existing = prev.findIndex(p => p.id === safeData.id)
      let updated
      if (existing >= 0) {
        updated = [...prev]
        updated[existing] = safeData
      } else {
        updated = [...prev, { ...safeData, id: generateId() }]
      }
      localStorage.setItem(storageKey, JSON.stringify(updated))
      return updated
    })
  }, [storageKey])

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => {
      const updated = prev.filter(p => p.id !== id)
      localStorage.setItem(storageKey, JSON.stringify(updated))
      return updated
    })
  }, [storageKey])

  return { profiles, saveProfile, deleteProfile }
}
