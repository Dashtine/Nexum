// TopstepX authentication and token management.
// Called by: api.js (connect/disconnect), orders.js (getToken for API calls)

const API_BASE = 'https://api.topstepx.com'

let cachedToken = null
let tokenExpiry = 0
let refreshTimer = null
let storedUsername = null
let storedApiKey = null

// Stores credentials in memory for token refresh. Called by api.js on connect.
export function setCredentials(username, apiKey) {
  storedUsername = username
  storedApiKey = apiKey
}

// Clears stored credentials. Called by api.js on disconnect.
export function clearCredentials() {
  storedUsername = null
  storedApiKey = null
  cachedToken = null
  tokenExpiry = 0
}

// Authenticates with TopstepX and caches the token for 23 hours.
// Called by: api.js on connect, getToken() on auto-refresh.
export async function login(username, apiKey) {
  const res = await fetch(`${API_BASE}/api/Auth/loginKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: username, apiKey })
  })
  const data = await res.json()
  if (!data.success) {
    throw new Error(`Auth failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }
  cachedToken = data.token
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000 // 23h (refresh before 24h expiry)
  console.log('[auth] logged in successfully')
  return data.token
}

// Returns a valid token, re-authenticating if expired. Uses stored credentials.
// Called by: orders.js before each API call.
export async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  if (!storedUsername || !storedApiKey) throw new Error('No credentials stored — connect first')
  return login(storedUsername, storedApiKey)
}

// Starts a 30-minute interval that proactively refreshes the token before expiry.
// Called by: api.js after successful connect.
export function startTokenRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(async () => {
    if (!storedUsername || !storedApiKey) return
    if (Date.now() > tokenExpiry - 60 * 60 * 1000) {
      try {
        await login(storedUsername, storedApiKey)
        console.log('[auth] token refreshed proactively')
      } catch (err) {
        console.error('[auth] token refresh failed:', err.message)
      }
    }
  }, 30 * 60 * 1000)
}

// Stops the token refresh interval. Called by: api.js on disconnect, server.js on shutdown.
export function stopTokenRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// Validates the current cached token against the TopstepX API.
// Called by: api.js (optional health check).
export async function validateToken() {
  if (!cachedToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/Auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cachedToken}`
      }
    })
    const data = await res.json()
    return data.success
  } catch {
    return false
  }
}

// Fetches all active trading accounts. Used to validate the account ID on connect.
// Called by: api.js on connect.
export async function searchAccounts(token) {
  const res = await fetch(`${API_BASE}/api/Account/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ onlyActiveAccounts: true })
  })
  const data = await res.json()
  if (!data.success) {
    throw new Error(`Account search failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }
  return data.accounts || []
}
