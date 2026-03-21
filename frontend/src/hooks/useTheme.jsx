import { useState, useEffect } from 'react'
import { getUserId } from '../utils/auth'

function themeKey() { return `nexum-theme-${getUserId() || 'default'}` }

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(themeKey())
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(themeKey(), isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(prev => !prev)

  return { isDark, toggleTheme }
}
