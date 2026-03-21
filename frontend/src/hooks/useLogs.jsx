import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, getToken } from '../utils/auth'

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
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return { logs, clearLogs }
}
