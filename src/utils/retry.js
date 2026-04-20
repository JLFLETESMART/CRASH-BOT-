"use strict";

const logger = require("../logger");

/**
 * Retries an async function with exponential backoff.
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.retries - Max number of retries (default: 3)
 * @param {number} options.baseDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Max delay cap in ms (default: 30000)
 * @param {string} [options.label] - Label for log messages
 * @returns {Promise<*>}
 */
async function retry(fn, { retries = 3, baseDelayMs = 1000, maxDelayMs = 30000, label = "operation" } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt > retries) {
        logger.error(`[retry] ${label} failed after ${retries} retries: ${err.message}`);
        throw err;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      logger.warn(`[retry] ${label} attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Simple sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { retry, sleep };
