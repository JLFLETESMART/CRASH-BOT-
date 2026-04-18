require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;

/**
 * Starts the Telegram bot with polling enabled and registers message listeners.
 * Call this once from the application entry point (e.g. server.js).
 * Does nothing if TELEGRAM_TOKEN is not set.
 */
function startBot() {
  if (!token) {
    console.error("[Telegram] ERROR: TELEGRAM_TOKEN no está definido en .env");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log("[Telegram] Bot iniciado");
  console.log("[Telegram] Polling activo");

  // Manejar errores de polling sin crashear
  bot.on("polling_error", (err) => {
    console.error("[Telegram] Error de polling:", err.message);
  });

  // Responder a /start
  bot.onText(/\/start/, async (msg) => {
    console.log("[Telegram] Comando /start recibido de chat:", msg.chat.id);
    try {
      await bot.sendMessage(msg.chat.id, "Bot activo 🔥");
    } catch (err) {
      console.error("[Telegram] Error al responder a /start:", err.message);
    }
  });

  // Log de mensajes recibidos (solo en modo debug)
  if (process.env.DEBUG === "true") {
    bot.on("message", (msg) => {
      console.log("[Telegram] Mensaje recibido:", msg.text || "[non-text]");
    });
  }
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

module.exports = { sendNotification, startBot };
