"use strict";

const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize, errors } = format;
const path = require("path");
const fs = require("fs");
const config = require("../config");

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Read level from centralized config (which itself reads LOG_LEVEL env var)
const logLevel = config.logLevel;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`;
  })
);

const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return stack
      ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
      : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

const logger = createLogger({
  level: logLevel,
  defaultMeta: { service: "crash-bot" },
  transports: [
    new transports.Console({ format: consoleFormat }),
    // Size-based rotation: up to 7 files of 5 MB each (oldest discarded when limit reached)
    new transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5 MB per file
      maxFiles: 7,              // keep at most 7 files
      tailable: true,
    }),
    // Size-based rotation: up to 7 files of 10 MB each
    new transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB per file
      maxFiles: 7,               // keep at most 7 files
      tailable: true,
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
