// TopstepX authentication and token management — per-user session support.
// All functions accept a session object that holds per-user token/credential state.

const API_BASE = 'https://api.topstepx.com'

// Stores credentials on the session for token refresh.
export function setCredentials(session, username, apiKey) {
  session.storedUsername = username
  session.storedApiKey = apiKey
}

// Clears stored credentials from session.
export function clearCredentials(session) {
  session.storedUsername = null
  session.storedApiKey = null
  session.token = null
  session.tokenExpiry = 0
}

// Authenticates with TopstepX and caches the token on the session for 23 hours.
export async function login(session, username, apiKey) {
  const res = await fetch(`${API_BASE}/api/Auth/loginKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: username, apiKey })
  })
  const data = await res.json()
  if (!data.success) {
    throw new Error(`Auth failed: ${data.errorMessage || `errorCode ${data.errorCode}`}`)
  }
  session.token = data.token
  session.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000
  session.storedUsername = username
  session.storedApiKey = apiKey
  console.log(`[auth] ${session.userId} logged in successfully`)
  return data.token
}

// Returns a valid token from session, re-authenticating if expired.
export async function getToken(session) {
  if (session.token && Date.now() < session.tokenExpiry) return session.token
  if (!session.storedUsername || !session.storedApiKey) throw new Error('No credentials stored — connect first')
  return login(session, session.storedUsername, session.storedApiKey)
}

// Starts a 30-minute interval that proactively refreshes the token before expiry.
export function startTokenRefresh(session) {
  if (session.refreshTimer) clearInterval(session.refreshTimer)
  session.refreshTimer = setInterval(async () => {
    if (!session.storedUsername || !session.storedApiKey) return
    if (Date.now() > session.tokenExpiry - 60 * 60 * 1000) {
      try {
        await login(session, session.storedUsername, session.storedApiKey)
        console.log(`[auth] ${session.userId} token refreshed proactively`)
      } catch (err) {
        console.error(`[auth] ${session.userId} token refresh failed:`, err.message)
      }
    }
  }, 30 * 60 * 1000)
}

// Stops the token refresh interval for a session.
export function stopTokenRefresh(session) {
  if (session.refreshTimer) {
    clearInterval(session.refreshTimer)
    session.refreshTimer = null
  }
}

// Validates the current cached token against the TopstepX API.
export async function validateToken(session) {
  if (!session.token) return false
  try {
    const res = await fetch(`${API_BASE}/api/Auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      }
    })
    const data = await res.json()
    return data.success
  } catch {
    return false
  }
}

// Fetches all active trading accounts. Stateless — just needs a token.
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
