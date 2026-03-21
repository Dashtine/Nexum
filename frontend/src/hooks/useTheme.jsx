import { useState, useEffect } from 'react'

export function useTheme(userId) {
  const storageKey = `nexum-theme-${userId || 'default'}`

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? saved === 'dark' : true
  })

  // Re-load when userId changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    setIsDark(saved ? saved === 'dark' : true)
  }, [storageKey])

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(storageKey, isDark ? 'dark' : 'light')
  }, [isDark, storageKey])

  const toggleTheme = () => setIsDark(prev => !prev)

  return { isDark, toggleTheme }
}
