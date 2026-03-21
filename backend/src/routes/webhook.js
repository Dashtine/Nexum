// Webhook handler for TradingView alerts — per-user routing via /webhook/:userId.
// Each user configures their own webhook URL in TradingView.

import { Router } from 'express'
import { placeMarketOrder, placeLimitOrder, placeStopOrder } from '../topstepx/orders.js'
import { hasOpenPosition } from '../topstepx/state.js'
import { registerBracket } from '../topstepx/brackets.js'
import { getSession } from '../sessions.js'
import { broadcast } from '../logs.js'

const router = Router()

// Parses buy/sell signal and parameters from webhook body.
function parseAlertFields(body) {
  const text = typeof body === 'string'
    ? body
    : body.message || body.alert || JSON.stringify(body)

  const getMatch = (regex) => {
    const m = text.match(regex)
    return m ? m[1].trim() : null
  }

  const isTest = /\bTEST\b/i.test(text)
  const sideRaw = getMatch(/Position:\s*(BUY|SELL)/i)
  const contractsRaw = getMatch(/Contracts:\s*(\d+)/i)
  const entryRaw = getMatch(/Entry:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const tpRaw = getMatch(/Take Profit:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const slRaw = getMatch(/Stop Loss:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const tpTicksRaw = getMatch(/TpTicks:\s*(\d+)/i)
  const slTicksRaw = getMatch(/SlTicks:\s*(\d+)/i)

  return {
    isTest,
    side: sideRaw ? sideRaw.toLowerCase() : null,
    size: contractsRaw ? parseInt(contractsRaw, 10) : null,
    entryPrice: entryRaw ? parseFloat(entryRaw) : null,
    takeProfitPrice: tpRaw ? parseFloat(tpRaw) : null,
    stopLossPrice: slRaw ? parseFloat(slRaw) : null,
    takeProfitTicks: tpTicksRaw ? parseInt(tpTicksRaw, 10) : 0,
    stopLossTicks: slTicksRaw ? parseInt(slTicksRaw, 10) : 0
  }
}

// POST /webhook/:userId — receives a TradingView alert and places orders for the specified user.
router.post('/:userId', async (req, res) => {

  const start = Date.now()
  const userId = req.params.userId
  const session = getSession(userId)

  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'Invalid webhook secret' })
  }

  if (!session.accountId || !session.contractId) {
    broadcast(userId, 'warn', 'Signal received but not connected — ignoring')
    return res.status(503).json({ error: 'Not connected. Connect first via the web app.' })
  }

  const parsed = parseAlertFields(req.body)
  const { isTest, side, size, takeProfitPrice, stopLossPrice, takeProfitTicks, stopLossTicks } = parsed

  if (!side) {
    return res.status(400).json({ error: 'Could not parse Position: BUY/SELL' })
  }

  if (!size || size <= 0) {
    return res.status(400).json({ error: 'Could not parse Contracts' })
  }

  if (!isTest && (!takeProfitPrice || !stopLossPrice)) {
    return res.status(400).json({ error: 'Could not parse Take Profit / Stop Loss prices' })
  }

  if (hasOpenPosition(session.accountId)) {
    broadcast(userId, 'warn', 'Position already open — skipping signal')
    return res.status(409).json({ error: 'Position already open. Only one trade at a time.' })
  }

  const contractId = req.body.contractId || session.contractId

  try {
    if (isTest) {
      // TEST flow: place market order with tick-based brackets
      broadcast(userId, 'signal', `TEST order: ${side.toUpperCase()} ${size}x | TP: ${takeProfitTicks} ticks | SL: ${stopLossTicks} ticks`)

      const entryOrder = await placeMarketOrder(session, {
        accountId: session.accountId,
        contractId,
        side,
        size,
        takeProfitTicks,
        stopLossTicks
      })

      const elapsed = Date.now() - start
      broadcast(userId, 'trade', `TEST bracket placed: ${side.toUpperCase()} ${size}x ${contractId}`)

      return res.json({
        success: true,
        test: true,
        side,
        contractId,
        size,
        entryOrderId: entryOrder.orderId,
        latencyMs: elapsed
      })
    }

    // Normal flow: price-based TP/SL as separate orders
    const entryOrder = await placeMarketOrder(session, {
      accountId: session.accountId,
      contractId,
      side,
      size
    })

    const exitSide = side === 'buy' ? 'sell' : 'buy'

    const takeProfitOrder = await placeLimitOrder(session, {
      accountId: session.accountId,
      contractId,
      side: exitSide,
      size,
      limitPrice: takeProfitPrice
    })

    const stopLossOrder = await placeStopOrder(session, {
      accountId: session.accountId,
      contractId,
      side: exitSide,
      size,
      stopPrice: stopLossPrice
    })

    registerBracket({
      accountId: session.accountId,
      contractId,
      entryOrderId: entryOrder.orderId,
      takeProfitOrderId: takeProfitOrder.orderId,
      stopLossOrderId: stopLossOrder.orderId
    })

    const elapsed = Date.now() - start
    broadcast(userId, 'trade', `Bracket placed: ${side.toUpperCase()} ${size}x ${contractId}`)

    return res.json({
      success: true,
      side,
      contractId,
      size,
      entryOrderId: entryOrder.orderId,
      takeProfitOrderId: takeProfitOrder.orderId,
      stopLossOrderId: stopLossOrder.orderId,
      latencyMs: elapsed
    })
  } catch (err) {
    console.error(`[webhook:${userId}] order failed:`, err.message)
    broadcast(userId, 'error', `Order failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

export default router
