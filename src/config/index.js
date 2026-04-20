"use strict";

require("dotenv").config();

function optionalEnv(name, defaultValue = "") {
  return (process.env[name] || defaultValue).trim();
}

/**
 * Parses an integer env var. Falls back to `defaultValue` (and logs a warning)
 * when the value is missing, non-numeric, NaN, or non-positive.
 */
function parseIntEnv(name, defaultValue) {
  const raw = optionalEnv(name, String(defaultValue));
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`[config] Invalid value for ${name}: "${raw}" – using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

// --- Validate and export all configuration ---
const config = {
  nodeEnv: optionalEnv("NODE_ENV", "production"),
  port: parseIntEnv("PORT", 3000),
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
    intervalMs: parseIntEnv("BOT_INTERVAL_MS", 5000),
    maxHistorial: parseIntEnv("MAX_HISTORIAL", 200),
    intervalMinMs: parseIntEnv("INTERVALO_MIN_MS", 4000),
    healthCheckIntervalMs: 30000,
  },
};

module.exports = config;
