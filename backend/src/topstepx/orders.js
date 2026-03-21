// TopstepX order placement and position management.
// Called by: webhook.js (placeMarketOrder), api.js (searchOpenPositions on connect)

import { getToken } from './auth.js'

const API_BASE = 'https://api.topstepx.com'

// Places a market order with optional TP/SL brackets.
// Called by: webhook.js when a valid signal is received.
export async function placeMarketOrder({ accountId, contractId, side, size, takeProfitTicks = 0, stopLossTicks = 0}) {
  const token = await getToken()
  const orderSide = side === 'buy' ? 0 : 1

  const body = { accountId, contractId, type: 2, side: orderSide, size }

  if (orderSide === 0) {
    // Buy / Long
    if (takeProfitTicks > 0) {
      body.takeProfitBracket = { ticks: Math.abs(takeProfitTicks), type: 1 }
    }
    if (stopLossTicks > 0) {
      body.stopLossBracket = { ticks: -Math.abs(stopLossTicks), type: 4 }
    }
  } else {
    // Sell / Short
    if (takeProfitTicks > 0) {
      body.takeProfitBracket = { ticks: -Math.abs(takeProfitTicks), type: 1 }
    }
    if (stopLossTicks > 0) {
      body.stopLossBracket = { ticks: Math.abs(stopLossTicks), type: 4 }
    }
  }

  const res = await fetch(`${API_BASE}/api/Order/place`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  if (!data.success) {
    throw new Error(`Order failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }

  console.log(
    `[orders] placed ${side} ${size}x ${contractId} on account ${accountId} → orderId ${data.orderId}`
  )

  return data
}

// Places a standalone limit order.
// Used by: webhook.js for the take-profit exit order.
export async function placeLimitOrder({ accountId, contractId, side, size, limitPrice }) {
  const token = await getToken()
  const orderSide = side === 'buy' ? 0 : 1

  const body = {
    accountId,
    contractId,
    type: 1, // Limit order
    side: orderSide,
    size,
    limitPrice
  }

  const res = await fetch(`${API_BASE}/api/Order/place`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  if (!data.success) {
    throw new Error(`Limit order failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }

  console.log(
    `[orders] placed LIMIT ${side} ${size}x ${contractId} @ ${limitPrice} on account ${accountId} → orderId ${data.orderId}`
  )

  return data
}

// Places a standalone stop order.
// Used by: webhook.js for the stop-loss exit order.
export async function placeStopOrder({ accountId, contractId, side, size, stopPrice }) {
  const token = await getToken()
  const orderSide = side === 'buy' ? 0 : 1

  const body = {
    accountId,
    contractId,
    type: 4, // Stop order
    side: orderSide,
    size,
    stopPrice
  }

  const res = await fetch(`${API_BASE}/api/Order/place`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  if (!data.success) {
    throw new Error(`Stop order failed: ${data.errorMessage || `data.errorCode ${data.errorCode}`}`)
  }

  console.log(
    `[orders] placed STOP ${side} ${size}x ${contractId} @ ${stopPrice} on account ${accountId} → orderId ${data.orderId}`
  )

  return data
}

// Searches for contracts by text. live=false for practice accounts, live=true for funded.
// Called by: api.js on connect to resolve symbol to full contract ID.
export async function searchContracts(searchText, live = false) {
  live = false // Live accounts are not yet available for the API
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/Contract/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ searchText, live })
  })
  const data = await res.json()

  if (!data.success) {
    throw new Error(`Contract search failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }
  return data.contracts || []
}

// Cancels a pending order. Called by: future use (manual cancel from frontend).
export async function cancelOrder(accountId, orderId) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/Order/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ accountId, orderId })
  })
  return res.json()
}

// Closes an entire position for a contract. Called by: future use (manual close).
export async function closePosition(accountId, contractId) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/Position/closeContract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ accountId, contractId })
  })
  return res.json()
}

// Fetches current open positions from the REST API. Used to seed in-memory state on connect.
// Called by: api.js on connect.
export async function searchOpenPositions(accountId) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/Position/searchOpen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ accountId })
  })
  const data = await res.json()
  if (!data.success) {
    throw new Error(`Position search failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }
  return data.positions || []
}
