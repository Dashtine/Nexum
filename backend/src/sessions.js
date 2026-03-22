// Per-user session manager — each user gets their own isolated state.
// Holds TopstepX auth, SignalR connection, and SSE log clients per user.

const sessions = new Map()

export function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      userId,
      // TopstepX connection
      accountId: null,
      contractId: null,
      size: 1,
      // TopstepX auth
      token: null,
      tokenExpiry: 0,
      storedUsername: null,
      storedApiKey: null,
      refreshTimer: null,
      // SignalR
      connection: null,
      subscribedAccounts: new Set(),
      intentionalClose: false,
      accountsSubscriptionActive: false,
      // SSE log clients
      logClients: new Set(),
      // Server-side log history (kept in memory while session is alive)
      logHistory: [],
    })
  }
  return sessions.get(userId)
}

export function clearSessionState(userId) {
  const s = sessions.get(userId)
  if (s) {
    if (s.refreshTimer) clearInterval(s.refreshTimer)
    s.accountId = null
    s.contractId = null
    s.token = null
    s.tokenExpiry = 0
    s.storedUsername = null
    s.storedApiKey = null
    s.refreshTimer = null
    s.connection = null
    s.subscribedAccounts = new Set()
    s.intentionalClose = false
    s.accountsSubscriptionActive = false
  }
}
