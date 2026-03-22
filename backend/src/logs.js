// SSE log broadcaster — per-user log streams with server-side history.
// Each user only receives their own log entries.
// Logs are stored in memory so the frontend can fetch history on reconnect.

import { getSession } from './sessions.js'

const MAX_LOG_HISTORY = 500

// Registers an SSE response stream for a specific user.
export function addClient(userId, res) {
  const session = getSession(userId)
  session.logClients.add(res)
  res.on('close', () => session.logClients.delete(res))
}

// Returns the stored log history for a user.
export function getLogHistory(userId) {
  const session = getSession(userId)
  return session.logHistory
}

// Clears the stored log history for a user.
export function clearLogHistory(userId) {
  const session = getSession(userId)
  session.logHistory = []
}

// Sends a log entry only to the specified user's SSE clients.
// Also stores the entry in server-side history.
export function broadcast(userId, level, message, meta = {}) {
  const session = getSession(userId)
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  }

  // Store in history (cap at MAX_LOG_HISTORY)
  session.logHistory.push(entry)
  if (session.logHistory.length > MAX_LOG_HISTORY) {
    session.logHistory = session.logHistory.slice(-MAX_LOG_HISTORY)
  }

  // Broadcast to connected SSE clients
  const data = `data: ${JSON.stringify(entry)}\n\n`
  for (const client of session.logClients) {
    try {
      client.write(data)
    } catch {
      session.logClients.delete(client)
    }
  }
}
