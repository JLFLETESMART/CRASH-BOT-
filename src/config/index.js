"use strict";

require("dotenv").config();

function optionalEnv(name, defaultValue = "") {
  return (process.env[name] || defaultValue).trim();
}

// --- Validate and export all configuration ---
const config = {
  nodeEnv: optionalEnv("NODE_ENV", "production"),
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  logLevel: optionalEnv("LOG_LEVEL", "info"),

  telegram: {
    token: optionalEnv("TELEGRAM_TOKEN"),
    chatId: optionalEnv("TELEGRAM_CHAT_ID"),
  },

  binance: {
    apiKey: optionalEnv("BINANCE_API_KEY") || optionalEnv("API_KEY"),
    apiSecret: optionalEnv("BINANCE_API_SECRET") || optionalEnv("API_SECRET"),
  },

  database: {
    path: optionalEnv("DATABASE_URL", "./data/crash-bot.db"),
  },

  bot: {
    intervalMs: parseInt(optionalEnv("BOT_INTERVAL_MS", "5000"), 10),
    maxHistorial: parseInt(optionalEnv("MAX_HISTORIAL", "200"), 10),
    intervalMinMs: parseInt(optionalEnv("INTERVALO_MIN_MS", "4000"), 10),
    healthCheckIntervalMs: 30000,
  },
};

module.exports = config;
