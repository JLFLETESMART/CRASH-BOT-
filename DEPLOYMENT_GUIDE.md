# CRASH-BOT – Deployment Guide

This guide covers every supported hosting option for CRASH-BOT. Choose the one that fits your needs.

---

## Prerequisites

- Node.js 18 or later installed locally (for testing)
- A Telegram bot token (`TELEGRAM_TOKEN`) and your chat ID (`TELEGRAM_CHAT_ID`)  
  See [README.md](README.md) for how to obtain them.

---

## Option 1 – Railway (Recommended · 500 free hours/month)

Railway is the easiest way to run CRASH-BOT in the cloud for free.

### Manual deploy (no CI needed)

1. Go to <https://railway.app> and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo**.
3. Select `CRASH-BOT-` and confirm.
4. Open the **Variables** tab and add:
   - `TELEGRAM_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Railway detects Node.js automatically and runs `npm start`. Done!

### Automated deploy via GitHub Actions

1. Generate a Railway API token: **Account Settings → Tokens → New Token**.
2. Add it to GitHub: **Repo → Settings → Secrets and variables → Actions → New repository secret**  
   Name: `RAILWAY_TOKEN`
3. Every push to `main` now triggers `.github/workflows/deploy-railway.yml`.

---

## Option 2 – Render.com (Free tier)

Render's free tier keeps the app running (it sleeps after 15 min of inactivity and wakes on the next request).

### Manual deploy

1. Go to <https://render.com> and sign in.
2. Click **New → Web Service → Connect a repository** → choose `CRASH-BOT-`.
3. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Runtime:** Node
4. Under **Environment**, add `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID`.
5. Click **Create Web Service**.

### Automated deploy via GitHub Actions

1. In Render, go to **Service → Settings → Deploy Hook** and copy the URL.
2. Add it to GitHub secrets as `RENDER_DEPLOY_HOOK_URL`.
3. Every push to `main` now triggers `.github/workflows/deploy-render.yml`.

---

## Option 3 – Docker (any platform)

Use the included `Dockerfile` to run the bot anywhere Docker is available.

### Build and run locally

```bash
# Build the image
docker build -t crash-bot .

# Run with environment variables
docker run -d \
  -e TELEGRAM_TOKEN=your_token \
  -e TELEGRAM_CHAT_ID=your_chat_id \
  --name crash-bot \
  crash-bot
```

### Deploy to a VPS or cloud (Railway, Fly.io, DigitalOcean App Platform, etc.)

```bash
# Tag and push to Docker Hub (replace <user> with your Docker Hub username)
docker tag crash-bot <user>/crash-bot:latest
docker push <user>/crash-bot:latest
```

Then point your hosting platform at the image and set the same environment variables.

---

## Option 4 – Fly.io (Heroku alternative · generous free tier)

1. Install the Fly CLI: <https://fly.io/docs/hands-on/install-flyctl/>
2. Log in: `flyctl auth login`
3. From the repo root run:
   ```bash
   flyctl launch          # follow the prompts; choose a region close to you
   flyctl secrets set TELEGRAM_TOKEN=your_token TELEGRAM_CHAT_ID=your_chat_id
   flyctl deploy
   ```

---

## Option 5 – VPS or local server

1. Copy the repo to the server (e.g. via `git clone` or `scp`).
2. Install Node.js 18+.
3. Create a `.env` file based on `.env.example` and fill in your credentials.
4. Install dependencies and start:
   ```bash
   npm install
   npm start
   ```
5. *(Optional)* Keep the process alive with PM2:
   ```bash
   npm install -g pm2
   pm2 start bot.js --name crash-bot
   pm2 save
   pm2 startup   # follow the printed command to auto-start on reboot
   ```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_TOKEN` | ✅ | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Target chat / group ID |
| `API_KEY` | ⬜ | Binance API key (optional) |
| `API_SECRET` | ⬜ | Binance API secret (optional) |

See `.env.example` for a ready-to-copy template.

---

## CI/CD Workflow Summary

| Workflow file | Trigger | Purpose |
|---|---|---|
| `main_crash-bot.yml` | push / PR to `main` | Build, test, upload artifact |
| `deploy-railway.yml` | push to `main` | Deploy to Railway (needs `RAILWAY_TOKEN` secret) |
| `deploy-render.yml` | push to `main` | Trigger Render deploy hook (needs `RENDER_DEPLOY_HOOK_URL` secret) |

The deployment workflows only run if you have configured the corresponding secret. If the secret is missing the step will fail with a clear error rather than silently skip, so you will know which secret to add.
