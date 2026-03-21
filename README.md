# Nexum

Nexum is a self-hosted trading bridge that connects [TradingView](https://www.tradingview.com/) alerts to [TopstepX](https://www.topstepx.com/) for automated futures order execution. It receives webhook signals, places market orders with bracket exits (take-profit and stop-loss), and manages positions in real time via SignalR.

## How It Works

```
TradingView Alert ──► Nexum Backend (webhook) ──► TopstepX API (order placement)
                                │
                                ├── SignalR (real-time position/order/trade updates)
                                │
                         Nexum Frontend (web dashboard)
```

1. **Connect** — Enter your TopstepX credentials and select an account/symbol in the web dashboard.
2. **Receive signals** — TradingView sends webhook alerts to your Nexum endpoint.
3. **Execute trades** — Nexum parses the signal, checks for open positions, and places bracket orders on TopstepX.
4. **Monitor** — Real-time logs stream position updates, trade fills, and P&L to the dashboard.

## Features

- **Webhook receiver** — Parses TradingView alert format with position side, size, take-profit, and stop-loss
- **Bracket orders** — Automatically places TP/SL exit orders alongside the entry, with OCO-style cleanup via SignalR
- **One-position guard** — Rejects new signals if a position is already open (prevents stacking)
- **Real-time updates** — SignalR connection streams position, order, and trade events to the dashboard
- **Token management** — Auto-refreshes TopstepX auth tokens with optional scheduled renewal
- **Multi-profile** — Save and switch between multiple account configurations
- **Test mode** — Send test orders with tick-based brackets directly from the dashboard
- **Candle export** — Download historical OHLCV data as CSV with automatic pagination
- **Theming** — Light/dark mode with five color schemes

## Web Dashboard

The frontend provides a single-page control panel for:

- Connecting/disconnecting from TopstepX
- Viewing real-time log stream with level filtering (All, Info, Trade, Signal, Warn, Error)
- Sending test buy/sell orders
- Managing saved connection profiles
- Exporting historical candle data to CSV

## Webhook Format

Nexum expects alerts in this format (JSON body or plain text):

```
Position: BUY
Contracts: 1
Take Profit: 24700.00
Stop Loss: 24645.25
```

| Field | Required | Description |
|---|---|---|
| `Position` | Yes | `BUY` or `SELL` |
| `Contracts` | Yes | Number of contracts |
| `Take Profit` | Yes | Exit limit price |
| `Stop Loss` | Yes | Exit stop price |

**Test mode** — Prefix with `TEST` and use tick-based brackets instead:

```
TEST
Position: BUY
Contracts: 1
TpTicks: 40
SlTicks: 20
```

### Webhook Security

Set `WEBHOOK_SECRET` in your backend `.env` file. TradingView must send the matching value in the `x-webhook-secret` header.

## Architecture

### Backend (`/backend`)

Node.js + Express server handling:

- **`src/server.js`** — Entry point, Express setup, SSE log endpoint
- **`src/routes/api.js`** — REST API for connect, disconnect, status, token refresh, candle data
- **`src/routes/webhook.js`** — Webhook handler: parses signal, validates, places orders
- **`src/topstepx/auth.js`** — Authentication and token lifecycle
- **`src/topstepx/orders.js`** — Order placement (market, limit, stop) and contract/position search
- **`src/topstepx/signalr.js`** — Real-time hub connection for position/order/trade updates
- **`src/topstepx/brackets.js`** — In-memory bracket tracking for OCO exit cleanup
- **`src/topstepx/state.js`** — In-memory position and order state (O(1) lookups)
- **`src/logs.js`** — SSE broadcaster for real-time log streaming to frontend

### Frontend (`/frontend`)

React + Vite + Tailwind CSS single-page dashboard.

## TopstepX API Reference

- **REST API** — `https://api.topstepx.com` ([Swagger spec](backend/topstepxapi.json) included in this repo)
- **SignalR Hub** — `https://rtc.topstepx.com/hubs/user`
- **TopstepX API Docs** — [https://topstepx.com/api-documentation/](https://topstepx.com/api-documentation/)

## License

Private — not for redistribution.
