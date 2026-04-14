"use strict";

const http = require("http");
const config = require("./config");
const logger = require("./logger");
const { setupGlobalErrorHandlers } = require("./middlewares/errorHandler");
const DatabaseService = require("./services/DatabaseService");
const TelegramService = require("./services/TelegramService");
const BotService = require("./services/BotService");

// --- Setup global error handlers first ---
setupGlobalErrorHandlers();

// --- Simple HTTP server for health checks ---
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const botStatus = BotService.getStatus();
    const healthy = botStatus.isRunning;
    const payload = JSON.stringify({
      status: healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      bot: botStatus,
    });

    res.writeHead(healthy ? 200 : 503, {
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

  // Periodic self-check every 30 seconds
  setInterval(() => {
    const s = BotService.getStatus();
    if (!s.isRunning) {
      logger.warn("Bot appears to have stopped – attempting restart...");
      BotService.start().catch(err => logger.error(`Restart failed: ${err.message}`));
    }
  }, config.bot.healthCheckIntervalMs);
})();
