// Pure TradingView alert parsing logic, kept separate so it can be tested
// without starting Express or connecting to TopstepX.

export function parseAlertFields(body) {
  const text = typeof body === 'string'
    ? body
    : body?.message || body?.alert || JSON.stringify(body ?? {})

  const getMatch = (regex) => {
    const match = text.match(regex)
    return match ? match[1].trim() : null
  }

  const isTest = /\bTEST\b/i.test(text)
  const sideRaw = getMatch(/Position:\s*(BUY|SELL)/i)
  const contractsRaw = getMatch(/Contracts:\s*(\d+)/i)
  const entryRaw = getMatch(/Entry:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const tpRaw = getMatch(/Take Profit:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const slRaw = getMatch(/Stop Loss:\s*([0-9]+(?:\.[0-9]+)?)/i)
  const tpTicksRaw = getMatch(/TpTicks:\s*(\d+)/i)
  const slTicksRaw = getMatch(/SlTicks:\s*(\d+)/i)

  return {
    isTest,
    side: sideRaw ? sideRaw.toLowerCase() : null,
    size: contractsRaw ? parseInt(contractsRaw, 10) : null,
    entryPrice: entryRaw ? parseFloat(entryRaw) : null,
    takeProfitPrice: tpRaw ? parseFloat(tpRaw) : null,
    stopLossPrice: slRaw ? parseFloat(slRaw) : null,
    takeProfitTicks: tpTicksRaw ? parseInt(tpTicksRaw, 10) : 0,
    stopLossTicks: slTicksRaw ? parseInt(slTicksRaw, 10) : 0
  }
}
