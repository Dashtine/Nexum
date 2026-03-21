import { useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { useProfiles } from './hooks/useProfiles'
import { useColorScheme } from './hooks/useColorScheme'
import { getToken, clearAuth } from './utils/auth'
import LoginOverlay from './components/LoginOverlay'
import MainPage from './pages/MainPage'

function App() {
  const { isDark, toggleTheme } = useTheme()
  const { profiles, saveProfile, deleteProfile } = useProfiles()
  const { schemeId, setColorScheme } = useColorScheme(isDark)
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getToken())

  const handleLogout = () => {
    clearAuth()
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return <LoginOverlay onLogin={() => setIsLoggedIn(true)} />
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
