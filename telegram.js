require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;

// Verificar que el token está definido
if (!token) {
  console.error("[Telegram] ERROR: TELEGRAM_TOKEN no está definido en .env");
} else {
  // CAMBIO CLAVE: polling: true para recibir mensajes
  bot = new TelegramBot(token, { polling: true });
  console.log("[Telegram] Bot iniciado");
  console.log("[Telegram] Polling activo");

  // Manejar errores de polling sin crashear
  bot.on("polling_error", (err) => {
    console.error("[Telegram] Error de polling:", err.message);
  });

  // Responder a /start
  bot.onText(/\/start/, (msg) => {
    console.log("[Telegram] Comando /start recibido de chat:", msg.chat.id);
    bot.sendMessage(msg.chat.id, "Bot activo 🔥");
  });

  // Log de cualquier mensaje recibido
  bot.on("message", (msg) => {
    console.log("[Telegram] Mensaje recibido:", msg.text);
  });
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
