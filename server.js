require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { sendNotification } = require("./telegram");
const PragmaticConnector = require("./pragmatic-connector");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// --- Banca multipliers ---
const BANCA_GAIN_MULTIPLIER = 1.02;
const BANCA_LOSS_MULTIPLIER = 0.995;

app.use(express.static("public"));

// --- Historial de rondas reales ---
let historial = [];
const MAX_HISTORIAL = 200;

// --- Banca simulada ---
let banca = 100;

// --- Control anti-spam ---
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
const INTERVALO_MIN_MS = 4000;

// --- Estado del bot ---
let modoReal = false;
let multiplicadorActual = null;

// --- Ruta de estado / diagnóstico ---
app.get("/status", (req, res) => {
  res.json({
    modoReal,
    historialLength: historial.length,
    ultimasRondas: historial.slice(-10),
    connectorStatus: connector ? connector.getStatus() : null
  });
});

/**
 * Analiza las últimas N rondas del historial.
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
 * Genera una predicción basada en el patrón detectado.
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
 * Procesa una nueva ronda real o simulada.
 */
async function procesarRonda(crashPoint) {
  historial.push(crashPoint);
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
    decision: { estado: estadoPanel, cashout: retiroSeguro },
    banca,
    ultimaRonda: crashPoint,
    ultimasRondas: historial.slice(-5),
    prediccion,
    riesgo,
    patron,
    modoReal,
    fuente: modoReal ? "🟢 DATOS REALES" : "🟡 SIMULACIÓN"
  };

  io.emit("data", payload);

  // Notificaciones Telegram
  if (nivel === "ENTRAR") {
    const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    const msg =
      `🚨 *ENTRAR* ${modoReal ? "(Datos Reales)" : "(Simulación)"}\n\n` +
      `Predicción: *${prediccion}x*\n` +
      `Retiro seguro: *${retiroSeguro}x*\n` +
      `Riesgo: ${riesgo}\n\n` +
      `_Últimas rondas: ${ultimasStr}_\n` +
      `_Patrón: ${descripcion}_`;
    await enviarConControl(msg);
  } else if (nivel === "ALTA") {
    const ultimasStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    const msg =
      `🔥 *POSIBLE ALTA* ${modoReal ? "(Datos Reales)" : "(Simulación)"}\n\n` +
      `Se detecta patrón de subida.\n` +
      `Últimas rondas: ${ultimasStr}\n\n` +
      `Posible explosión > *${prediccion}x*.\n` +
      `_Basado en: ${descripcion}_`;
    await enviarConControl(msg);
  }
}

// --- Simulación de ronda (fallback) ---
const ROUND_DIST = [
  { threshold: 0.50, min: 1,  range: 1  },
  { threshold: 0.75, min: 2,  range: 3  },
  { threshold: 0.88, min: 5,  range: 5  },
  { threshold: 0.95, min: 10, range: 10 },
  { threshold: 1.00, min: 20, range: 30 },
];

function obtenerRondaSimulada() {
  const r = Math.random();
  for (const { threshold, min, range } of ROUND_DIST) {
    if (r < threshold) return +(min + Math.random() * range).toFixed(2);
  }
  return +(ROUND_DIST[ROUND_DIST.length - 1].min + Math.random() * ROUND_DIST[ROUND_DIST.length - 1].range).toFixed(2);
}

let simulacionTimer = null;

function iniciarSimulacion() {
  if (simulacionTimer) return;
  console.log("[Bot] Iniciando modo SIMULACIÓN (fallback)");
  simulacionTimer = setInterval(async () => {
    if (!modoReal) {
      await procesarRonda(obtenerRondaSimulada());
    }
  }, 5000);
}

function detenerSimulacion() {
  if (simulacionTimer) {
    clearInterval(simulacionTimer);
    simulacionTimer = null;
  }
}

// --- Conector Pragmatic Play ---
const connector = new PragmaticConnector(
  async (crashPoint) => {
    if (!modoReal) {
      modoReal = true;
      detenerSimulacion();
      console.log("[Bot] ✅ Modo REAL activado — datos de High Flyer en vivo");
    }
    await procesarRonda(crashPoint);
  },
  (multiplicador) => {
    multiplicadorActual = multiplicador;
    io.emit("multiplier", { value: multiplicador });
  }
);

// --- Inicialización ---
(async () => {
  try {
    await sendNotification("🚀 Bot activo — conectando a High Flyer en tiempo real...");
  } catch (err) {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  }

  // Iniciar conector a datos reales
  connector.start();

  // Iniciar simulación como fallback
  iniciarSimulacion();

  // Si en 30 segundos no hay datos reales, loguear aviso
  setTimeout(() => {
    if (!modoReal) {
      console.warn("[Bot] ⚠️ Sin datos reales aún — usando simulación. Revisa /status para diagnóstico.");
    }
  }, 30000);

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Panel activo en http://${HOST}:${PORT}`);
    console.log(`🔍 Diagnóstico en http://${HOST}:${PORT}/status`);
  });
})();
