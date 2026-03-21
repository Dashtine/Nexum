import { useState } from 'react'
import { Lock } from 'lucide-react'
import { API_BASE, setAuth } from '../utils/auth'

export default function LoginOverlay({ onLogin }) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        return
      }

      setAuth(data.token, data.userId)
      onLogin()
    } catch {
      setError('Connection failed')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-sm p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl transition-transform ${shake ? 'animate-shake' : ''}`}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Lock size={24} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">NEXUM</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={userId}
            onChange={e => { setUserId(e.target.value); setError('') }}
            placeholder="User ID"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors mb-3"
          />
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors mb-3"
          />
          {error && (
            <p className="text-xs text-[var(--color-loss)] mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={!userId.trim() || !password.trim() || loading}
            className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  )
}
