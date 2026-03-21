import { useState, useEffect, useCallback } from 'react'
import { usePreferences } from './hooks/usePreferences'
import { applyScheme, COLOR_SCHEMES } from './hooks/useColorScheme'
import { getToken, getUserId, clearAuth } from './utils/auth'
import LoginOverlay from './components/LoginOverlay'
import MainPage from './pages/MainPage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getToken())
  const [userId, setUserId] = useState(() => getUserId())
  const { prefs, updatePrefs } = usePreferences(userId)

  // Derived state from prefs
  const isDark = prefs.theme === 'dark'
  const schemeId = prefs.colorScheme || 'amber'
  const profiles = prefs.profiles || []

  // Apply theme + color scheme whenever they change
  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
    applyScheme(schemeId, isDark)
  }, [isDark, schemeId])

  const toggleTheme = useCallback(() => {
    updatePrefs({ theme: isDark ? 'light' : 'dark' })
  }, [isDark, updatePrefs])

  const setColorScheme = useCallback((id) => {
    if (COLOR_SCHEMES[id]) updatePrefs({ colorScheme: id })
  }, [updatePrefs])

  const saveProfile = useCallback((data) => {
    const existing = profiles.findIndex(p => p.id === data.id)
    let updated
    if (existing >= 0) {
      updated = [...profiles]
      updated[existing] = { ...data }
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
      updated = [...profiles, { ...data, id }]
    }
    updatePrefs({ profiles: updated })
  }, [profiles, updatePrefs])

  const deleteProfile = useCallback((id) => {
    updatePrefs({ profiles: profiles.filter(p => p.id !== id) })
  }, [profiles, updatePrefs])

  const handleLogin = () => {
    setUserId(getUserId())
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    clearAuth()
    setUserId(null)
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return <LoginOverlay onLogin={handleLogin} />
  }

  return (
    <MainPage
      isDark={isDark}
      toggleTheme={toggleTheme}
      profiles={profiles}
      onSaveProfile={saveProfile}
      onDeleteProfile={deleteProfile}
      schemeId={schemeId}
      onSetColorScheme={setColorScheme}
      onLogout={handleLogout}
      prefs={prefs}
      updatePrefs={updatePrefs}
    />
  )
}

export default App
