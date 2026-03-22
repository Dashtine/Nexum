import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Link2, Unlink, Eye, EyeOff, ChevronDown, Save, UserPlus, Trash2, Check, RefreshCw, Clock, ArrowUpCircle, ArrowDownCircle, Loader2, Palette, ScrollText, FlaskConical, X, BarChart3, Download, LogOut } from 'lucide-react'
import { COLOR_SCHEMES } from '../hooks/useColorScheme'
import { useConnection } from '../hooks/useConnection'
import { useLogs } from '../hooks/useLogs'
import { API_BASE, getUserId, authHeaders } from '../utils/auth'

const SYMBOLS = ['NQ', 'MNQ', 'GC', 'MGC']

export default function MainPage({ isDark, toggleTheme, profiles, onSaveProfile, onDeleteProfile, schemeId, onSetColorScheme, onLogout, prefs, updatePrefs }) {
  const { isConnected, isConnecting, connect, disconnect } = useConnection()
  const { logs, clearLogs } = useLogs()
  const logEndRef = useRef(null)

  // Profile & credentials state
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('NQ')
  const [showSaveInput, setShowSaveInput] = useState(false)

  // Auto-renew token state (synced from server prefs)
  const autoRenewEnabled = prefs.autoRenew?.enabled || false
  const autoRenewTime = prefs.autoRenew?.time || '04:00'

  // Testing state
  const [sending, setSending] = useState(false)
  const [testContracts, setTestContracts] = useState(1)
  const [testTpTicks, setTestTpTicks] = useState(0)
  const [testSlTicks, setTestSlTicks] = useState(0)

  // Candle data state
  const [candleUnit, setCandleUnit] = useState(2) // Minute
  const [candleUnitNumber, setCandleUnitNumber] = useState(1)
  const [candleStart, setCandleStart] = useState('')
  const [candleEnd, setCandleEnd] = useState('')
  const [fetchingCandles, setFetchingCandles] = useState(false)
  const [candleStatus, setCandleStatus] = useState('')

  // Log filter
  const [logFilter, setLogFilter] = useState('all')

  // Profile delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Auto-renew token at scheduled ET time
  useEffect(() => {
    if (!autoRenewEnabled || !isConnected) return

    let lastFiredDate = null

    const check = () => {
      const now = new Date()
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const localDate = now.toDateString()

      if (localTime === autoRenewTime && lastFiredDate !== localDate) {
        lastFiredDate = localDate
        fetch(`${API_BASE}/api/refresh-token`, { method: 'POST', headers: authHeaders() }).catch(() => {})
      }
    }

    const interval = setInterval(check, 30_000)
    check()
    return () => clearInterval(interval)
  }, [autoRenewEnabled, autoRenewTime, isConnected])

  const loadProfile = (profileId) => {
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) {
      setSelectedProfileId('')
      setProfileName('')
      setUsername('')
      setApiKey('')
      setAccountId('')
      setSelectedSymbol('NQ')
      return
    }
    setSelectedProfileId(profile.id)
    setProfileName(profile.name)
    setUsername(profile.username)
    setApiKey(profile.apiKey)
    setAccountId(profile.accountId)
    setSelectedSymbol(profile.symbol || 'NQ')
  }

  const handleSaveProfile = () => {
    if (!profileName.trim()) return
    onSaveProfile({
      id: selectedProfileId || undefined,
      name: profileName.trim(),
      username, apiKey, accountId,
      symbol: selectedSymbol,
    })
    setShowSaveInput(false)
  }

  const handleSaveAsNew = () => {
    if (!profileName.trim()) return
    onSaveProfile({
      name: profileName.trim(),
      username, apiKey, accountId,
      symbol: selectedSymbol,
    })
    setShowSaveInput(false)
  }

  const handleConnect = async () => {
    if (!username || !apiKey || !accountId || !selectedSymbol) return
    try {
      await connect(username, apiKey, accountId, selectedSymbol)
    } catch { /* errors appear in log */ }
  }

  const handleDisconnect = async () => {
    await disconnect()
  }

  const handleAutoRenewToggle = (enabled) => {
    updatePrefs({ autoRenew: { ...prefs.autoRenew, enabled } })
  }

  const handleAutoRenewTimeChange = (time) => {
    updatePrefs({ autoRenew: { ...prefs.autoRenew, time } })
  }

  const sendTestOrder = async (side) => {
    setSending(true)

    const message = `TEST
        Position: ${side === 'buy' ? 'BUY' : 'SELL'}
        Contracts: ${testContracts}
        TpTicks: ${testTpTicks}
        SlTicks: ${testSlTicks}`

    const webhookUrl = `${API_BASE}/webhook/${getUserId()}`

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
    } catch {
      /* errors appear in log */
    }

    setSending(false)
  }

  const handleDeleteProfile = (id) => {
    onDeleteProfile(id)
    setDeleteConfirm(null)
    if (selectedProfileId === id) {
      loadProfile('')
    }
  }

  const UNIT_LABELS = { 1: 's', 2: 'm', 3: 'h', 4: 'D', 5: 'W', 6: 'M' }

  const pstToUtc = (pstDateStr) => {
    // PST is UTC-8, PDT is UTC-7. Use America/Los_Angeles for automatic DST handling.
    const localDate = new Date(pstDateStr)
    // Create a date string interpreted as PST/PDT
    const pst = new Date(localDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const utc = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }))
    const offset = pst - utc // ms difference
    return new Date(localDate.getTime() - offset)
  }

  const utcToPst = (utcDateStr) => {
    return new Date(new Date(utcDateStr).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  }

  const formatPstDate = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
  }

  const downloadCsv = (bars, unitLabel) => {
    if (!bars.length) {
      setCandleStatus('No candle data returned.')
      return
    }
    // Sort oldest to newest
    bars.sort((a, b) => new Date(a.t) - new Date(b.t))

    // Deduplicate by timestamp
    const seen = new Set()
    const unique = bars.filter(b => {
      const key = b.t
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Convert to PST
    const rows = unique.map(b => {
      const pst = utcToPst(b.t)
      return { time: formatPstDate(pst), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }
    })

    const oldest = utcToPst(unique[0].t)
    const newest = utcToPst(unique[unique.length - 1].t)
    const fmtFile = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${d.getFullYear()}`
    const filename = `${candleUnitNumber}${unitLabel}_${fmtFile(oldest)}_${fmtFile(newest)}.csv`

    const csv = 'Time (PST),Open,High,Low,Close,Volume\n' +
      rows.map(r => `${r.time},${r.open},${r.high},${r.low},${r.close},${r.volume}`).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setCandleStatus(`Downloaded ${unique.length} candles → ${filename}`)
  }

  const fetchAllBars = async (startTimeUtc, endTimeUtc) => {
    const LIMIT = 20000
    let allBars = []
    let currentStart = new Date(startTimeUtc)
    const end = new Date(endTimeUtc)

    while (currentStart < end) {
      setCandleStatus(`Fetching candles... (${allBars.length} so far)`)
      const res = await fetch(`${API_BASE}/api/bars`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          startTime: currentStart.toISOString(),
          endTime: end.toISOString(),
          unit: candleUnit,
          unitNumber: candleUnitNumber,
          limit: LIMIT,
        })
      })
      const data = await res.json()
      if (!data.success || !data.bars || data.bars.length === 0) break

      allBars = allBars.concat(data.bars)

      if (data.bars.length < LIMIT) break // got everything

      // Next batch starts after the last bar we received
      const lastBarTime = new Date(data.bars[data.bars.length - 1].t)
      const nextStart = new Date(lastBarTime.getTime() + 1) // +1ms to avoid overlap
      if (nextStart <= currentStart) break // safety: no progress
      currentStart = nextStart
    }

    return allBars
  }

  const handleGetCandlesRange = async () => {
    if (!candleStart || !candleEnd) return
    setFetchingCandles(true)
    setCandleStatus('Starting...')
    try {
      const startUtc = pstToUtc(candleStart)
      const endUtc = pstToUtc(candleEnd)
      const bars = await fetchAllBars(startUtc, endUtc)
      downloadCsv(bars, UNIT_LABELS[candleUnit] || 'm')
    } catch (err) {
      setCandleStatus(`Error: ${err.message}`)
    }
    setFetchingCandles(false)
  }

  const handleGetAllCandles = async () => {
    setFetchingCandles(true)
    setCandleStatus('Starting...')
    try {
      // Work backwards from now until we get less than 20000 bars (meaning we've hit the oldest data)
      const LIMIT = 20000
      let allBars = []
      let currentEnd = new Date() // start from now

      while (true) {
        setCandleStatus(`Fetching candles... (${allBars.length} so far)`)
        const res = await fetch(`${API_BASE}/api/bars`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            startTime: new Date('2000-01-01T00:00:00Z').toISOString(),
            endTime: currentEnd.toISOString(),
            unit: candleUnit,
            unitNumber: candleUnitNumber,
            limit: LIMIT,
          })
        })
        const data = await res.json()
        if (!data.success || !data.bars || data.bars.length === 0) break

        allBars = allBars.concat(data.bars)

        if (data.bars.length < LIMIT) break // reached the oldest data

        // Next batch ends just before the oldest bar we received
        const oldestBarTime = new Date(
          data.bars.reduce((min, b) => new Date(b.t) < new Date(min) ? b.t : min, data.bars[0].t)
        )
        const nextEnd = new Date(oldestBarTime.getTime() - 1) // -1ms to avoid overlap
        if (nextEnd >= currentEnd) break // safety: no progress
        currentEnd = nextEnd
      }

      downloadCsv(allBars, UNIT_LABELS[candleUnit] || 'm')
    } catch (err) {
      setCandleStatus(`Error: ${err.message}`)
    }
    setFetchingCandles(false)
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-[var(--color-loss)]'
      case 'warn': return 'text-[var(--color-warning)]'
      case 'signal': return 'text-[var(--color-accent)]'
      case 'trade': return 'text-[var(--color-profit)]'
      case 'alert': return 'text-[var(--color-warning)]'
      default: return 'text-[var(--color-text-secondary)]'
    }
  }

  const getLevelBg = (level) => {
    switch (level) {
      case 'error': return 'bg-[var(--color-loss)]/5'
      case 'warn': return 'bg-[var(--color-warning)]/5'
      case 'signal': return 'bg-[var(--color-accent)]/5'
      case 'trade': return 'bg-[var(--color-profit)]/5'
      case 'alert': return 'bg-[var(--color-warning)]/5'
      default: return ''
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors'
  const labelClass = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* ── Header ── */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--color-accent)] tracking-wider">NEXUM</h1>
          <div className="flex items-center gap-3">
            {/* Color scheme swatches */}
            <div className="flex items-center gap-1.5">
              {Object.entries(COLOR_SCHEMES).map(([id, scheme]) => (
                <button
                  key={id}
                  onClick={() => onSetColorScheme(id)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${schemeId === id ? 'border-[var(--color-text-primary)] scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: scheme.accent }}
                  title={scheme.name}
                />
              ))}
            </div>
            <div className="w-px h-5 bg-[var(--color-border)]" />
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="w-px h-5 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-secondary)]">{getUserId()}</span>
            <button onClick={onLogout} className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* ── Connection Card ── */}
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">TopstepX Connection</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-[var(--color-profit)]/10 text-[var(--color-profit)]'
                : 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--color-profit)]' : 'bg-[var(--color-text-secondary)]'}`} />
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Profile Selector */}
          <div className="flex items-end gap-3 mb-4 pb-4 border-b border-[var(--color-border)]">
            <div className="flex-1 max-w-[280px]">
              <label className={labelClass}>Profile</label>
              <div className="relative">
                <select
                  value={selectedProfileId}
                  onChange={e => loadProfile(e.target.value)}
                  disabled={isConnected}
                  className={`${inputClass} appearance-none pr-8`}
                >
                  <option value="">No profile selected</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
              </div>
            </div>

            {showSaveInput ? (
              <div className="flex items-end gap-2">
                <div>
                  <label className={labelClass}>Profile Name</label>
                  <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="e.g. Main Account" className={`${inputClass} w-[180px]`} />
                </div>
                <button onClick={handleSaveProfile} disabled={!profileName.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Save size={14} /> Save
                </button>
                {selectedProfileId && (
                  <button onClick={handleSaveAsNew} disabled={!profileName.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors">
                    <UserPlus size={14} /> Save As New
                  </button>
                )}
                <button onClick={() => setShowSaveInput(false)} className="px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => { setShowSaveInput(true); if (!profileName) setProfileName('') }} disabled={isConnected} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors">
                <Save size={14} /> Save Profile
              </button>
            )}
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className={labelClass}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={isConnected} placeholder="TopstepX username" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>API Key</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={isConnected} placeholder="Your API key" className={inputClass} />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Account</label>
              <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} disabled={isConnected} placeholder="e.g. PRACTICEOCT2915538979" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Symbol</label>
              <div className="relative">
                <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} disabled={isConnected} className={`${inputClass} appearance-none pr-8`}>
                  {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end">
              {!isConnected ? (
                <button onClick={handleConnect} disabled={!username || !apiKey || !accountId || isConnecting} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              ) : (
                <button onClick={handleDisconnect} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-loss)] text-white hover:opacity-90 transition-colors">
                  <Unlink size={14} /> Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Auto-Renew Token + Profile Management row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border)]">
            {/* Auto-Renew Token */}
            <div className="flex items-start gap-3">
              <RefreshCw size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">Auto-Regenerate Token</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={autoRenewEnabled} onChange={e => handleAutoRenewToggle(e.target.checked)} className="sr-only peer" />
                    <div className="w-8 h-4.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-accent)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5" />
                  </label>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">Tokens expire after 24h.</p>
                {autoRenewEnabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <Clock size={12} className="text-[var(--color-text-secondary)]" />
                    <input type="time" value={autoRenewTime} onChange={e => handleAutoRenewTimeChange(e.target.value)} className={`${inputClass} max-w-[130px] text-xs`} />
                    <span className="text-xs text-[var(--color-text-secondary)]">local</span>
                  </div>
                )}
              </div>
            </div>

            {/* Saved Profiles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-[var(--color-accent)]" />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Saved Profiles</span>
              </div>
              {profiles.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">No profiles saved yet.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={deleteConfirm || ''}
                      onChange={e => setDeleteConfirm(e.target.value || null)}
                      className={`${inputClass} appearance-none pr-8 text-xs`}
                    >
                      <option value="">Select a profile to manage</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.symbol ? ` (${p.symbol})` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                  </div>
                  {deleteConfirm && (
                    <button
                      onClick={() => handleDeleteProfile(deleteConfirm)}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-[var(--color-loss)] text-white hover:opacity-90 transition-colors shrink-0"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Log Viewer ── */}
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ScrollText size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Logs</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">({logs.length})</span>
              <div className="flex items-center gap-0.5 ml-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] p-0.5">
                {['all', 'info', 'trade', 'signal', 'warn', 'error', 'alert'].map(level => (
                  <button
                    key={level}
                    onClick={() => setLogFilter(level)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      logFilter === level
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {level === 'alert' ? 'Alerts' : level}
                  </button>
                ))}
              </div>
            </div>
            {logs.length > 0 && (
              <button onClick={clearLogs} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <div className="h-[340px] overflow-y-auto rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-center py-8">No logs yet. Connect to TopstepX to start.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {logs.filter(log => logFilter === 'all' ? log.level !== 'alert' : log.level === logFilter).map(log => (
                  <div key={log.id} className={`flex gap-2 px-2 py-1 rounded ${getLevelBg(log.level)}`}>
                    <span className="text-[var(--color-text-secondary)] shrink-0 whitespace-nowrap">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                    <span className={`shrink-0 w-[50px] font-semibold uppercase ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-[var(--color-text-primary)]">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* ── Testing Card ── */}
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Testing</h2>
          </div>

          {/* ── Test Orders ── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className={labelClass}>Contracts</label>
              <input type="number" min="1" value={testContracts} onChange={e => setTestContracts(Math.max(1, parseInt(e.target.value) || 1))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Take Profit (ticks)</label>
              <input type="number" min="0" value={testTpTicks} onChange={e => setTestTpTicks(Math.max(0, parseInt(e.target.value) || 0))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Stop Loss (ticks)</label>
              <input type="number" min="0" value={testSlTicks} onChange={e => setTestSlTicks(Math.max(0, parseInt(e.target.value) || 0))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => sendTestOrder('buy')}
              disabled={sending || !isConnected}
              className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white bg-[color-mix(in_srgb,var(--color-profit)_85%,black)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={16} />}
              BUY / LONG
            </button>
            <button
              onClick={() => sendTestOrder('sell')}
              disabled={sending || !isConnected}
              className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white bg-[color-mix(in_srgb,var(--color-loss)_85%,black)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownCircle size={16} />}
              SELL / SHORT
            </button>
          </div>

          {/* ── Candle Data ── */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Candle Data Export</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Time Frame</label>
                <div className="relative">
                  <select value={candleUnit} onChange={e => setCandleUnit(Number(e.target.value))} className={`${inputClass} appearance-none pr-8`}>
                    <option value={1}>Second</option>
                    <option value={2}>Minute</option>
                    <option value={3}>Hour</option>
                    <option value={4}>Day</option>
                    <option value={5}>Week</option>
                    <option value={6}>Month</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Interval</label>
                <input type="number" min="1" value={candleUnitNumber} onChange={e => setCandleUnitNumber(Math.max(1, parseInt(e.target.value) || 1))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Start (PST)</label>
                <input type="datetime-local" value={candleStart} onChange={e => setCandleStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End (PST)</label>
                <input type="datetime-local" value={candleEnd} onChange={e => setCandleEnd(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGetCandlesRange}
                disabled={fetchingCandles || !isConnected || !candleStart || !candleEnd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {fetchingCandles ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Export Range
              </button>
              <button
                onClick={handleGetAllCandles}
                disabled={fetchingCandles || !isConnected}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {fetchingCandles ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Get All (to now)
              </button>
              {candleStatus && (
                <span className="text-xs text-[var(--color-text-secondary)]">{candleStatus}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
