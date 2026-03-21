import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

export function useConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Check initial status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(res => res.json())
      .then(data => setIsConnected(data.connected))
      .catch(() => {})
  }, [])

  const connect = useCallback(async (username, apiKey, accountId, symbol) => {
    setIsConnecting(true)
    try {
      const res = await fetch(`${API_BASE}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, apiKey, accountId, symbol })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      setIsConnected(true)
      return data
    } catch (err) {
      setIsConnected(false)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/disconnect`, { method: 'POST' })
    } catch { /* ignore */ }
    setIsConnected(false)
  }, [])

  return { isConnected, isConnecting, connect, disconnect }
}
