# CRASH-BOT

A Node.js-based predictor bot for "Aviator" style crash games. It analyzes round history to detect patterns and sends trading signals via Telegram, while serving a real-time web dashboard.

## Architecture

- **Runtime**: Node.js 20
- **Web server**: Express v5 serving static files from `public/`
- **Real-time**: Socket.io pushes live simulation data to the dashboard
- **Telegram**: Sends notifications via `node-telegram-bot-api` when patterns are detected
- **Port**: 5000 (bound to 0.0.0.0)

## Key Files

- `server.js` — Main entry point: Express server, game simulation loop, pattern detection, Socket.io emitter
- `bot.js` — Standalone bot version (no web dashboard)
- `telegram.js` — Telegram notification utility
- `public/index.html` — Main dashboard UI
- `public/predictor.html` — Secondary predictor view

## Configuration

Environment variables (in `.env`):
- `TELEGRAM_TOKEN` — Bot token from @BotFather
- `TELEGRAM_CHAT_ID` — Target chat ID for notifications
- `PORT` — Server port (defaults to 5000)

## Running

```bash
npm start
```

## Deployment

Configured as `vm` deployment (always-running) since it uses WebSockets and in-memory state.
