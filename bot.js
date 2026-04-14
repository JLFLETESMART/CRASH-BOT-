require("dotenv").config();
const { sendNotification } = require("./telegram");
const config = require("./src/config");
const { analizarHistorial } = require("./src/analizarHistorial");
const { detectarEntrada } = require("./src/detectarEntrada");
const { calcularCashout } = require("./src/calcularCashout");
const { crearGestorBanca } = require("./src/gestionarBanca");
const { crearFiltroAntiPerdidas } = require("./src/antiPerdidas");

// --- Estado global ---
let historial = [];
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;

// --- Módulos de gestión ---
const gestorBanca = crearGestorBanca();
const filtroAntiPerdidas = crearFiltroAntiPerdidas();

/**
 * Simula una nueva ronda con distribución realista tipo Aviator.
 * Reemplazar esta función con una fuente real de datos (WebSocket, API, OCR, etc.)
 * @returns {number}
 */
function obtenerNuevaRonda() {
  const r = Math.random();
  if (r < 0.50) return +(1   + Math.random() * 0.5).toFixed(2);  // 1.00 – 1.50
  if (r < 0.70) return +(1.5 + Math.random() * 0.5).toFixed(2);  // 1.50 – 2.00
  if (r < 0.82) return +(2   + Math.random() * 3).toFixed(2);    // 2.00 – 5.00
  if (r < 0.91) return +(5   + Math.random() * 5).toFixed(2);    // 5.00 – 10.00
  if (r < 0.97) return +(10  + Math.random() * 10).toFixed(2);   // 10.00 – 20.00
  return +(20 + Math.random() * 30).toFixed(2);                   // 20.00 – 50.00
}

/**
 * Envía una notificación por Telegram respetando el control anti-spam.
 * Evita duplicados y garantiza al menos intervaloMinMensajeMs entre mensajes.
 * @param {string} mensaje
 */
async function enviarConControl(mensaje) {
  if (mensaje === ultimoMensaje) return;

  const tiempoTranscurrido = Date.now() - ultimoTiempoMensaje;
  if (tiempoTranscurrido < config.intervaloMinMensajeMs) {
    await new Promise((r) =>
      setTimeout(r, config.intervaloMinMensajeMs - tiempoTranscurrido)
    );
  }

  ultimoMensaje = mensaje;
  ultimoTiempoMensaje = Date.now();

  // Mostrar en consola sin formato Markdown
  console.log(mensaje.replace(/\*/g, "").replace(/_/g, ""));
  await sendNotification(mensaje);
}

/**
 * Muestra resumen del estado actual en consola.
 */
function mostrarEstado(nueva, decision, cashoutInfo, bancaInfo, antiPerdidasInfo) {
  const estadoStr = decision.entrar ? "🟢 ENTRAR" : "🔴 ESPERAR";
  const { banca, apuesta } = bancaInfo;

  console.log("─".repeat(55));
  console.log(`📊 Última ronda:     ${nueva}x`);
  console.log(`📈 Estado:           ${estadoStr} (score: ${decision.score}/100)`);
  if (decision.entrar) {
    console.log(`💰 Cashout:          ${cashoutInfo.cashout}x (${cashoutInfo.tipo})`);
    console.log(`🎯 Apuesta:          $${apuesta.toFixed(2)}`);
  }
  console.log(`🏦 Banca:            $${banca.toFixed(2)}`);
  if (antiPerdidasInfo.pausado) {
    console.log(`⚠️  Anti-pérdidas:   PAUSADO (${antiPerdidasInfo.perdidasConsecutivas} pérdidas consecutivas)`);
  }
  console.log("─".repeat(55));
}

/**
 * Ciclo principal: obtiene nueva ronda → analiza → decide → emite señal.
 * Todo basado en historial real, sin aleatoriedad en las decisiones.
 */
async function ciclo() {
  const { activo: bancaActiva } = gestorBanca.estado();
  if (!bancaActiva) {
    console.log("⛔ Bot detenido. Banca agotada o objetivo alcanzado.");
    return;
  }

  // 1. Obtener nueva ronda
  const nueva = obtenerNuevaRonda();
  historial.push(nueva);
  if (historial.length > config.maxHistorial) historial.shift();

  // 2. Analizar historial (requiere mínimo de datos)
  if (historial.length < 10) {
    console.log(`📊 Ronda ${nueva}x | Recopilando datos... (${historial.length}/${config.ventanaAnalisis})`);
    return;
  }

  const analisis = analizarHistorial(historial);

  // 3. Detectar entrada basándose en el análisis
  const decision = detectarEntrada(analisis);

  // 4. Calcular cashout dinámico
  const cashoutInfo = calcularCashout(analisis);

  // 5. Verificar filtro anti-pérdidas
  const antiPerdidasInfo = filtroAntiPerdidas.estado();
  const permiso = filtroAntiPerdidas.permitirEntrada(decision.score);

  // 6. Mostrar estado en consola
  mostrarEstado(nueva, decision, cashoutInfo, gestorBanca.estado(), antiPerdidasInfo);

  // 7. Si hay señal de ENTRAR y el filtro lo permite
  if (decision.entrar && permiso.permitido) {
    // Simular si la ronda habría sido ganada con el cashout propuesto
    const gano = nueva >= cashoutInfo.cashout;
    const resultado = gestorBanca.registrarResultado(gano, cashoutInfo.cashout);
    filtroAntiPerdidas.registrar(gano);

    console.log(resultado.mensaje);

    // Preparar mensaje para Telegram
    const ultimasStr = historial.slice(-5).map((x) => `${x}x`).join(", ");
    const simbolo = gano ? "✅" : "❌";
    const msg =
      `🚨 *SEÑAL: ENTRAR*\n\n` +
      `${simbolo} Resultado: *${nueva}x* ${gano ? "(GANADA)" : "(PERDIDA)"}\n` +
      `💰 Cashout: *${cashoutInfo.cashout}x* (${cashoutInfo.tipo})\n` +
      `📊 Score: *${decision.score}/100*\n` +
      `🏦 Banca: *$${resultado.banca.toFixed(2)}*\n\n` +
      `_Últimas: ${ultimasStr}_\n` +
      `_${decision.razon}_`;
    await enviarConControl(msg);
  } else if (decision.entrar && !permiso.permitido) {
    console.log(`⏸️  Entrada bloqueada: ${permiso.razon}`);
  }
}

// --- Inicialización ---
(async () => {
  const { banca } = gestorBanca.estado();
  console.log("═".repeat(55));
  console.log("🚀 CRASH BOT - HIGH FLYER");
  console.log("═".repeat(55));
  console.log(`🏦 Banca inicial:  $${banca.toFixed(2)}`);
  console.log(`🎯 Objetivo:       $${config.objetivo.toFixed(2)}`);
  console.log(`📉 Umbral bajo:    <${config.umbralBajo}x`);
  console.log(`🔄 Racha mínima:   ${config.rachaMinima} consecutivos`);
  console.log(`💰 Cashout:        ${config.cashoutMin}x – ${config.cashoutMax}x`);
  console.log(`⏱️  Intervalo:      ${config.intervaloRondaMs / 1000}s`);
  console.log("═".repeat(55));

  try {
    await sendNotification(
      `🚀 *CRASH BOT ACTIVO*\n\n` +
      `🏦 Banca: *$${banca.toFixed(2)}*\n` +
      `🎯 Objetivo: *$${config.objetivo.toFixed(2)}*\n` +
      `💰 Cashout: *${config.cashoutMin}x – ${config.cashoutMax}x*`
    );
  } catch (err) {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  }

  setInterval(ciclo, config.intervaloRondaMs);
})();