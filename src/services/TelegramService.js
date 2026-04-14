"use strict";

const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");
const logger = require("../logger");
const { retry } = require("../utils/retry");

let bot = null;

/**
 * Initializes the Telegram bot client.
 * Safe to call multiple times – only creates the client once.
 */
function init() {
  if (bot) return;

  if (!config.telegram.token) {
    logger.warn("TELEGRAM_TOKEN not set – Telegram notifications are disabled.");
    return;
  }

  bot = new TelegramBot(config.telegram.token);
  logger.info("Telegram client initialized.");
}

/**
 * Sends a Markdown message to the configured Telegram chat.
 * Silently no-ops when token/chatId are unset.
 * Uses exponential-backoff retry on transient failures.
 *
 * @param {string} message
 */
async function sendNotification(message) {
  if (!bot || !config.telegram.chatId) {
    logger.debug(`[Telegram] Notification skipped (no token/chatId): ${message.slice(0, 80)}`);
    return;
  }

  await retry(
    () => bot.sendMessage(config.telegram.chatId, message, { parse_mode: "Markdown" }),
    { retries: 3, baseDelayMs: 1000, label: "Telegram.sendMessage" }
  );

  logger.debug(`[Telegram] Message sent (${message.length} chars)`);
}

module.exports = { init, sendNotification };
