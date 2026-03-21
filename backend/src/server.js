// Nexum backend entry point. Starts Express server without auto-connecting to TopstepX.
// Connection happens when the user clicks Connect in the web app (POST /api/connect).

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { stopTokenRefresh } from './topstepx/auth.js'
import { disconnectSignalR } from './topstepx/signalr.js'
import { addClient } from './logs.js'
import webhookRouter from './routes/webhook.js'
import apiRouter from './routes/api.js'

const PORT = parseInt(process.env.WEBHOOK_PORT) || 3001

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.text())

// Mount routes
app.use('/webhook', webhookRouter)
app.use('/api', apiRouter)

// SSE endpoint for real-time log streaming to the frontend.
app.get('/api/logs', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })
  res.write('\n')
  addClient(res)
})

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

const server = app.listen(PORT, () => {
  console.log(`[server] Nexum backend listening on port ${PORT}`)
  console.log(`[server] webhook endpoint: POST http://localhost:${PORT}/webhook`)
  console.log(`[server] waiting for connection from web app...`)
})

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[server] ${signal} received, shutting down...`)
  stopTokenRefresh()
  await disconnectSignalR()
  server.close()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
