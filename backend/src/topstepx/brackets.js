// In-memory bracket tracking for active TP/SL exit orders.
// Used by: webhook.js (register bracket), signalr.js (cancel remaining exit orders on close)

const activeBrackets = new Map()

function makeKey(accountId, contractId) {
  return `${accountId}:${contractId}`
}

// Stores the active exit order IDs for one account/contract pair.
export function registerBracket({ accountId, contractId, entryOrderId, takeProfitOrderId, stopLossOrderId }) {
  const key = makeKey(accountId, contractId)

  activeBrackets.set(key, {
    accountId,
    contractId,
    entryOrderId,
    takeProfitOrderId,
    stopLossOrderId,
    createdAt: Date.now()
  })
}

// Returns the current tracked bracket, if any.
export function getBracket(accountId, contractId) {
  return activeBrackets.get(makeKey(accountId, contractId)) || null
}

// Removes a tracked bracket after the trade is fully done.
export function clearBracket(accountId, contractId) {
  activeBrackets.delete(makeKey(accountId, contractId))
}