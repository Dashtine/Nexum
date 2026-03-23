// SignalR real-time hub connection — per-user session support.
// Each user gets their own SignalR connection stored on their session object.

import * as signalR from '@microsoft/signalr'
import { updatePosition, updateOrder } from './state.js'
import { cancelOrder } from './orders.js'
import { getBracket, clearBracket } from './brackets.js'
import { broadcast } from '../logs.js'

const USER_HUB_URL = 'https://rtc.topstepx.com/hubs/user'

const STATUS_NAMES = { 1: 'Pending', 2: 'Working', 3: 'Rejected', 4: 'Filled', 5: 'Canceled', 6: 'Expired' }

// Connects to the TopstepX SignalR hub for a specific user session.
export async function connectSignalR(session, token, accountIds) {
  if (!token) {
    throw new Error('SignalR connect failed: missing token')
  }

  const accountList = Array.isArray(accountIds) ? accountIds : [accountIds]
  const userId = session.userId

  if (session.connection) {
    session.intentionalClose = true
    await disconnectSignalR(session)
    session.intentionalClose = false
  }

  const hubUrl = `${USER_HUB_URL}?access_token=${encodeURIComponent(token)}`

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (ctx) => {
        return Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 30000)
      }
    })
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  connection.serverTimeoutInMilliseconds = 30000
  connection.keepAliveIntervalInMilliseconds = 15000

  // Position updates
  connection.on('GatewayUserPosition', async (data) => {
    const action = data?.action
    const pos = data?.data ?? data

    if (!pos) {
      console.warn(`[signalr:${userId}] position update missing payload:`, data)
      return
    }

    console.log(
      `[signalr:${userId}] position update: action=${action} ${pos.contractId} size=${pos.size} acct=${pos.accountId}`
    )

    updatePosition(pos)

    // Only broadcast/handle for this session's contract
    if (session.contractId && pos.contractId !== session.contractId) return

    if (pos.size === 0 || action === 2) {
      broadcast(userId, 'trade', `Position closed: ${session.inputSymbol || pos.contractId}`)

      const bracket = getBracket(pos.accountId, pos.contractId)

      if (bracket) {
        const exitOrderIds = [bracket.takeProfitOrderId, bracket.stopLossOrderId].filter(Boolean)

        for (const orderId of exitOrderIds) {
          try {
            const result = await cancelOrder(session, pos.accountId, orderId)

            if (result?.success) {
              console.log(`[signalr:${userId}] canceled leftover exit order ${orderId} for ${pos.contractId}`)
              broadcast(userId, 'info', 'Canceled remaining bracket order')
            } else {
              console.log(
                `[signalr:${userId}] exit order ${orderId} was already inactive: ${result?.errorMessage || 'no-op'}`
              )
            }
          } catch (err) {
            console.error(`[signalr:${userId}] failed to cancel exit order ${orderId}:`, err.message)
          }
        }

        clearBracket(pos.accountId, pos.contractId)
      }
    } else {
      broadcast(userId, 'info', `Position update: ${session.inputSymbol || pos.contractId} × ${pos.size}`)
    }
  })

  // Order updates
  connection.on('GatewayUserOrder', (data) => {
    const action = data?.action
    const order = data?.data ?? data

    if (!order) {
      console.warn(`[signalr:${userId}] order update missing payload:`, data)
      return
    }

    console.log(
      `[signalr:${userId}] order update: action=${action} id=${order.id} status=${order.status} acct=${order.accountId}`
    )

    updateOrder(order)

    // Only broadcast for this session's contract
    if (session.contractId && order.contractId && order.contractId !== session.contractId) return

    const statusName = STATUS_NAMES[order.status] || `status ${order.status}`
    broadcast(userId, 'info', `Order ${statusName.toLowerCase()}`)
  })

  // Trade executions
  connection.on('GatewayUserTrade', (data) => {
    const side = data.side === 0 ? 'BUY' : 'SELL'
    const pnl = data.profitAndLoss

    console.log(`[signalr:${userId}] trade: ${side} ${data.contractId} pnl=${pnl} acct=${data.accountId}`)

    // Only broadcast for this session's contract
    if (session.contractId && data.contractId !== session.contractId) return

    const sym = session.inputSymbol || data.contractId
    if (pnl !== undefined && pnl !== 0) {
      broadcast(userId, 'trade', `Trade closed: ${side} ${sym} P&L: $${pnl}`)
    } else {
      broadcast(userId, 'trade', `Trade fill: ${side} ${data.size || 1}x ${sym} @ ${data.price}`)
    }
  })

  // Account updates
  connection.on('GatewayUserAccount', (data) => {
    const action = data?.action
    const acct = data?.data ?? data

    if (!acct) {
      console.warn(`[signalr:${userId}] account update missing payload:`, data)
      return
    }

    console.log(
      `[signalr:${userId}] account update: action=${action} id=${acct.id} balance=${acct.balance}`
    )
  })

  connection.onreconnecting((err) => {
    console.log(`[signalr:${userId}] reconnecting...`, err?.message)
    broadcast(userId, 'warn', 'Reconnecting to real-time feed...')
  })

  connection.onreconnected(async () => {
    console.log(`[signalr:${userId}] reconnected, resubscribing...`)
    broadcast(userId, 'info', 'Real-time feed reconnected')

    session.accountsSubscriptionActive = false

    for (const accountId of session.subscribedAccounts) {
      await subscribeAccount(session, accountId)
    }
  })

  connection.onclose((err) => {
    console.log(`[signalr:${userId}] connection closed`, err?.message)

    if (!session.intentionalClose) {
      broadcast(userId, 'warn', 'Real-time feed disconnected')
    }
  })

  await connection.start()
  console.log(`[signalr:${userId}] connected to user hub`)

  session.connection = connection

  for (const accountId of accountList) {
    await subscribeAccount(session, accountId)
  }
}

async function subscribeAccount(session, accountId) {
  const connection = session.connection
  if (!connection) return
  if (connection.state !== signalR.HubConnectionState.Connected) {
    console.warn(`[signalr:${session.userId}] cannot subscribe ${accountId}, state=${connection.state}`)
    return
  }

  try {
    if (!session.accountsSubscriptionActive) {
      await connection.invoke('SubscribeAccounts')
      session.accountsSubscriptionActive = true
      console.log(`[signalr:${session.userId}] subscribed to account stream`)
    }

    await connection.invoke('SubscribeOrders', accountId)
    await connection.invoke('SubscribePositions', accountId)
    await connection.invoke('SubscribeTrades', accountId)

    session.subscribedAccounts.add(accountId)
    console.log(`[signalr:${session.userId}] subscribed to account ${accountId}`)
  } catch (err) {
    console.error(`[signalr:${session.userId}] subscribe failed for account ${accountId}:`, err.message)
  }
}

// Disconnects SignalR for a specific user session.
export async function disconnectSignalR(session) {
  const connection = session.connection
  if (connection) {
    try {
      for (const accountId of session.subscribedAccounts) {
        await connection.invoke('UnsubscribeOrders', accountId).catch(() => {})
        await connection.invoke('UnsubscribePositions', accountId).catch(() => {})
        await connection.invoke('UnsubscribeTrades', accountId).catch(() => {})
      }

      if (session.accountsSubscriptionActive) {
        await connection.invoke('UnsubscribeAccounts').catch(() => {})
      }

      await connection.stop()
    } catch (err) {
      console.error(`[signalr:${session.userId}] disconnect error:`, err.message)
    }

    session.connection = null
    session.subscribedAccounts = new Set()
    session.accountsSubscriptionActive = false
  }
}

// Returns whether SignalR is currently connected for a session.
export function isConnected(session) {
  return session.connection?.state === signalR.HubConnectionState.Connected
}
