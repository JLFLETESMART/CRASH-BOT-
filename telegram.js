require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;

if (token) {
  bot = new TelegramBot(token);
}

/**
 * Sends a message to the configured Telegram chat.
 * Does nothing if TELEGRAM_TOKEN or TELEGRAM_CHAT_ID are not set.
 * @param {string} message - Text to send
 */
async function sendNotification(message) {
  if (!bot || !chatId) {
    return;
  }

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (_) {
    // Error silenciado — se mantiene la consola limpia
  }
}

module.exports = { sendNotification };
