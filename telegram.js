require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";

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
    console.log("[Telegram] Notificación omitida (configura TELEGRAM_TOKEN y TELEGRAM_CHAT_ID en .env):", message);
    return;
  }

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[Telegram] Error al enviar mensaje:", err.message);
  }
}

module.exports = { sendNotification };
