// SSE log broadcaster — per-user log streams.
// Each user only receives their own log entries.

import { getSession } from './sessions.js'

// Registers an SSE response stream for a specific user.
export function addClient(userId, res) {
  const session = getSession(userId)
  session.logClients.add(res)
  res.on('close', () => session.logClients.delete(res))
}

// Sends a log entry only to the specified user's SSE clients.
export function broadcast(userId, level, message, meta = {}) {
  const session = getSession(userId)
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  }
  const data = `data: ${JSON.stringify(entry)}\n\n`
  for (const client of session.logClients) {
    try {
      client.write(data)
    } catch {
      session.logClients.delete(client)
    }
  }
}
