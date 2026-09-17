import { useState, useEffect, useCallback } from 'react'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function useProfiles(userId) {
  const storageKey = `nexum-profiles-${userId || 'default'}`

  const [profiles, setProfiles] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // Re-load when userId changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setProfiles(raw ? JSON.parse(raw) : [])
    } catch { setProfiles([]) }
  }, [storageKey])

  const saveProfile = useCallback((data) => {
    setProfiles(prev => {
      const existing = prev.findIndex(p => p.id === data.id)
      let updated
      if (existing >= 0) {
        updated = [...prev]
        updated[existing] = { ...data }
      } else {
        updated = [...prev, { ...data, id: generateId() }]
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
