require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { sendNotification } = require("./telegram");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;

// --- Round distribution thresholds ---
const ROUND_DIST = [
  { threshold: 0.50, min: 1,  range: 1  },  // 1.00 – 2.00
  { threshold: 0.75, min: 2,  range: 3  },  // 2.00 – 5.00
  { threshold: 0.88, min: 5,  range: 5  },  // 5.00 – 10.00
  { threshold: 0.95, min: 10, range: 10 },  // 10.00 – 20.00
  { threshold: 1.00, min: 20, range: 30 },  // 20.00 – 50.00
];

// --- Banca multipliers ---
const BANCA_GAIN_MULTIPLIER = 1.02;
const BANCA_LOSS_MULTIPLIER = 0.995;

app.use(express.static("public"));

// --- Historial de rondas ---
let historial = [];
const MAX_HISTORIAL = 200;

// --- Banca simulada ---
let banca = 100;

// --- Control anti-spam ---
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
const INTERVALO_MIN_MS = 4000;

/**
 * Simula una nueva ronda con distribución realista tipo Aviator.
 * @returns {number}
 */
function obtenerNuevaRonda() {
  const r = Math.random();
  for (const { threshold, min, range } of ROUND_DIST) {
    if (r < threshold) return +(min + Math.random() * range).toFixed(2);
  }
  return +(ROUND_DIST[ROUND_DIST.length - 1].min + Math.random() * ROUND_DIST[ROUND_DIST.length - 1].range).toFixed(2);
}

/**
 * Analiza las últimas N rondas del historial.
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
    const promUltimos = ultimos5.reduce((a, b) => a + b, 0) / ultimos5.length;
    const promAnteriores = anteriores5.reduce((a, b) => a + b, 0) / anteriores5.length;
    tendenciaSubida = promUltimos < promAnteriores;
  }

  return { bajos, promedio, tendenciaSubida };
}

/**
 * Detecta el patrón actual en el historial de rondas.
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
      descripcion: `${analisis10.bajos} de las últimas 10 rondas fueron < 2x`
    };
  }

  if (analisis20.bajos >= 14) {
    return {
      patron: "FRECUENCIA_CAIDAS",
      descripcion: `${analisis20.bajos} de las últimas 20 rondas fueron < 2x`
    };
  }

  if (analisis20.tendenciaSubida && analisis10.bajos >= 3) {
    return {
      patron: "TENDENCIA_SUBIDA",
      descripcion: "Valores recientes bajos tras racha mixta — posible rebote"
    };
  }

  if (analisis50.promedio > 5 && analisis10.bajos <= 2) {
    return {
      patron: "POSIBLE_ALTA",
      descripcion: `Promedio últimas 50 rondas: ${analisis50.promedio.toFixed(2)}x`
    };
  }

  return { patron: "ESPERAR", descripcion: "Sin patrón claro en este momento" };
}

/**
 * Genera una predicción basada en el patrón detectado y el historial reciente.
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
    nivel
  };
}

/**
 * Envía una notificación por Telegram respetando el control anti-spam.
 * @param {string} mensaje
 */
async function enviarConControl(mensaje) {
  if (mensaje === ultimoMensaje) return;

  const tiempoTranscurrido = Date.now() - ultimoTiempoMensaje;
  if (tiempoTranscurrido < INTERVALO_MIN_MS) {
    await new Promise(r => setTimeout(r, INTERVALO_MIN_MS - tiempoTranscurrido));
  }

  ultimoMensaje = mensaje;
  ultimoTiempoMensaje = Date.now();

  await sendNotification(mensaje);
}

/**
 * Ciclo principal: obtiene nueva ronda, analiza patrones, actualiza banca y emite datos.
 */
async function ciclo() {
  const nueva = obtenerNuevaRonda();
  historial.push(nueva);
  if (historial.length > MAX_HISTORIAL) historial.shift();

  if (historial.length < 10) return;

  const { patron, descripcion } = detectarPatron();
  const { prediccion, retiroSeguro, riesgo, nivel } = generarPrediccion(patron);

  // Actualizar banca simulada
  if (nivel === "ENTRAR") {
    banca = +(banca * BANCA_GAIN_MULTIPLIER).toFixed(2);
  } else if (nivel === "ESPERAR") {
    banca = +(banca * BANCA_LOSS_MULTIPLIER).toFixed(2);
  }

  const estadoPanel = nivel === "ALTA" ? "POSIBLE ALTA" : nivel;

  const payload = {
    decision: {
      estado: estadoPanel,
      cashout: retiroSeguro
    },
    banca,
    ultimaRonda: nueva,
    ultimasRondas: historial.slice(-5),
    prediccion,
    riesgo,
    patron
  };

  io.emit("data", payload);

  if (nivel === "ENTRAR") {
    const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    const msg =
      `🚨 *ENTRAR*\n\n` +
      `Predicción: *${prediccion}x*\n` +
      `Retiro seguro: *${retiroSeguro}x*\n` +
      `Riesgo: ${riesgo}\n\n` +
      `_Últimas rondas: ${ultimasStr}_\n` +
      `_Patrón: ${descripcion}_`;
    await enviarConControl(msg);
  } else if (nivel === "ALTA") {
    const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    const msg =
      `🔥 *POSIBLE ALTA*\n\n` +
      `Se detecta patrón de subida.\n` +
      `Últimas rondas: ${ultimasStr}\n\n` +
      `Posible explosión > *${prediccion}x*.\n` +
      `_Basado en: ${descripcion}_`;
    await enviarConControl(msg);
  }
}

// --- Inicialización ---
(async () => {
  console.log("[CRASH-BOT] Inicializando Telegram");
  
  try {
    await sendNotification("🚀 Bot activo y analizando rondas.");
  } catch (err) {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  }

  setInterval(ciclo, 5000);

  server.listen(PORT, () => {
    console.log(`🚀 Panel activo en http://localhost:${PORT}`);
  });
})();