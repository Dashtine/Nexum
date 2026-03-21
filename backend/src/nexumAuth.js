// Nexum app authentication — JWT tokens and user validation.
// Users are stored in backend/users.json with bcrypt-hashed passwords.

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JWT_SECRET = process.env.JWT_SECRET || 'nexum-change-this-secret'

// Load users from users.json: { "userId": "bcryptHash", ... }
let users = {}
try {
  const raw = readFileSync(join(__dirname, '..', 'users.json'), 'utf-8')
  users = JSON.parse(raw)
  console.log(`[nexumAuth] loaded ${Object.keys(users).length} user(s)`)
} catch {
  console.warn('[nexumAuth] users.json not found — no users configured')
}

export async function authenticateUser(userId, password) {
  const hash = users[userId]
  if (!hash) return null
  const match = await bcrypt.compare(password, hash)
  if (!match) return null
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
  return { token, userId }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// Express middleware — extracts userId from JWT and attaches to req.userId
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const decoded = verifyToken(header.slice(7))
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  req.userId = decoded.userId
  next()
}
