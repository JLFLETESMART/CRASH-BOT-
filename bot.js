require("dotenv").config();
const fs = require("fs");
const path = require("path");
const screenshot = require("screenshot-desktop");
const Tesseract = require("tesseract.js");
const { sendNotification } = require("./telegram");

// --- Archivos ---
const MEMORIA_PATH = path.join(__dirname, "memoria.json");
const CAPTURA_PATH = path.join(__dirname, "captura.png");

// --- Configuración ---
const MAX_HISTORIAL = 500;
const INTERVALO_CAPTURA_MS = 3000;
const INTERVALO_MIN_MSG_MS = 5000;

// --- Estado ---
let historial = [];
let prediccionesAcertadas = 0;
let prediccionesTotales = 0;
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
let ultimoMultiplicador = null;
let ultimaPrediccion = null;
let ocrWorker = null;

// ============================================================
// MEMORIA / APRENDIZAJE
// ============================================================

/**
 * Carga el historial y estadísticas guardadas de memoria.json.
 */
function cargarMemoria() {
  try {
    if (fs.existsSync(MEMORIA_PATH)) {
      const data = JSON.parse(fs.readFileSync(MEMORIA_PATH, "utf-8"));
      historial = Array.isArray(data.historial) ? data.historial : [];
      prediccionesAcertadas = data.prediccionesAcertadas || 0;
      prediccionesTotales = data.prediccionesTotales || 0;
      console.log(`🧠 Memoria cargada: ${historial.length} rondas, precisión ${obtenerPrecision()}%`);
    }
  } catch (err) {
    console.error("[Memoria] Error al cargar:", err.message);
  }
}

/**
 * Guarda el historial y estadísticas en memoria.json.
 */
function guardarMemoria() {
  try {
    const data = {
      historial: historial.slice(-MAX_HISTORIAL),
      prediccionesAcertadas,
      prediccionesTotales,
      ultimaActualizacion: new Date().toISOString()
    };
    fs.writeFileSync(MEMORIA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[Memoria] Error al guardar:", err.message);
  }
}

/**
 * Devuelve el porcentaje de precisión de las predicciones.
 * @returns {string}
 */
function obtenerPrecision() {
  if (prediccionesTotales === 0) return "0";
  return ((prediccionesAcertadas / prediccionesTotales) * 100).toFixed(1);
}

// ============================================================
// CAPTURA DE PANTALLA + OCR
// ============================================================

/**
 * Inicializa el worker de Tesseract OCR.
 */
async function inicializarOCR() {
  const trainedDataPath = path.join(__dirname, "eng.traineddata");
  const langPath = fs.existsSync(trainedDataPath) ? __dirname : undefined;
  ocrWorker = await Tesseract.createWorker("eng", undefined, {
    langPath,
    logger: () => {}
  });
  await ocrWorker.setParameters({
    tessedit_char_whitelist: "0123456789.xX,",
    tessedit_pageseg_mode: "6"
  });
  console.log("🔍 OCR inicializado correctamente.");
}

/**
 * Captura la pantalla y extrae multiplicadores usando OCR.
 * @returns {number|null} El multiplicador detectado o null si no se pudo leer.
 */
async function capturarPantalla() {
  try {
    await screenshot({ filename: CAPTURA_PATH, format: "png" });

    const { data: { text } } = await ocrWorker.recognize(CAPTURA_PATH);

    const multiplicadores = extraerMultiplicadores(text);

    if (multiplicadores.length > 0) {
      const ultimo = multiplicadores[multiplicadores.length - 1];
      console.log(`📸 OCR detectó: ${multiplicadores.map(m => m + "x").join(", ")} → Usando: ${ultimo}x`);
      return ultimo;
    }

    console.log(`📸 OCR texto: "${text.trim().substring(0, 80)}" → Sin multiplicadores detectados`);
    return null;
  } catch (err) {
    console.error("[Captura] Error:", err.message);
    return null;
  }
}

/**
 * Extrae valores de multiplicador del texto OCR.
 * Busca patrones como: x1.50, 1.50x, X20, 2.5x, x50, etc.
 * @param {string} texto
 * @returns {number[]}
 */
function extraerMultiplicadores(texto) {
  if (!texto) return [];

  const patrones = [
    /[xX]\s*(\d+(?:\.\d+)?)/g,
    /(\d+(?:\.\d+)?)\s*[xX]/g,
    /(\d+\.\d{1,2})/g
  ];

  const encontrados = new Set();

  for (const patron of patrones) {
    let match;
    while ((match = patron.exec(texto)) !== null) {
      const valor = parseFloat(match[1]);
      if (valor >= 1.0 && valor <= 1000) {
        encontrados.add(valor);
      }
    }
  }

  return Array.from(encontrados).sort((a, b) => a - b);
}

// ============================================================
// ANÁLISIS Y PREDICCIÓN CON APRENDIZAJE
// ============================================================

/**
 * Analiza un conjunto de rondas y devuelve estadísticas.
 * @param {number[]} rondas
 * @returns {{ bajos: number, promedio: number, mediana: number, tendenciaSubida: boolean, maxRacha: number }}
 */
function analizarRondas(rondas) {
  if (rondas.length === 0) return { bajos: 0, promedio: 0, mediana: 0, tendenciaSubida: false, maxRacha: 0 };

  const bajos = rondas.filter(x => x < 2).length;
  const promedio = rondas.reduce((a, b) => a + b, 0) / rondas.length;

  const ordenadas = [...rondas].sort((a, b) => a - b);
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)];

  // Racha consecutiva de bajos
  let maxRacha = 0;
  let rachaActual = 0;
  for (const r of rondas) {
    if (r < 2) { rachaActual++; maxRacha = Math.max(maxRacha, rachaActual); }
    else { rachaActual = 0; }
  }

  // Tendencia
  const mitad = Math.floor(rondas.length / 2);
  const primera = rondas.slice(0, mitad);
  const segunda = rondas.slice(mitad);
  const promPrimera = primera.reduce((a, b) => a + b, 0) / (primera.length || 1);
  const promSegunda = segunda.reduce((a, b) => a + b, 0) / (segunda.length || 1);
  const tendenciaSubida = promSegunda < promPrimera;

  return { bajos, promedio, mediana, tendenciaSubida, maxRacha };
}

/**
 * Calcula el factor de ajuste basado en la precisión histórica.
 * Cuanto más aprende el bot, más conservador o agresivo se vuelve.
 * @returns {number}
 */
function factorAprendizaje() {
  if (prediccionesTotales < 10) return 1.0;
  const precision = prediccionesAcertadas / prediccionesTotales;
  if (precision > 0.6) return 1.1;
  if (precision > 0.4) return 1.0;
  if (precision > 0.2) return 0.85;
  return 0.7;
}

/**
 * Genera la predicción completa para la próxima ronda.
 * @returns {{ accion: string, cashout: number, riesgo: string, confianza: string, razon: string }}
 */
function generarPrediccion() {
  const ultimas10 = historial.slice(-10);
  const ultimas20 = historial.slice(-20);
  const ultimas50 = historial.slice(-50);

  const a10 = analizarRondas(ultimas10);
  const a20 = analizarRondas(ultimas20);
  const a50 = analizarRondas(ultimas50);

  const factor = factorAprendizaje();

  // Lógica de decisión
  let accion = "ESPERAR";
  let cashout = 0;
  let riesgo = "BAJO";
  let confianza = "BAJA";
  let razon = "Sin patrón claro";

  // Patrón 1: Racha de bajos — probable subida
  if (a10.maxRacha >= 5) {
    accion = "APOSTAR";
    cashout = +(Math.max(2.0, a20.promedio * 1.3) * factor).toFixed(2);
    riesgo = "MEDIO";
    confianza = "MEDIA";
    razon = `Racha de ${a10.maxRacha} rondas bajas consecutivas`;
  }

  // Patrón 2: Muchas bajas en las últimas 20
  if (a20.bajos >= 14) {
    accion = "APOSTAR";
    cashout = +(Math.max(2.5, a20.promedio * 1.5) * factor).toFixed(2);
    riesgo = "MEDIO";
    confianza = "MEDIA-ALTA";
    razon = `${a20.bajos}/20 rondas recientes fueron < 2x`;
  }

  // Patrón 3: Tendencia de acumulación
  if (a20.tendenciaSubida && a10.bajos >= 5) {
    accion = "APOSTAR";
    cashout = +(Math.max(3.0, a50.promedio * 1.8) * factor).toFixed(2);
    riesgo = "MEDIO-ALTO";
    confianza = "MEDIA";
    razon = "Acumulación de rondas bajas con tendencia descendente";
  }

  // Patrón 4: Posible ronda alta
  if (a10.maxRacha >= 7 && a50.promedio > 3) {
    accion = "APOSTAR";
    cashout = +(Math.max(4.0, a50.promedio * 2.0) * factor).toFixed(2);
    riesgo = "ALTO";
    confianza = "MEDIA";
    razon = `Racha extrema de ${a10.maxRacha} bajos + promedio alto`;
  }

  // Patrón 5: Rondas muy altas recientes — NO apostar
  if (a10.promedio > 8 && a10.bajos < 3) {
    accion = "NO APOSTAR";
    cashout = 0;
    riesgo = "ALTO";
    confianza = "ALTA";
    razon = "Rondas recientes muy altas — probable caída fuerte";
  }

  // Seguridad: si no hay suficiente historial
  if (historial.length < 10) {
    accion = "ESPERAR";
    cashout = 0;
    riesgo = "BAJO";
    confianza = "BAJA";
    razon = `Recopilando datos (${historial.length}/10 rondas mínimas)`;
  }

  return { accion, cashout, riesgo, confianza, razon };
}

/**
 * Evalúa si la predicción anterior fue acertada.
 * @param {number} resultado - El multiplicador real de la ronda.
 */
function evaluarPrediccion(resultado) {
  if (!ultimaPrediccion) return;

  prediccionesTotales++;

  if (ultimaPrediccion.accion === "APOSTAR" && resultado >= ultimaPrediccion.cashout) {
    prediccionesAcertadas++;
  } else if (ultimaPrediccion.accion === "NO APOSTAR" && resultado < 2) {
    prediccionesAcertadas++;
  } else if (ultimaPrediccion.accion === "ESPERAR") {
    prediccionesTotales--;
  }
}

// ============================================================
// DISPLAY EN CONSOLA
// ============================================================

/**
 * Muestra el estado actual en la consola de forma clara.
 * @param {number|null} multiplicador
 * @param {object} prediccion
 */
function mostrarEstado(multiplicador, prediccion) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║          CRASH BOT - EN VIVO             ║");
  console.log("╠══════════════════════════════════════════╣");

  if (multiplicador !== null) {
    console.log(`║  Último detectado:  ${String(multiplicador + "x").padEnd(20)}║`);
  } else {
    console.log("║  Último detectado:  (esperando...)       ║");
  }

  const ultimas5 = historial.slice(-5);
  if (ultimas5.length > 0) {
    const str = ultimas5.map(x => x + "x").join(" → ");
    console.log(`║  Últimas 5: ${str.padEnd(28)}║`);
  }

  console.log("╠══════════════════════════════════════════╣");

  const iconoAccion = prediccion.accion === "APOSTAR" ? "✅" :
                      prediccion.accion === "NO APOSTAR" ? "❌" : "⏳";

  console.log(`║  ${iconoAccion} Acción:  ${prediccion.accion.padEnd(29)}║`);

  if (prediccion.cashout > 0) {
    console.log(`║  🎯 Retirar en:  ${String(prediccion.cashout + "x").padEnd(23)}║`);
  }

  console.log(`║  ⚠️  Riesgo:  ${prediccion.riesgo.padEnd(27)}║`);
  console.log(`║  📊 Confianza:  ${prediccion.confianza.padEnd(25)}║`);
  console.log(`║  💡 Razón:  ${prediccion.razon.substring(0, 29).padEnd(29)}║`);

  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  🧠 Rondas en memoria: ${String(historial.length).padEnd(18)}║`);
  console.log(`║  🎯 Precisión: ${(obtenerPrecision() + "%").padEnd(26)}║`);
  console.log(`║     (${prediccionesAcertadas}/${prediccionesTotales} predicciones acertadas)`.padEnd(43) + "║");
  console.log("╚══════════════════════════════════════════╝\n");
}

// ============================================================
// NOTIFICACIONES TELEGRAM
// ============================================================

/**
 * Envía notificación por Telegram con control anti-spam.
 * @param {string} mensaje
 */
async function enviarConControl(mensaje) {
  if (mensaje === ultimoMensaje) return;

  const tiempoTranscurrido = Date.now() - ultimoTiempoMensaje;
  if (tiempoTranscurrido < INTERVALO_MIN_MSG_MS) {
    await new Promise(r => setTimeout(r, INTERVALO_MIN_MSG_MS - tiempoTranscurrido));
  }

  ultimoMensaje = mensaje;
  ultimoTiempoMensaje = Date.now();
  await sendNotification(mensaje);
}

/**
 * Construye y envía el mensaje de Telegram según la predicción.
 * @param {object} prediccion
 */
async function notificarPrediccion(prediccion) {
  if (prediccion.accion === "ESPERAR") return;

  const ultimas = historial.slice(-5).map(x => `${x}x`).join(", ");
  const precision = obtenerPrecision();

  let msg;

  if (prediccion.accion === "APOSTAR") {
    msg =
      `✅ *APOSTAR*\n\n` +
      `🎯 Retirar en: *${prediccion.cashout}x*\n` +
      `⚠️ Riesgo: *${prediccion.riesgo}*\n` +
      `📊 Confianza: ${prediccion.confianza}\n\n` +
      `💡 _${prediccion.razon}_\n\n` +
      `Últimas: ${ultimas}\n` +
      `🧠 Precisión del bot: ${precision}%`;
  } else {
    msg =
      `❌ *NO APOSTAR*\n\n` +
      `⚠️ Riesgo: *${prediccion.riesgo}*\n` +
      `📊 Confianza: ${prediccion.confianza}\n\n` +
      `💡 _${prediccion.razon}_\n\n` +
      `Últimas: ${ultimas}\n` +
      `🧠 Precisión del bot: ${precision}%`;
  }

  await enviarConControl(msg);
}

// ============================================================
// CICLO PRINCIPAL
// ============================================================

/**
 * Ciclo principal: captura pantalla, lee OCR, analiza y notifica.
 */
async function ciclo() {
  const multiplicador = await capturarPantalla();

  if (multiplicador !== null && multiplicador !== ultimoMultiplicador) {
    // Nueva ronda detectada
    evaluarPrediccion(multiplicador);

    historial.push(multiplicador);
    if (historial.length > MAX_HISTORIAL) historial.shift();

    ultimoMultiplicador = multiplicador;

    // Guardar memoria cada 5 rondas
    if (historial.length % 5 === 0) {
      guardarMemoria();
    }
  }

  const prediccion = generarPrediccion();
  ultimaPrediccion = prediccion;

  mostrarEstado(multiplicador, prediccion);

  if (multiplicador !== null) {
    await notificarPrediccion(prediccion);
  }
}

// ============================================================
// INICIO
// ============================================================

(async () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║       🚀 CRASH BOT - INICIANDO           ║");
  console.log("║   Lectura de pantalla en vivo + OCR       ║");
  console.log("║   Predicciones con aprendizaje            ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Cargar memoria previa
  cargarMemoria();

  // Inicializar OCR
  try {
    await inicializarOCR();
  } catch (err) {
    console.error("❌ Error al inicializar OCR:", err.message);
    console.log("ℹ️  Asegúrate de tener 'eng.traineddata' en el directorio del proyecto.");
    process.exit(1);
  }

  // Notificar inicio
  try {
    const msg =
      `🚀 *CRASH BOT activo*\n\n` +
      `📸 Leyendo pantalla en vivo\n` +
      `🧠 Rondas en memoria: ${historial.length}\n` +
      `🎯 Precisión: ${obtenerPrecision()}%`;
    await sendNotification(msg);
  } catch (err) {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  }

  // Ciclo principal
  setInterval(ciclo, INTERVALO_CAPTURA_MS);
})();