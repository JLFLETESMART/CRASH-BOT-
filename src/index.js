"use strict";

const http = require("http");
const config = require("./config");
const logger = require("./logger");
const { setupGlobalErrorHandlers, onShutdown } = require("./middlewares/errorHandler");
const DatabaseService = require("./services/DatabaseService");
const TelegramService = require("./services/TelegramService");
const BotService = require("./services/BotService");

// --- Setup global error handlers first ---
setupGlobalErrorHandlers();

/**
 * Evaluates whether the bot is truly healthy based on:
 *  - isRunning flag
 *  - lastCycleAt freshness (must be within 3× intervalMs)
 *  - errorCount (circuit-breaker at ≥ 10 consecutive errors)
 */
function evaluateBotHealth(botStatus) {
  const running = Boolean(botStatus && botStatus.isRunning);
  const intervalMs = Number((botStatus && botStatus.intervalMs) || config.bot.intervalMs);
  const freshnessWindowMs = intervalMs * 3;

  let stale = false;
  if (botStatus && botStatus.lastCycleAt) {
    const lastCycle = new Date(botStatus.lastCycleAt);
    if (!Number.isNaN(lastCycle.getTime())) {
      stale = Date.now() - lastCycle.getTime() > freshnessWindowMs;
    }
  } else {
    // No cycle has run yet – only stale after the freshness window has elapsed from start
    const startedAt = botStatus && botStatus.startedAt ? new Date(botStatus.startedAt) : new Date();
    stale = Date.now() - startedAt.getTime() > freshnessWindowMs;
  }

  const errorCount = Number((botStatus && botStatus.errorCount) || 0);
  const hasExcessiveErrors = errorCount >= 10;

  const healthy = running && !stale && !hasExcessiveErrors;
  return {
    healthy,
    checks: { running, stale, hasExcessiveErrors, freshnessWindowMs, errorThreshold: 10 },
  };
}

// --- Simple HTTP server for health checks ---
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const botStatus = BotService.getStatus();
    const health = evaluateBotHealth(botStatus);
    const payload = JSON.stringify({
      status: health.healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      bot: botStatus,
      health: health.checks,
    });

    res.writeHead(health.healthy ? 200 : 503, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// --- Bootstrap ---
(async () => {
  logger.info(`Starting CRASH-BOT in ${config.nodeEnv} mode...`);

  // Initialize database
  DatabaseService.init();

  // Initialize Telegram client
  TelegramService.init();

  // Start the health check HTTP server
  server.listen(config.port, () => {
    logger.info(`Health check server listening on port ${config.port} – GET /health`);
  });

  server.on("error", (err) => {
    logger.error(`HTTP server error: ${err.message}`);
  });

  // Start the bot
  await BotService.start();

  // Register graceful-shutdown callbacks (wired to SIGTERM/SIGINT)
  // Close the HTTP server first (stop accepting new requests), then stop the bot
  onShutdown(() => new Promise(resolve => server.close(resolve)));
  onShutdown(() => BotService.stop());

  // Periodic self-check every 30 seconds: restart if not running OR cycle is stale
  setInterval(() => {
    const s = BotService.getStatus();
    const { healthy } = evaluateBotHealth(s);
    if (!healthy) {
      logger.warn("Bot health check failed – attempting restart...");
      BotService.stop();
      BotService.start().catch(err => logger.error(`Restart failed: ${err.message}`));
    }
  }, config.bot.healthCheckIntervalMs);
})();
