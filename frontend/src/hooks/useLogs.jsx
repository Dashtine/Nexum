import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, getToken, getUserId } from '../utils/auth'

function getStorageKey() { return `nexum-logs-${getUserId() || 'default'}` }

function loadLogs() {
  try {
    const raw = sessionStorage.getItem(getStorageKey())
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
    sessionStorage.setItem(getStorageKey(), JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    const connect = () => {
      const token = getToken()
      if (!token) return

      const es = new EventSource(`${API_BASE}/api/logs?token=${encodeURIComponent(token)}`)
      esRef.current = es

      es.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data)
          setLogs(prev => [...prev, entry])
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        setTimeout(connect, 2000)
      }
    }

    connect()
    return () => esRef.current?.close()
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    sessionStorage.removeItem(getStorageKey())
  }, [])

  return { logs, clearLogs }
}
