require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN=8689563695:AAE4ZDFMDxT8RV342LGc8dbq-tTrzI2j33c
const chatId = process.env.TELEGRAM_CHAT_ID=7925975509

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

// NEW function — starts polling and adds command handlers
function startTelegramBot() {
  if (!bot) {
    console.log("[Telegram] Bot no iniciado (configura TELEGRAM_TOKEN en .env)");
    return;
  }

  // Start polling to receive messages
  bot.startPolling();

  // Handle polling errors without crashing
  bot.on("polling_error", (err) => {
    console.error("[Telegram] Error de polling:", err.message);
  });

  // /start command
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Bot activo 🔥");
  });

  // /help command
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "🤖 *CRASH BOT — Comandos*\n\n" +
        "/start — Verificar que el bot está activo\n" +
        "/help — Ver esta ayuda\n\n" +
        "El bot envía señales automáticamente cuando detecta patrones.",
      { parse_mode: "Markdown" }
    );
  });

  // Respond to any other message with confirmation
  bot.on("message", (msg) => {
    // Skip if it's a command (already handled above)
    if (msg.text && msg.text.startsWith("/")) return;
    bot.sendMessage(msg.chat.id, "✅ Mensaje recibido");
  });

  console.log("[Telegram] Bot iniciado con polling — escuchando comandos");
}

module.exports = { sendNotification, startTelegramBot, bot };
