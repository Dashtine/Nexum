import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, getToken } from '../utils/auth'

export function useLogs() {
  const [logs, setLogs] = useState([])
  const esRef = useRef(null)

  useEffect(() => {
    const token = getToken()
    if (!token) return

    // Fetch log history first (logs that happened while browser was closed)
    fetch(`${API_BASE}/api/log-history?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(history => {
        if (Array.isArray(history) && history.length > 0) {
          setLogs(history)
        }
      })
      .catch(() => {})
      .finally(() => {
        // Then connect SSE for new logs
        connectSSE(token)
      })

    function connectSSE(t) {
      const es = new EventSource(`${API_BASE}/api/logs?token=${encodeURIComponent(t)}`)
      esRef.current = es

      es.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data)
          setLogs(prev => [...prev, entry])
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        setTimeout(() => connectSSE(t), 2000)
      }
    }

    return () => esRef.current?.close()
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    // Also clear server-side history
    const token = getToken()
    if (token) {
      fetch(`${API_BASE}/api/clear-log-history?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
    }
  }, [])

  return { logs, clearLogs }
}
