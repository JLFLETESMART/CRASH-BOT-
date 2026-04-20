"use strict";

const axios = require("axios");
const logger = require("../logger");

const BASE44_BASE_URL = (process.env.BASE44_BASE_URL || "").trim();
const BASE44_APP_ID = (process.env.BASE44_APP_ID || "").trim();
const BASE44_API_KEY = (process.env.BASE44_API_KEY || "").trim();
const MAX_RETRY_ATTEMPTS = 2;

let warnedMissingConfig = false;

function isConfigured() {
  return Boolean(BASE44_BASE_URL && BASE44_APP_ID && BASE44_API_KEY);
}

function warnIfNotConfigured() {
  if (!warnedMissingConfig) {
    warnedMissingConfig = true;
    logger.warn("Base44 no configurado (BASE44_BASE_URL, BASE44_APP_ID, BASE44_API_KEY). Se omite persistencia remota.");
  }
}

const client = axios.create({
  baseURL: BASE44_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "api_key": BASE44_API_KEY,
    "app_id": BASE44_APP_ID,
    "x-app-id": BASE44_APP_ID,
    "Authorization": `Bearer ${BASE44_API_KEY}`,
  },
});

async function withSimpleRetry(requestFn, operationName) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        logger.warn(`[Base44] ${operationName} falló (intento 1/${MAX_RETRY_ATTEMPTS}): ${error.message}`);
      }
    }
  }
  logger.error(`[Base44] ${operationName} falló tras reintento: ${lastError.message}`);
  throw lastError;
}

async function guardarRonda(multiplicador, fuente, sesion) {
  if (!isConfigured()) {
    warnIfNotConfigured();
    return null;
  }

  return withSimpleRetry(
    async () => {
      const response = await client.post("/entities/Ronda", {
        multiplicador,
        timestamp: new Date().toISOString(),
        fuente,
        sesion,
      });
      return response.data;
    },
    "guardarRonda"
  );
}

async function obtenerHistorial(limit = 50, skip = 0) {
  if (!isConfigured()) {
    warnIfNotConfigured();
    return [];
  }

  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 50;
  const safeSkip = Number.isFinite(Number(skip)) ? Number(skip) : 0;

  const data = await withSimpleRetry(
    async () => {
      const response = await client.get("/entities/Ronda", {
        params: {
          limit: safeLimit,
          skip: safeSkip,
          sort_by: "-created_date",
        },
      });
      return response.data;
    },
    "obtenerHistorial"
  );

  return Array.isArray(data) ? data : [];
}

async function guardarRondasBulk(rondas) {
  if (!isConfigured()) {
    warnIfNotConfigured();
    return [];
  }

  if (!Array.isArray(rondas) || rondas.length === 0) return [];

  return withSimpleRetry(
    async () => {
      const response = await client.post("/entities/Ronda/bulk", rondas);
      return response.data;
    },
    "guardarRondasBulk"
  );
}

module.exports = {
  guardarRonda,
  obtenerHistorial,
  guardarRondasBulk,
};
