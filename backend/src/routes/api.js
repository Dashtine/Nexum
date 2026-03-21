// REST API routes for connection management and status.
// Called by: server.js (mounted at /api)

import { Router } from 'express'
import { login, setCredentials, clearCredentials, searchAccounts, startTokenRefresh, stopTokenRefresh, getToken } from '../topstepx/auth.js'
import { connectSignalR, disconnectSignalR, isConnected } from '../topstepx/signalr.js'
import { searchOpenPositions, searchContracts } from '../topstepx/orders.js'
import { updatePosition, clearPositions } from '../topstepx/state.js'
import { broadcast } from '../logs.js'

const router = Router()

// Active session state — consumed by webhook.js for order placement.
export const session = {
  accountId: null,
  contractId: null,
  size: 1
}

// POST /api/connect — validates credentials, starts SignalR, stores session.
// Called by: frontend Connect button.
router.post('/connect', async (req, res) => {
  const { username, apiKey, accountId, symbol } = req.body
  if (!username || !apiKey || !accountId || !symbol) {
    return res.status(400).json({ error: 'username, apiKey, accountId, and symbol are required' })
  }

  try {
    // 1. Authenticate
    broadcast('info', 'Authenticating with TopstepX...')
    setCredentials(username, apiKey)
    const token = await login(username, apiKey)
    broadcast('info', 'Authentication successful')

    // 2. Find account by name or numeric ID
    broadcast('info', 'Validating account...')
    const accounts = await searchAccounts(token)
    const numericId = parseInt(accountId)
    const validAccount = accounts.find(a =>
      a.id === numericId || a.name?.toLowerCase() === accountId.toLowerCase()
    )
    if (!validAccount) {
      clearCredentials()
      broadcast('error', `Account "${accountId}" not found. Available: ${accounts.map(a => `${a.name}`).join(', ')}`)
      return res.status(400).json({ error: `Account "${accountId}" not found. Available: ${accounts.map(a => a.name).join(', ')}` })
    }
    const acctId = validAccount.id
    broadcast('info', `Account validated: ${validAccount.name} (${validAccount.id})`)

    // 3. Resolve symbol to full contract ID
    broadcast('info', `Searching for contract: ${symbol}...`)
    const isLive = !validAccount.name?.toUpperCase().includes('PRACTICE') && !validAccount.name?.toUpperCase().includes('SIM')
    let resolvedContractId = symbol
    try {
      const contracts = await searchContracts(symbol, isLive)
      if (contracts.length > 0) {
        resolvedContractId = contracts[0].id
        broadcast('info', `Contract resolved: ${resolvedContractId}`)
      } else {
        broadcast('warn', `No contracts found for "${symbol}" — using as-is`)
      }
    } catch (err) {
      broadcast('warn', `Contract search failed: ${err.message} — using symbol as-is`)
    }

    // 4. Seed in-memory positions
    try {
      const positions = await searchOpenPositions(acctId)
      for (const pos of positions) updatePosition(pos)
      if (positions.length > 0) {
        broadcast('info', `Loaded ${positions.length} open position(s)`)
      }
    } catch (err) {
      broadcast('warn', `Could not load positions: ${err.message}`)
    }

    // 5. Connect SignalR
    broadcast('info', 'Connecting to real-time feed...')
    await connectSignalR(token, [acctId])
    broadcast('info', 'SignalR connected — listening for updates')

    // 6. Start token refresh and store session
    startTokenRefresh()
    session.accountId = acctId
    session.contractId = resolvedContractId
    session.size = 1

    broadcast('info', `Connected: ${resolvedContractId} on account ${validAccount.name}. Ready for signals.`)
    res.json({ success: true, accountId: acctId, symbol: resolvedContractId })
  } catch (err) {
    clearCredentials()
    broadcast('error', `Connection failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/disconnect — stops SignalR, clears session.
// Called by: frontend Disconnect button.
router.post('/disconnect', async (req, res) => {
  try {
    stopTokenRefresh()
    await disconnectSignalR()
    clearPositions(session.accountId)
    clearCredentials()
    session.accountId = null
    session.contractId = null
    session.size = 1
    broadcast('info', 'Disconnected from TopstepX')
    res.json({ success: true })
  } catch (err) {
    broadcast('error', `Disconnect error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/status — returns connection state for frontend.
// Called by: frontend on load and periodically.
router.get('/status', (req, res) => {
  res.json({
    connected: isConnected(),
    accountId: session.accountId,
    symbol: session.contractId
  })
})

// POST /api/refresh-token — forces a token re-login using stored credentials.
// Called by: frontend auto-renew timer.
router.post('/refresh-token', async (req, res) => {
  if (!session.accountId) {
    return res.status(400).json({ error: 'Not connected' })
  }
  try {
    await getToken()
    broadcast('info', 'Token refreshed (scheduled)')
    res.json({ success: true })
  } catch (err) {
    broadcast('error', `Token refresh failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bars — retrieves historical candle data from TopstepX.
// Called by: frontend Candle Data Export.
router.post('/bars', async (req, res) => {
  const { startTime, endTime, unit, unitNumber, limit } = req.body
  if (!startTime || !endTime || unit == null || !unitNumber) {
    return res.status(400).json({ error: 'startTime, endTime, unit, and unitNumber are required' })
  }
  if (!session.contractId) {
    return res.status(400).json({ error: 'Not connected — connect first to resolve contract' })
  }

  try {
    const token = await getToken()
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
    broadcast('error', `Bar retrieval failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

export default router
