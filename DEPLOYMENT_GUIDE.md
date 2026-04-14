# CRASH-BOT Deployment Guide

Complete guide for deploying CRASH-BOT on a VPS (recommended) or any platform that supports Docker.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment (Recommended)](#docker-deployment-recommended)
4. [VPS Deployment (Production)](#vps-deployment-production)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Monitoring & Logs](#monitoring--logs)
7. [Database Backup](#database-backup)
8. [Updating the Bot](#updating-the-bot)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 LTS | Local development |
| Docker | 24+ | Containerised deployment |
| Docker Compose | 2.x | Multi-container orchestration |
| Git | any | Pulling updates |

---

## Local Development

```bash
# 1. Clone the repository
git clone https://github.com/JLFLETESMART/CRASH-BOT-.git
cd CRASH-BOT-

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your real values

# 4. Run in development mode (auto-restart on file changes)
npm run dev

# 5. Or run in production mode locally
npm start
```

The bot exposes a health check endpoint:

```bash
curl http://localhost:3000/health
```

---

## Docker Deployment (Recommended)

### Build and run with a single command

```bash
# Build the Docker image
npm run docker:build

# Run with your .env file
npm run docker:run
```

### Using Docker Compose

```bash
# Start (background)
npm run docker:compose:up

# View logs
npm run docker:compose:logs

# Stop
npm run docker:compose:down
```

---

## VPS Deployment (Production)

> **Recommended VPS providers:** DigitalOcean, Linode (Akamai), Hetzner, Vultr  
> A $5–6/month server with 1 vCPU and 1 GB RAM is more than enough.

### Step 1 – Create and access your VPS

```bash
# SSH into the server
ssh root@YOUR_SERVER_IP
```

### Step 2 – Install Docker and Docker Compose

```bash
# Update package index
apt-get update && apt-get upgrade -y

# Install required packages
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

### Step 3 – Clone the repository

```bash
# Create a dedicated directory
mkdir -p /opt/crash-bot && cd /opt/crash-bot

# Clone
git clone https://github.com/JLFLETESMART/CRASH-BOT-.git .
```

### Step 4 – Configure environment variables

```bash
# Copy the example file
cp .env.example .env

# Edit with your real credentials
nano .env
```

Fill in at minimum:

```
TELEGRAM_TOKEN=<your_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id>
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Step 5 – Start the bot

```bash
docker compose up -d
```

Verify it's running:

```bash
docker compose ps
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "uptime": 12.3,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "bot": { "isRunning": true, "cycleCount": 7, ... }
}
```

### Step 6 – Enable auto-start on server reboot

Docker's `restart: always` policy handles this automatically. Verify the Docker daemon is enabled:

```bash
systemctl enable docker
systemctl status docker
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_TOKEN` | Yes | – | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | – | Target chat ID for signals |
| `BINANCE_API_KEY` | No | – | Binance API key (for server.js trading) |
| `BINANCE_API_SECRET` | No | – | Binance API secret |
| `DATABASE_URL` | No | `./data/crash-bot.db` | Path to SQLite file |
| `LOG_LEVEL` | No | `info` | `error`/`warn`/`info`/`debug` |
| `NODE_ENV` | No | `production` | Runtime environment |
| `PORT` | No | `3000` | Health check HTTP port |
| `BOT_INTERVAL_MS` | No | `5000` | Milliseconds between rounds |
| `INTERVALO_MIN_MS` | No | `4000` | Min ms between Telegram messages |
| `MAX_HISTORIAL` | No | `200` | Max rounds kept in memory |

---

## Monitoring & Logs

### View live logs

```bash
# Via Docker Compose
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100 crash-bot
```

### Log files (inside the container / mounted volume)

```
logs/combined.log   # All log levels (rotated, max 10 MB × 7 files)
logs/error.log      # Errors only   (rotated, max  5 MB × 7 files)
```

### Health check

```bash
# Manual check
curl http://localhost:3000/health

# Continuous watch
watch -n 5 curl -s http://localhost:3000/health | jq
```

---

## Database Backup

The SQLite database lives in the `bot_data` Docker volume (or `./data/crash-bot.db` locally).

```bash
# Create a timestamped backup
docker exec crash-bot sqlite3 /app/data/crash-bot.db ".backup '/app/data/backup_$(date +%Y%m%d_%H%M%S).db'"

# Copy the backup to the host
docker cp crash-bot:/app/data/backup_*.db ./backups/
```

Schedule a daily backup with cron:

```bash
crontab -e
# Add:
0 3 * * * docker exec crash-bot sqlite3 /app/data/crash-bot.db ".backup '/app/data/backup_$(date +\%Y\%m\%d).db'" >> /var/log/crash-bot-backup.log 2>&1
```

---

## Updating the Bot

```bash
cd /opt/crash-bot

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime rolling update)
docker compose pull    # if using a registry
docker compose up -d --build

# Confirm the new version is healthy
curl http://localhost:3000/health
```

---

## Troubleshooting

### Bot is not sending Telegram messages

1. Check your `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`
2. Verify the bot has been started with `/start` in the target chat
3. Check logs: `docker compose logs crash-bot | grep -i telegram`

### Container keeps restarting

```bash
# View the last 50 log lines including crash reason
docker compose logs --tail=50 crash-bot
```

Common causes:
- Missing required env var – check `.env`
- Port 3000 already in use – change `PORT` in `.env`

### Database errors

```bash
# Enter the container shell
docker exec -it crash-bot sh

# Check the DB file
sqlite3 /app/data/crash-bot.db ".tables"
sqlite3 /app/data/crash-bot.db "SELECT COUNT(*) FROM rounds;"
```

### High memory usage

Adjust the memory limit in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 256M
```

### Port 3000 not accessible from outside

Ensure your VPS firewall/security group allows inbound TCP on port 3000:

```bash
# UFW (Ubuntu)
ufw allow 3000/tcp
ufw reload
```

---

## Optional: Railway / Render Deployment

While VPS is recommended for 24/7 stability, the bot is also compatible with:

- **Railway** – connect your GitHub repo at [railway.app](https://railway.app) and set env vars in the dashboard.
- **Render** – create a new Web Service at [render.com](https://render.com), point to the repo, and set env vars.

Both platforms will auto-deploy on every push to `main`.
