import { useState, useCallback } from 'react'
import { getUserId } from '../utils/auth'

function getStorageKey() {
  return `nexum-profiles-${getUserId() || 'default'}`
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(getStorageKey())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistProfiles(profiles) {
  localStorage.setItem(getStorageKey(), JSON.stringify(profiles))
}

export function useProfiles() {
  const [profiles, setProfiles] = useState(loadProfiles)

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
      persistProfiles(updated)
      return updated
    })
  }, [])

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => {
      const updated = prev.filter(p => p.id !== id)
      persistProfiles(updated)
      return updated
    })
  }, [])

  return { profiles, saveProfile, deleteProfile }
}
