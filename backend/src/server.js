// Nexum backend entry point — multi-user support with JWT auth.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authenticateUser, authMiddleware, verifyToken } from './nexumAuth.js'
import { addClient } from './logs.js'
import webhookRouter from './routes/webhook.js'
import apiRouter from './routes/api.js'

const PORT = parseInt(process.env.WEBHOOK_PORT) || 3001

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.text())

// Public route — login (no auth required)
app.post('/api/login', async (req, res) => {
  const { userId, password } = req.body
  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password are required' })
  }
  const result = await authenticateUser(userId, password)
  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  res.json({ success: true, token: result.token, userId: result.userId })
})

// SSE endpoint for real-time log streaming — uses token query param for auth.
app.get('/api/logs', (req, res) => {
  const token = req.query.token
  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })
  res.write('\n')
  addClient(decoded.userId, res)
})

// Webhook routes — no JWT auth (TradingView can't send JWTs), uses userId from URL param
app.use('/webhook', webhookRouter)

// All other API routes require JWT auth
app.use('/api', authMiddleware, apiRouter)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

const server = app.listen(PORT, () => {
  console.log(`[server] Nexum backend listening on port ${PORT}`)
  console.log(`[server] webhook endpoint: POST http://localhost:${PORT}/webhook/:userId`)
  console.log(`[server] waiting for connections from web app...`)
})

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[server] ${signal} received, shutting down...`)
  server.close()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
