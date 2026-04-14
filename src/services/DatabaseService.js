"use strict";

const path = require("path");
const fs = require("fs");
const logger = require("../logger");
const config = require("../config");

let db = null;

/**
 * Initializes the SQLite database and runs migrations.
 */
function init() {
  if (db) return db;

  // Ensure data directory exists
  const dbPath = path.resolve(process.cwd(), config.database.path);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Lazy-require so the app starts even when better-sqlite3 is unavailable
  let Database;
  try {
    Database = require("better-sqlite3");
  } catch (e) {
    logger.warn("better-sqlite3 not available – running without persistence.");
    return null;
  }

  db = new Database(dbPath, { verbose: null });
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  runMigrations(db);
  logger.info(`Database initialized at ${dbPath}`);
  return db;
}

/**
 * Runs DDL migrations idempotently.
 * @param {import('better-sqlite3').Database} database
 */
function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      value      REAL    NOT NULL,
      patron     TEXT,
      prediccion REAL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signals (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nivel      TEXT NOT NULL,
      patron     TEXT,
      prediccion REAL,
      retiro     REAL,
      riesgo     TEXT,
      message    TEXT,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Saves a round result to the database.
 * @param {{ value: number, patron?: string, prediccion?: number }} round
 */
function saveRound({ value, patron = null, prediccion = null }) {
  if (!db) return;
  try {
    db.prepare(
      "INSERT INTO rounds (value, patron, prediccion) VALUES (?, ?, ?)"
    ).run(value, patron, prediccion);
  } catch (err) {
    logger.error(`DatabaseService.saveRound error: ${err.message}`);
  }
}

/**
 * Saves a signal/notification to the database.
 * @param {{ nivel: string, patron?: string, prediccion?: number, retiro?: number, riesgo?: string, message?: string }} signal
 */
function saveSignal({ nivel, patron = null, prediccion = null, retiro = null, riesgo = null, message = null }) {
  if (!db) return;
  try {
    db.prepare(
      "INSERT INTO signals (nivel, patron, prediccion, retiro, riesgo, message) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(nivel, patron, prediccion, retiro, riesgo, message);
  } catch (err) {
    logger.error(`DatabaseService.saveSignal error: ${err.message}`);
  }
}

/**
 * Returns the last N rounds from the database for continuity across restarts.
 * @param {number} limit
 * @returns {number[]}
 */
function getLastRounds(limit = 200) {
  if (!db) return [];
  try {
    const rows = db.prepare(
      "SELECT value FROM rounds ORDER BY id DESC LIMIT ?"
    ).all(limit);
    return rows.map(r => r.value).reverse();
  } catch (err) {
    logger.error(`DatabaseService.getLastRounds error: ${err.message}`);
    return [];
  }
}

module.exports = { init, saveRound, saveSignal, getLastRounds };
