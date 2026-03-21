// Frontend auth utilities — token storage and auth headers for API calls.

export const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

export function getToken() {
  return localStorage.getItem('nexum-token')
}

export function getUserId() {
  return localStorage.getItem('nexum-userId')
}

export function setAuth(token, userId) {
  localStorage.setItem('nexum-token', token)
  localStorage.setItem('nexum-userId', userId)
}

export function clearAuth() {
  localStorage.removeItem('nexum-token')
  localStorage.removeItem('nexum-userId')
}

export function authHeaders(extra = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...extra }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}
