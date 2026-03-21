// SignalR real-time hub connection for position, order, and trade updates.
// Called by: api.js (connect/disconnect), server.js (shutdown)

import * as signalR from '@microsoft/signalr'
import { updatePosition, updateOrder } from './state.js'
import { cancelOrder } from './orders.js'
import { getBracket, clearBracket } from './brackets.js'
import { broadcast } from '../logs.js'

// NOTE:
// Use the TopstepX hub domain here to match the rest of the bot, since the REST side
// is still using api.topstepx.com. Mixing topstepx.com tokens with thefuturesdesk.projectx.com
// hub URLs can cause the connection to open and then immediately close.
const USER_HUB_URL = 'https://rtc.topstepx.com/hubs/user'

let connection = null
let subscribedAccounts = new Set()
let intentionalClose = false
let accountsSubscriptionActive = false

// Connects to the TopstepX SignalR hub and subscribes to real-time updates.
// Called by: api.js on connect.
export async function connectSignalR(token, accountIds) {
  if (!token) {
    throw new Error('SignalR connect failed: missing token')
  }

  // Normalize accountIds so we always work with an array.
  const accountList = Array.isArray(accountIds) ? accountIds : [accountIds]

  if (connection) {
    intentionalClose = true
    await disconnectSignalR()
    intentionalClose = false
  }

  const hubUrl = `${USER_HUB_URL}?access_token=${encodeURIComponent(token)}`

  connection = new signalR.HubConnectionBuilder()
    // Keep this simple and close to the old Flask bot that worked.
    // Do not force transport / skipNegotiation yet.
    .withUrl(hubUrl)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (ctx) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        return Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 30000)
      }
    })
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  connection.serverTimeoutInMilliseconds = 30000
  connection.keepAliveIntervalInMilliseconds = 15000

  // Position updates — broadcast to frontend log and update in-memory state
  connection.on('GatewayUserPosition', async (data) => {
    const action = data?.action
    const pos = data?.data ?? data

    if (!pos) {
      console.warn('[signalr] position update missing payload:', data)
      return
    }

    console.log(
      `[signalr] position update: action=${action} ${pos.contractId} size=${pos.size} acct=${pos.accountId}`
    )

    updatePosition(pos)

    // When the position is fully closed, cancel any leftover TP/SL sibling order.
    if (pos.size === 0 || action === 2) {
      broadcast('trade', `Position closed: ${pos.contractId}`)

      const bracket = getBracket(pos.accountId, pos.contractId)

      if (bracket) {
        const exitOrderIds = [bracket.takeProfitOrderId, bracket.stopLossOrderId].filter(Boolean)

        for (const orderId of exitOrderIds) {
          try {
            const result = await cancelOrder(pos.accountId, orderId)

            // Some brokers return success=false if the order was already filled/canceled.
            // That is fine here — we are simply sweeping away anything still alive.
            if (result?.success) {
              console.log(`[signalr] canceled leftover exit order ${orderId} for ${pos.contractId}`)
              broadcast('info', `Canceled remaining exit order ${orderId}`)
            } else {
              console.log(
                `[signalr] exit order ${orderId} was already inactive: ${result?.errorMessage || 'no-op'}`
              )
            }
          } catch (err) {
            console.error(`[signalr] failed to cancel exit order ${orderId}:`, err.message)
          }
        }

        clearBracket(pos.accountId, pos.contractId)
      }
    } else {
      broadcast('info', `Position update: ${pos.contractId} size=${pos.size}`)
    }
  })
  
  // Order updates — broadcast status changes to frontend log
  connection.on('GatewayUserOrder', (data) => {
    const action = data?.action
    const order = data?.data ?? data

    if (!order) {
      console.warn('[signalr] order update missing payload:', data)
      return
    }

    console.log(
      `[signalr] order update: action=${action} id=${order.id} status=${order.status} acct=${order.accountId}`
    )

    updateOrder(order)
    broadcast('info', `Order ${order.id}: status=${order.status}`)
  })


  // Trade executions — broadcast to frontend log (no DB storage)
  connection.on('GatewayUserTrade', (data) => {
    const side = data.side === 0 ? 'BUY' : 'SELL'
    const pnl = data.profitAndLoss

    console.log(`[signalr] trade: ${side} ${data.contractId} pnl=${pnl} acct=${data.accountId}`)

    if (pnl !== undefined && pnl !== 0) {
      broadcast('trade', `Trade closed: ${side} ${data.contractId} P&L: $${pnl}`)
    } else {
      broadcast('trade', `Trade fill: ${side} ${data.size || 1}x ${data.contractId} @ ${data.price}`)
    }
  })

  // Account updates
  connection.on('GatewayUserAccount', (data) => {
    const action = data?.action
    const acct = data?.data ?? data

    if (!acct) {
      console.warn('[signalr] account update missing payload:', data)
      return
    }

    console.log(
      `[signalr] account update: action=${action} id=${acct.id} balance=${acct.balance}`
    )
  })

  connection.onreconnecting((err) => {
    console.log('[signalr] reconnecting...', err?.message)
    broadcast('warn', 'SignalR reconnecting...')
  })

  connection.onreconnected(async () => {
    console.log('[signalr] reconnected, resubscribing...')
    broadcast('info', 'SignalR reconnected')

    accountsSubscriptionActive = false

    for (const accountId of subscribedAccounts) {
      await subscribeAccount(accountId)
    }
  })

  connection.onclose((err) => {
    console.log('[signalr] connection closed', err?.message)

    // Do not broadcast a warning when we intentionally closed the connection ourselves.
    if (!intentionalClose) {
      broadcast('warn', 'SignalR connection closed')
    }
  })

  await connection.start()
  console.log('[signalr] connected to user hub')

  // Subscribe to all accounts
  for (const accountId of accountList) {
    await subscribeAccount(accountId)
  }
}

async function subscribeAccount(accountId) {
  if (!connection) return
  if (connection.state !== signalR.HubConnectionState.Connected) {
    console.warn(`[signalr] cannot subscribe ${accountId}, state=${connection.state}`)
    return
  }

  try {
    // Subscribe to account-level updates once per connection.
    if (!accountsSubscriptionActive) {
      await connection.invoke('SubscribeAccounts')
      accountsSubscriptionActive = true
      console.log('[signalr] subscribed to account stream')
    }

    // Subscribe to account-specific streams.
    await connection.invoke('SubscribeOrders', accountId)
    await connection.invoke('SubscribePositions', accountId)
    await connection.invoke('SubscribeTrades', accountId)

    subscribedAccounts.add(accountId)
    console.log(`[signalr] subscribed to account ${accountId}`)
  } catch (err) {
    console.error(`[signalr] subscribe failed for account ${accountId}:`, err.message)
  }
}

// Disconnects SignalR, unsubscribes from all accounts.
// Called by: api.js on disconnect, server.js on shutdown.
export async function disconnectSignalR() {
  if (connection) {
    try {
      for (const accountId of subscribedAccounts) {
        await connection.invoke('UnsubscribeOrders', accountId).catch(() => {})
        await connection.invoke('UnsubscribePositions', accountId).catch(() => {})
        await connection.invoke('UnsubscribeTrades', accountId).catch(() => {})
      }

      if (accountsSubscriptionActive) {
        await connection.invoke('UnsubscribeAccounts').catch(() => {})
      }

      await connection.stop()
    } catch (err) {
      console.error('[signalr] disconnect error:', err.message)
    }

    connection = null
    subscribedAccounts.clear()
    accountsSubscriptionActive = false
  }
}

// Returns whether SignalR is currently connected.
// Called by: api.js for status endpoint.
export function isConnected() {
  return connection?.state === signalR.HubConnectionState.Connected
}