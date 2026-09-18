import { useState, useEffect, useCallback } from 'react'
import { API_BASE, authHeaders } from '../utils/auth'

export function useConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState(null)
  const [nextRenewAt, setNextRenewAt] = useState(null)

  // Check initial status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/status`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setIsConnected(data.connected)
        if (data.connected) {
          setConnectionInfo({
            username: data.username,
            accountId: data.inputAccountId,
            symbol: data.inputSymbol
          })
          if (data.nextRenewAt) setNextRenewAt(data.nextRenewAt)
        }
      })
      .catch(() => {})
  }, [])

  const connect = useCallback(async (username, apiKey, accountId, symbol) => {
    setIsConnecting(true)
    try {
      const res = await fetch(`${API_BASE}/api/connect`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ username, apiKey, accountId, symbol })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      setIsConnected(true)
      if (data.nextRenewAt) setNextRenewAt(data.nextRenewAt)
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
      await fetch(`${API_BASE}/api/disconnect`, {
        method: 'POST',
        headers: authHeaders()
      })
    } catch { /* ignore */ }
    setIsConnected(false)
    setConnectionInfo(null)
    setNextRenewAt(null)
  }, [])

  return { isConnected, isConnecting, connectionInfo, nextRenewAt, connect, disconnect }
}
