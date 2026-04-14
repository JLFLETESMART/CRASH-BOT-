require("dotenv").config();
const axios = require("axios");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

/**
 * Sends a message to the configured Telegram chat via the Bot API.
 * Does nothing if TELEGRAM_TOKEN or TELEGRAM_CHAT_ID are not set.
 * @param {string} message - Text to send (supports Markdown)
 */
async function sendNotification(message) {
  if (!token || !chatId) {
    console.log("[Telegram] Notificación omitida (configura TELEGRAM_TOKEN y TELEGRAM_CHAT_ID en .env):", message);
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("[Telegram] Error al enviar mensaje:", err.response?.data?.description || err.message);
  }
}

module.exports = { sendNotification };
