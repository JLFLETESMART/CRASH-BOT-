"use strict";

const config = require("../config");
const logger = require("../logger");
const TelegramService = require("./TelegramService");
const DatabaseService = require("./DatabaseService");

// --- State ---
let historial = [];
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
let intervalHandle = null;
let isRunning = false;

// --- Public status for health check ---
const status = {
  startedAt: null,
  lastCycleAt: null,
  cycleCount: 0,
  errorCount: 0,
};

/**
 * Simulates a new Aviator-style round with a realistic distribution.
 * Replace with a real data source when available.
 * @returns {number}
 */
function obtenerNuevaRonda() {
  const r = Math.random();
  if (r < 0.50) return +(1  + Math.random() * 1).toFixed(2);   // 1.00 – 2.00
  if (r < 0.75) return +(2  + Math.random() * 3).toFixed(2);   // 2.00 – 5.00
  if (r < 0.88) return +(5  + Math.random() * 5).toFixed(2);   // 5.00 – 10.00
  if (r < 0.95) return +(10 + Math.random() * 10).toFixed(2);  // 10.00 – 20.00
  return +(20 + Math.random() * 30).toFixed(2);                 // 20.00 – 50.00
}

/**
 * Analyzes the last N rounds.
 * @param {number[]} rondas
 * @returns {{ bajos: number, promedio: number, tendenciaSubida: boolean }}
 */
function analizarRondas(rondas) {
  if (rondas.length === 0) return { bajos: 0, promedio: 0, tendenciaSubida: false };

  const bajos = rondas.filter(x => x < 2).length;
  const promedio = rondas.reduce((a, b) => a + b, 0) / rondas.length;

  const ultimos5 = rondas.slice(-5);
  const anteriores5 = rondas.slice(-10, -5);
  let tendenciaSubida = false;

  if (anteriores5.length >= 3 && ultimos5.length >= 3) {
    const promUltimos   = ultimos5.reduce((a, b) => a + b, 0)   / ultimos5.length;
    const promAnteriores = anteriores5.reduce((a, b) => a + b, 0) / anteriores5.length;
    tendenciaSubida = promUltimos < promAnteriores;
  }

  return { bajos, promedio, tendenciaSubida };
}

/**
 * Detects the current pattern in the round history.
 * @returns {{ patron: string, descripcion: string }}
 */
function detectarPatron() {
  const ultimas50 = historial.slice(-50);
  const ultimas20 = historial.slice(-20);
  const ultimas10 = historial.slice(-10);

  const analisis10 = analizarRondas(ultimas10);
  const analisis20 = analizarRondas(ultimas20);
  const analisis50 = analizarRondas(ultimas50);

  if (analisis10.bajos >= 7) {
    return {
      patron: "RACHA_BAJA",
      descripcion: `${analisis10.bajos} de las últimas 10 rondas fueron < 2x`,
    };
  }

  if (analisis20.bajos >= 14) {
    return {
      patron: "FRECUENCIA_CAIDAS",
      descripcion: `${analisis20.bajos} de las últimas 20 rondas fueron < 2x`,
    };
  }

  if (analisis20.tendenciaSubida && analisis10.bajos >= 3) {
    return {
      patron: "TENDENCIA_SUBIDA",
      descripcion: "Valores recientes bajos tras racha mixta — posible rebote",
    };
  }

  if (analisis50.promedio > 5 && analisis10.bajos <= 2) {
    return {
      patron: "POSIBLE_ALTA",
      descripcion: `Promedio últimas 50 rondas: ${analisis50.promedio.toFixed(2)}x`,
    };
  }

  return { patron: "ESPERAR", descripcion: "Sin patrón claro en este momento" };
}

/**
 * Generates a prediction based on the detected pattern.
 * @param {string} patron
 * @returns {{ prediccion: number, retiroSeguro: number, riesgo: string, nivel: string }}
 */
function generarPrediccion(patron) {
  const ultimas20 = historial.slice(-20);
  const promedio = ultimas20.length > 0
    ? ultimas20.reduce((a, b) => a + b, 0) / ultimas20.length
    : 2;

  let prediccion, margen, riesgo, nivel;

  switch (patron) {
    case "RACHA_BAJA":
      prediccion = Math.max(2.5, promedio * 1.5);
      margen = 0.5;
      riesgo = "Medio";
      nivel = "ENTRAR";
      break;
    case "FRECUENCIA_CAIDAS":
      prediccion = Math.max(3, promedio * 1.8);
      margen = 0.7;
      riesgo = "Medio-Alto";
      nivel = "ENTRAR";
      break;
    case "TENDENCIA_SUBIDA":
      prediccion = Math.max(4, promedio * 2);
      margen = 1.0;
      riesgo = "Alto";
      nivel = "ENTRAR";
      break;
    case "POSIBLE_ALTA":
      prediccion = Math.max(8, promedio * 2.5);
      margen = 2.0;
      riesgo = "Muy Alto";
      nivel = "ALTA";
      break;
    default:
      prediccion = promedio;
      margen = 0.5;
      riesgo = "Bajo";
      nivel = "ESPERAR";
  }

  return {
    prediccion: +prediccion.toFixed(2),
    retiroSeguro: +(prediccion - margen).toFixed(2),
    riesgo,
    nivel,
  };
}

/**
 * Sends a Telegram notification with anti-spam control (deduplication + min interval).
 * @param {string} mensaje
 */
async function enviarConControl(mensaje) {
  if (mensaje === ultimoMensaje) return;

  const elapsed = Date.now() - ultimoTiempoMensaje;
  if (elapsed < config.bot.intervalMinMs) {
    await new Promise(r => setTimeout(r, config.bot.intervalMinMs - elapsed));
  }

  ultimoMensaje = mensaje;
  ultimoTiempoMensaje = Date.now();

  logger.info(mensaje.replace(/\*/g, "").replace(/_/g, ""));
  await TelegramService.sendNotification(mensaje);
}

/**
 * Main cycle: fetches a new round, analyses patterns, and notifies when appropriate.
 */
async function ciclo() {
  try {
    const nueva = obtenerNuevaRonda();
    historial.push(nueva);
    if (historial.length > config.bot.maxHistorial) historial.shift();

    logger.debug(`Nueva ronda: ${nueva}x | Últimas 10: [${historial.slice(-10).join(", ")}]`);

    status.lastCycleAt = new Date().toISOString();
    status.cycleCount += 1;

    if (historial.length < 10) return;

    const { patron, descripcion } = detectarPatron();
    const { prediccion, retiroSeguro, riesgo, nivel } = generarPrediccion(patron);

    // Persist round data
    DatabaseService.saveRound({ value: nueva, patron, prediccion });

    if (nivel === "ENTRAR") {
      const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
      const msg =
        "🚨 *ENTRAR*\n\n" +
        `Predicción: *${prediccion}x*\n` +
        `Retiro seguro: *${retiroSeguro}x*\n` +
        `Riesgo: ${riesgo}\n\n` +
        `_Últimas rondas: ${ultimasStr}_\n` +
        `_Patrón: ${descripcion}_`;

      DatabaseService.saveSignal({ nivel, patron, prediccion, retiro: retiroSeguro, riesgo, message: msg });
      await enviarConControl(msg);

    } else if (nivel === "ALTA") {
      const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
      const msg =
        "🔥 *POSIBLE ALTA*\n\n" +
        "Se detecta patrón de subida.\n" +
        `Últimas rondas: ${ultimasStr}\n\n` +
        `Posible explosión > *${prediccion}x*.\n` +
        `_Basado en: ${descripcion}_`;

      DatabaseService.saveSignal({ nivel, patron, prediccion, retiro: retiroSeguro, riesgo, message: msg });
      await enviarConControl(msg);
    }
  } catch (err) {
    status.errorCount += 1;
    logger.error(`Error in ciclo(): ${err.message}`);
    if (err.stack) logger.error(err.stack);
  }
}

/**
 * Starts the bot.
 */
async function start() {
  if (isRunning) {
    logger.warn("BotService is already running.");
    return;
  }

  // Load historical data from DB so analysis continues after restart
  const savedRounds = DatabaseService.getLastRounds(config.bot.maxHistorial);
  if (savedRounds.length > 0) {
    historial = savedRounds;
    logger.info(`Loaded ${savedRounds.length} historical rounds from database.`);
  }

  isRunning = true;
  status.startedAt = new Date().toISOString();

  logger.info("Bot started – analysing rounds.");
  await TelegramService.sendNotification("🚀 *Bot iniciado correctamente*\nAnalizando rondas en tiempo real.");

  intervalHandle = setInterval(ciclo, config.bot.intervalMs);
}

/**
 * Stops the bot gracefully.
 */
function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isRunning = false;
  logger.info("BotService stopped.");
}

/**
 * Returns the current bot status (used by health check).
 */
function getStatus() {
  return {
    ...status,
    isRunning,
    historialSize: historial.length,
  };
}

module.exports = { start, stop, getStatus };
