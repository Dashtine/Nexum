// In-memory state for positions and orders — kept up to date via SignalR.
// This is what makes the webhook handler fast: O(1) lookups, no API calls.
// Called by: signalr.js (updates), webhook.js (reads), api.js (connect seeding)

// positions: Map<accountId, Map<contractId, PositionModel>>
const positions = new Map()

// orders: Map<accountId, Map<orderId, OrderModel>>
const orders = new Map()

// Checks if any position is open for the given account. O(1) lookup.
export function hasOpenPosition(accountId) {
  const acctPositions = positions.get(accountId)
  if (!acctPositions) return false
  for (const pos of acctPositions.values()) {
    if (pos.size !== 0) return true
  }
  return false
}

// Checks if a position is open for a specific contract on an account.
// Called by: webhook.js before placing an order (supports multi-symbol per account).
export function hasOpenPositionForContract(accountId, contractId) {
  const pos = positions.get(accountId)?.get(contractId)
  return pos ? pos.size !== 0 : false
}

// Returns a specific position by account and contract, or null.
// Called by: api.js, signalr.js
export function getOpenPosition(accountId, contractId) {
  return positions.get(accountId)?.get(contractId) || null
}

// Returns all non-zero positions for an account.
// Called by: api.js
export function getAllPositions(accountId) {
  const acctPositions = positions.get(accountId)
  if (!acctPositions) return []
  return [...acctPositions.values()].filter(p => p.size !== 0)
}

// Adds or removes a position from in-memory state.
// Called by: signalr.js on GatewayUserPosition events, api.js during connect seeding.
export function updatePosition(data) {
  const { accountId, contractId } = data
  if (!positions.has(accountId)) positions.set(accountId, new Map())
  if (data.size === 0) {
    positions.get(accountId).delete(contractId)
  } else {
    positions.get(accountId).set(contractId, data)
  }
}

// Clears all positions for an account.
// Called by: api.js on disconnect.
export function clearPositions(accountId) {
  positions.delete(accountId)
}

// Adds or updates an order in in-memory state.
// Called by: signalr.js on GatewayUserOrder events.
export function updateOrder(data) {
  const { accountId, id } = data
  if (!orders.has(accountId)) orders.set(accountId, new Map())
  orders.get(accountId).set(id, data)
}

// Removes a specific order from in-memory state.
// Called by: signalr.js when an order is filled/cancelled.
export function removeOrder(accountId, orderId) {
  orders.get(accountId)?.delete(orderId)
}

// Returns all open orders for an account.
// Called by: api.js
export function getOpenOrders(accountId) {
  const acctOrders = orders.get(accountId)
  if (!acctOrders) return []
  return [...acctOrders.values()]
}
