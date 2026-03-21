// SSE log broadcaster — pushes real-time log entries to all connected frontend clients.
// Called by: server.js (SSE endpoint registration), webhook.js, signalr.js, auth.js, api.js

const clients = new Set()

// Registers an SSE response stream. Called from the GET /api/logs endpoint in server.js.
export function addClient(res) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

// Sends a log entry to all connected SSE clients.
// Called from any backend module that needs to push info to the frontend log viewer.
export function broadcast(level, message, meta = {}) {
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    level, // 'info' | 'warn' | 'error' | 'signal' | 'trade'
    message,
    ...meta
  }
  const data = `data: ${JSON.stringify(entry)}\n\n`
  for (const client of clients) {
    client.write(data)
  }
}
