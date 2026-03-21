// TopstepX order placement and position management — per-user session support.
// All functions accept a session object to get the correct user's token.

import { getToken } from './auth.js'

const API_BASE = 'https://api.topstepx.com'

// Places a market order with optional TP/SL brackets.
export async function placeMarketOrder(session, { accountId, contractId, side, size, takeProfitTicks = 0, stopLossTicks = 0 }) {
  const token = await getToken(session)
  const orderSide = side === 'buy' ? 0 : 1

  const body = { accountId, contractId, type: 2, side: orderSide, size }

  if (orderSide === 0) {
    if (takeProfitTicks > 0) {
      body.takeProfitBracket = { ticks: Math.abs(takeProfitTicks), type: 1 }
    }
    if (stopLossTicks > 0) {
      body.stopLossBracket = { ticks: -Math.abs(stopLossTicks), type: 4 }
    }
  } else {
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
export async function placeLimitOrder(session, { accountId, contractId, side, size, limitPrice }) {
  const token = await getToken(session)
  const orderSide = side === 'buy' ? 0 : 1

  const body = {
    accountId,
    contractId,
    type: 1,
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
export async function placeStopOrder(session, { accountId, contractId, side, size, stopPrice }) {
  const token = await getToken(session)
  const orderSide = side === 'buy' ? 0 : 1

  const body = {
    accountId,
    contractId,
    type: 4,
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

// Searches for contracts by text.
export async function searchContracts(session, searchText, live = false) {
  live = false
  const token = await getToken(session)
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

// Cancels a pending order.
export async function cancelOrder(session, accountId, orderId) {
  const token = await getToken(session)
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

// Closes an entire position for a contract.
export async function closePosition(session, accountId, contractId) {
  const token = await getToken(session)
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

// Fetches current open positions from the REST API.
export async function searchOpenPositions(session, accountId) {
  const token = await getToken(session)
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
