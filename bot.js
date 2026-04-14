require("dotenv").config();
const { sendNotification } = require("./telegram");
const { mostrarEstado } = require("./mostrarEstado");

// --- Historial de rondas ---
let historial = [];
const MAX_HISTORIAL = 200;

// --- Banca ---
let banca = 1000;

// --- Control anti-spam ---
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
const INTERVALO_MIN_MS = 4000; // mínimo 4 segundos entre mensajes

/**
 * Simula una nueva ronda con distribución realista tipo Aviator.
 * Reemplazar esta función con una fuente real de datos si está disponible.
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
 * Analiza las últimas N rondas del historial.
 * @param {number[]} rondas
 * @returns {{ bajos: number, promedio: number, tendenciaSubida: boolean }}
 */
function analizarRondas(rondas) {
  if (rondas.length === 0) return { bajos: 0, promedio: 0, tendenciaSubida: false };

  const bajos = rondas.filter(x => x < 2).length;
  const promedio = rondas.reduce((a, b) => a + b, 0) / rondas.length;

  // Tendencia de subida: si los últimos 5 son más bajos que los 5 anteriores
  // indica acumulación de pérdidas y mayor probabilidad de ronda alta próxima
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

  // Muchas rondas bajas consecutivas → probable subida próxima
  if (analisis10.bajos >= 7) {
    return {
      patron: "RACHA_BAJA",
      descripcion: `${analisis10.bajos} de las últimas 10 rondas fueron < 2x`
    };
  }

  // Alta frecuencia de caídas en las últimas 20 rondas
  if (analisis20.bajos >= 14) {
    return {
      patron: "FRECUENCIA_CAIDAS",
      descripcion: `${analisis20.bajos} de las últimas 20 rondas fueron < 2x`
    };
  }

  // Tendencia de subida detectada junto con rondas bajas recientes
  if (analisis20.tendenciaSubida && analisis10.bajos >= 3) {
    return {
      patron: "TENDENCIA_SUBIDA",
      descripcion: "Valores recientes bajos tras racha mixta — posible rebote"
    };
  }

  // Alta probabilidad de ronda grande: promedio elevado y pocas bajas recientes
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
 * Evita duplicados y garantiza al menos INTERVALO_MIN_MS entre mensajes.
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
 * Ciclo principal: obtiene nueva ronda, analiza patrones y notifica si corresponde.
 */
async function ciclo() {
  const nueva = obtenerNuevaRonda();
  historial.push(nueva);
  if (historial.length > MAX_HISTORIAL) historial.shift();

  if (historial.length < 10) {
    mostrarEstado({ estado: "ESPERAR" }, banca, nueva);
    return;
  }

  const { patron, descripcion } = detectarPatron();
  const { prediccion, retiroSeguro, riesgo, nivel } = generarPrediccion(patron);

  // Mapear a decision para mostrarEstado
  const decision = {
    estado: (nivel === "ENTRAR" || nivel === "ALTA") ? "ENTRAR" : "ESPERAR",
    cashout: retiroSeguro
  };

  // Marcar mercado inestable en patrones de alta frecuencia de caídas
  if (patron === "FRECUENCIA_CAIDAS") {
    decision.estado += " PAUSA";
  }

  mostrarEstado(decision, banca, nueva);

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
  mostrarEstado({ estado: "ESPERAR" }, banca, 0);
  try {
    await sendNotification("🚀 Bot activo y analizando rondas.");
  } catch (_) {
    // Error silenciado — se mantiene la consola limpia
  }

  setInterval(ciclo, 5000);
})();