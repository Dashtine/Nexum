// REST API routes for connection management and status — per-user session support.
// All routes use req.userId (set by auth middleware) to get the correct session.

import { Router } from 'express'
import { login, setCredentials, clearCredentials, searchAccounts, startTokenRefresh, stopTokenRefresh, getToken } from '../topstepx/auth.js'
import { connectSignalR, disconnectSignalR, isConnected } from '../topstepx/signalr.js'
import { searchOpenPositions, searchContracts } from '../topstepx/orders.js'
import { updatePosition, clearPositions } from '../topstepx/state.js'
import { broadcast } from '../logs.js'
import { getSession, clearSessionState } from '../sessions.js'

const router = Router()

// POST /api/connect — validates credentials, starts SignalR, stores session.
router.post('/connect', async (req, res) => {
  const { username, apiKey, accountId, symbol } = req.body
  const userId = req.userId
  const session = getSession(userId)

  if (!username || !apiKey || !accountId || !symbol) {
    return res.status(400).json({ error: 'username, apiKey, accountId, and symbol are required' })
  }

  try {
    // 1. Authenticate
    broadcast(userId, 'info', 'Authenticating with TopstepX...')
    setCredentials(session, username, apiKey)
    const token = await login(session, username, apiKey)
    broadcast(userId, 'info', 'Authentication successful')

    // 2. Find account by name or numeric ID
    broadcast(userId, 'info', 'Validating account...')
    const accounts = await searchAccounts(token)
    const numericId = parseInt(accountId)
    const validAccount = accounts.find(a =>
      a.id === numericId || a.name?.toLowerCase() === accountId.toLowerCase()
    )
    if (!validAccount) {
      clearCredentials(session)
      broadcast(userId, 'error', `Account "${accountId}" not found. Available: ${accounts.map(a => `${a.name}`).join(', ')}`)
      return res.status(400).json({ error: `Account "${accountId}" not found. Available: ${accounts.map(a => a.name).join(', ')}` })
    }
    const acctId = validAccount.id
    broadcast(userId, 'info', `Account validated: ${validAccount.name} (${validAccount.id})`)

    // 3. Resolve symbol to full contract ID
    broadcast(userId, 'info', `Searching for contract: ${symbol}...`)
    const isLive = !validAccount.name?.toUpperCase().includes('PRACTICE') && !validAccount.name?.toUpperCase().includes('SIM')
    let resolvedContractId = symbol
    try {
      const contracts = await searchContracts(session, symbol, isLive)
      if (contracts.length > 0) {
        resolvedContractId = contracts[0].id
        broadcast(userId, 'info', `Contract resolved: ${resolvedContractId}`)
      } else {
        broadcast(userId, 'warn', `No contracts found for "${symbol}" — using as-is`)
      }
    } catch (err) {
      broadcast(userId, 'warn', `Contract search failed: ${err.message} — using symbol as-is`)
    }

    // 4. Seed in-memory positions
    try {
      const positions = await searchOpenPositions(session, acctId)
      for (const pos of positions) updatePosition(pos)
      if (positions.length > 0) {
        broadcast(userId, 'info', `Loaded ${positions.length} open position(s)`)
      }
    } catch (err) {
      broadcast(userId, 'warn', `Could not load positions: ${err.message}`)
    }

    // 5. Connect SignalR
    broadcast(userId, 'info', 'Connecting to real-time feed...')
    await connectSignalR(session, token, [acctId])
    broadcast(userId, 'info', 'SignalR connected — listening for updates')

    // 6. Start token refresh and store session
    startTokenRefresh(session)
    session.accountId = acctId
    session.contractId = resolvedContractId
    session.size = 1

    broadcast(userId, 'info', `Connected: ${resolvedContractId} on account ${validAccount.name}. Ready for signals.`)
    res.json({ success: true, accountId: acctId, symbol: resolvedContractId })
  } catch (err) {
    clearCredentials(session)
    broadcast(userId, 'error', `Connection failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/disconnect — stops SignalR, clears session.
router.post('/disconnect', async (req, res) => {
  const userId = req.userId
  const session = getSession(userId)

  try {
    stopTokenRefresh(session)
    await disconnectSignalR(session)
    clearPositions(session.accountId)
    clearCredentials(session)
    clearSessionState(userId)
    broadcast(userId, 'info', 'Disconnected from TopstepX')
    res.json({ success: true })
  } catch (err) {
    broadcast(userId, 'error', `Disconnect error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/status — returns connection state for frontend.
router.get('/status', (req, res) => {
  const session = getSession(req.userId)
  res.json({
    connected: isConnected(session),
    accountId: session.accountId,
    symbol: session.contractId
  })
})

// POST /api/refresh-token — forces a token re-login using stored credentials.
router.post('/refresh-token', async (req, res) => {
  const userId = req.userId
  const session = getSession(userId)

  if (!session.accountId) {
    return res.status(400).json({ error: 'Not connected' })
  }
  try {
    await getToken(session)
    broadcast(userId, 'info', 'Token refreshed (scheduled)')
    res.json({ success: true })
  } catch (err) {
    broadcast(userId, 'error', `Token refresh failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bars — retrieves historical candle data from TopstepX.
router.post('/bars', async (req, res) => {
  const userId = req.userId
  const session = getSession(userId)
  const { startTime, endTime, unit, unitNumber, limit } = req.body

  if (!startTime || !endTime || unit == null || !unitNumber) {
    return res.status(400).json({ error: 'startTime, endTime, unit, and unitNumber are required' })
  }
  if (!session.contractId) {
    return res.status(400).json({ error: 'Not connected — connect first to resolve contract' })
  }

  try {
    const token = await getToken(session)
    const response = await fetch('https://api.topstepx.com/api/History/retrieveBars', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contractId: session.contractId,
        live: false,
        startTime,
        endTime,
        unit,
        unitNumber,
        limit: limit || 20000,
        includePartialBar: false
      })
    })
    const data = await response.json()
    res.json({ success: data.success, bars: data.bars || [], errorMessage: data.errorMessage })
  } catch (err) {
    broadcast(userId, 'error', `Bar retrieval failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

export default router
