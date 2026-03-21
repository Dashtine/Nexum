import { useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { useProfiles } from './hooks/useProfiles'
import { useColorScheme } from './hooks/useColorScheme'
import { getToken, getUserId, clearAuth } from './utils/auth'
import LoginOverlay from './components/LoginOverlay'
import MainPage from './pages/MainPage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getToken())
  const [userId, setUserId] = useState(() => getUserId())

  const { isDark, toggleTheme } = useTheme(userId)
  const { profiles, saveProfile, deleteProfile } = useProfiles(userId)
  const { schemeId, setColorScheme } = useColorScheme(isDark, userId)

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
    />
  )
}

export default App
