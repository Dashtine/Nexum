// Webhook handler for TradingView alerts. Parses signal, checks position, places market order.
// Called by: TradingView (POST /webhook), frontend test buttons (POST /webhook)

import { Router } from 'express'
import { placeMarketOrder, placeLimitOrder, placeStopOrder } from '../topstepx/orders.js'
import { hasOpenPosition } from '../topstepx/state.js'
import { registerBracket } from '../topstepx/brackets.js'
import { session } from './api.js'
import { broadcast } from '../logs.js'

const router = Router()

// Parses buy/sell signal and parameters from webhook body. Accepts JSON or raw text.
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


// POST /webhook — receives a TradingView alert and places a market order.
// Flow: parse signal → check session → check position (O(1)) → place order.
router.post('/', async (req, res) => {

  const start = Date.now()

  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'Invalid webhook secret' })
  }

  if (!session.accountId || !session.contractId) {
    broadcast('warn', 'Signal received but not connected — ignoring')
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
    broadcast('warn', 'Position already open — skipping signal')
    return res.status(409).json({ error: 'Position already open. Only one trade at a time.' })
  }

  const contractId = req.body.contractId || session.contractId

  try {
    if (isTest) {
      // TEST flow: place market order with tick-based brackets
      broadcast('signal', `TEST order: ${side.toUpperCase()} ${size}x | TP: ${takeProfitTicks} ticks | SL: ${stopLossTicks} ticks`)

      const entryOrder = await placeMarketOrder({
        accountId: session.accountId,
        contractId,
        side,
        size,
        takeProfitTicks,
        stopLossTicks
      })

      const elapsed = Date.now() - start
      broadcast('trade', `TEST bracket placed: ${side.toUpperCase()} ${size}x ${contractId}`)

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
    // 1. Enter immediately
    const entryOrder = await placeMarketOrder({
      accountId: session.accountId,
      contractId,
      side,
      size
    })

    // 2. TP side is opposite of entry
    const exitSide = side === 'buy' ? 'sell' : 'buy'

    const takeProfitOrder = await placeLimitOrder({
      accountId: session.accountId,
      contractId,
      side: exitSide,
      size,
      limitPrice: takeProfitPrice
    })

    // 3. SL side is also opposite of entry
    const stopLossOrder = await placeStopOrder({
      accountId: session.accountId,
      contractId,
      side: exitSide,
      size,
      stopPrice: stopLossPrice
    })

    // Save the active bracket in memory so SignalR can cancel the sibling
    // when one exit order fills and the position closes.
    registerBracket({
      accountId: session.accountId,
      contractId,
      entryOrderId: entryOrder.orderId,
      takeProfitOrderId: takeProfitOrder.orderId,
      stopLossOrderId: stopLossOrder.orderId
    })

    const elapsed = Date.now() - start
    broadcast('trade', `Bracket placed: ${side.toUpperCase()} ${size}x ${contractId}`)

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
    console.error('[webhook] order failed:', err.message)
    broadcast('error', `Order failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

export default router
