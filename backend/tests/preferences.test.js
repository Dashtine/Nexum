import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizePreferences, sanitizeProfile } from '../src/preferences.js'

test('removes API keys and tokens from saved profiles', () => {
  const profile = sanitizeProfile({
    id: 'one',
    name: 'Practice',
    username: 'user',
    apiKey: 'secret-key',
    token: 'session-token',
    token_expiry: 'tomorrow',
    accountId: 'PRACTICE123',
    symbol: 'MNQ'
  })

  assert.deepEqual(profile, {
    id: 'one',
    name: 'Practice',
    username: 'user',
    accountId: 'PRACTICE123',
    symbol: 'MNQ'
  })
})

test('sanitizes top-level preference secrets while preserving UI settings', () => {
  const prefs = sanitizePreferences({
    theme: 'dark',
    colorScheme: 'amber',
    apiKey: 'should-not-persist',
    profiles: [
      { id: 'one', name: 'Main', apiKey: 'profile-secret', symbol: 'NQ' }
    ]
  })

  assert.equal(prefs.theme, 'dark')
  assert.equal(prefs.colorScheme, 'amber')
  assert.equal('apiKey' in prefs, false)
  assert.equal('apiKey' in prefs.profiles[0], false)
  assert.equal(prefs.profiles[0].symbol, 'NQ')
})

test('normalizes invalid profiles to an empty list', () => {
  assert.deepEqual(sanitizePreferences({ profiles: null }).profiles, [])
})
