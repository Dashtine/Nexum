import { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''
const STORAGE_KEY = 'nexum-logs'

function loadLogs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useLogs() {
  const [logs, setLogs] = useState(loadLogs)
  const esRef = useRef(null)

  // Persist logs to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${API_BASE}/api/logs`)
      esRef.current = es

      es.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data)
          setLogs(prev => [...prev, entry])
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        // Auto-reconnect after 2 seconds
        setTimeout(connect, 2000)
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return { logs, clearLogs }
}
