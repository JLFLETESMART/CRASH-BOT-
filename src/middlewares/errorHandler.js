"use strict";

const logger = require("../logger");

// Registered callbacks to run on graceful shutdown (SIGTERM/SIGINT)
const shutdownCallbacks = [];

/**
 * Registers a callback to be invoked during graceful shutdown.
 * Callbacks are called in registration order; errors are swallowed.
 * @param {() => void | Promise<void>} fn
 */
function onShutdown(fn) {
  shutdownCallbacks.push(fn);
}

async function runShutdownCallbacks() {
  for (const cb of shutdownCallbacks) {
    try {
      await cb();
    } catch (e) {
      logger.error(`Shutdown callback error: ${e.message}`);
    }
  }
}

/**
 * Global unhandled rejection handler. Logs and optionally exits.
 */
function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason, _promise) => {
    logger.error(`Unhandled promise rejection: ${reason && reason.message ? reason.message : reason}`);
    if (reason && reason.stack) {
      logger.error(reason.stack);
    }
    // Do NOT exit – let the bot keep running unless the error is truly fatal
  });

  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    if (err.stack) logger.error(err.stack);
    // Give transports time to flush, then exit so the process can be restarted by Docker
    setTimeout(() => process.exit(1), 500);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM – shutting down gracefully...");
    await runShutdownCallbacks();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on("SIGINT", async () => {
    logger.info("Received SIGINT – shutting down...");
    await runShutdownCallbacks();
    setTimeout(() => process.exit(0), 500);
  });
}

module.exports = { setupGlobalErrorHandlers, onShutdown };
