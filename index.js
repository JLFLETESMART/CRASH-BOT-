// Global error handlers — prevent crashes
process.on("uncaughtException", (err) => {
  console.error("[CRASH-BOT] Error no capturado:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[CRASH-BOT] Promesa rechazada:", reason);
});

require("dotenv").config();
const { startTelegramBot } = require("./telegram");

// Start the Telegram bot (polling for commands)
startTelegramBot();

// Start the server with analysis engine (delegates to server.js logic)
// server.js auto-executes its IIFE on require
require("./server");
