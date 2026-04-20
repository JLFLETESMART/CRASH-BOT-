require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { sendNotification, startBot } = require("./telegram");
const PragmaticConnector = require("./pragmatic-connector");
const Base44Service = require("./src/services/Base44Service");
const logger = require("./src/logger");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const EXTENSION_SECRET = process.env.EXTENSION_SECRET || "";

app.use(express.static("public"));
app.use(express.json());

// --- Historial de rondas ---
let historial = [];
const MAX_HISTORIAL = 200;

// --- Control anti-spam Telegram ---
let ultimoMensaje = "";
let ultimoTiempoMensaje = 0;
const INTERVALO_MIN_MS = 4000;

// --- Estado del modo ---
let modoReal = false;
let multiplicadorActual = null;

// ── Endpoint: descargar extensión como ZIP ───────────────────────────────────
app.get("/api/extension-zip", (req, res) => {
  const archiver = require("archiver");
  const path     = require("path");
  const extDir   = path.join(__dirname, "public", "extension");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=highflyer-bot-extension.zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => { res.status(500).end(); });
  archive.pipe(res);
  archive.directory(extDir, "highflyer-bot-extension");
  archive.finalize();
});

// ── Endpoint para obtener Chat ID real de Telegram ───────────────────────────
app.get("/api/telegram-setup", async (req, res) => {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) return res.json({ error: "No hay TELEGRAM_TOKEN configurado" });

  try {
    const https = require("https");
    const data = await new Promise((resolve, reject) => {
      https.get(`https://api.telegram.org/bot${token}/getUpdates`, (r) => {
        let body = "";
        r.on("data", chunk => body += chunk);
        r.on("end", () => resolve(JSON.parse(body)));
      }).on("error", reject);
    });

    if (!data.ok) return res.json({ error: "Token inválido", detalle: data });

    const updates = data.result || [];
    if (updates.length === 0) {
      return res.json({
        instruccion: "⚠️ No hay mensajes. Envíale /start a tu bot en Telegram y vuelve a visitar esta página.",
        token_ok: true
      });
    }

    const chats = [...new Set(updates.map(u =>
      u.message?.from?.id || u.channel_post?.chat?.id
    ).filter(Boolean))];

    res.json({
      ok: true,
      instruccion: "✅ Copia el primer número de 'chat_ids' y ponlo en el secreto TELEGRAM_CHAT_ID",
      chat_ids: chats,
      detalle: updates.slice(-3).map(u => ({
        from: u.message?.from?.first_name || "?",
        chat_id: u.message?.from?.id || u.channel_post?.chat?.id,
        texto: u.message?.text || "(sin texto)"
      }))
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── Endpoint de diagnóstico ──────────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.json({
    modoReal,
    historialLength: historial.length,
    ultimasRondas: historial.slice(-10),
    connectorStatus: connector ? connector.getStatus() : null
  });
});

// ── Endpoint para la extensión del navegador ─────────────────────────────────
app.post("/api/round", (req, res) => {
  const { secret, crashPoint } = req.body;

  if (!EXTENSION_SECRET || secret !== EXTENSION_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const val = parseFloat(crashPoint);
  if (isNaN(val) || val < 1.0 || val > 1000000) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  if (!modoReal) {
    modoReal = true;
    detenerSimulacion();
    console.log("[Bot] ✅ Modo REAL activado vía extensión");
  }

  procesarRonda(+val.toFixed(2));
  res.json({ ok: true, crashPoint: val });
});

app.get("/api/historial-base44", async (req, res) => {
  try {
    const historialBase44 = await Base44Service.obtenerHistorial(50, 0);
    res.json({ ok: true, total: historialBase44.length, data: historialBase44 });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── Análisis ─────────────────────────────────────────────────────────────────

function analizarRondas(rondas) {
  if (rondas.length === 0) return { bajos: 0, medios: 0, altos: 0, promedio: 0, tendenciaSubida: false };

  const bajos  = rondas.filter(x => x < 2).length;
  const medios = rondas.filter(x => x >= 2 && x < 5).length;
  const altos  = rondas.filter(x => x >= 5).length;
  const promedio = rondas.reduce((a, b) => a + b, 0) / rondas.length;

  const ultimos5   = rondas.slice(-5);
  const anteriores5 = rondas.slice(-10, -5);
  let tendenciaSubida = false;

  if (anteriores5.length >= 3 && ultimos5.length >= 3) {
    const promUltimos    = ultimos5.reduce((a, b) => a + b, 0) / ultimos5.length;
    const promAnteriores = anteriores5.reduce((a, b) => a + b, 0) / anteriores5.length;
    tendenciaSubida = promUltimos < promAnteriores;
  }

  return { bajos, medios, altos, promedio, tendenciaSubida };
}

function detectarPatron() {
  const ultimas50 = historial.slice(-50);
  const ultimas20 = historial.slice(-20);
  const ultimas10 = historial.slice(-10);

  const an10 = analizarRondas(ultimas10);
  const an20 = analizarRondas(ultimas20);
  const an50 = analizarRondas(ultimas50);

  if (an10.bajos >= 7)
    return { patron: "RACHA_BAJA", descripcion: `${an10.bajos} de las últimas 10 rondas fueron < 2x` };

  if (an20.bajos >= 14)
    return { patron: "FRECUENCIA_CAIDAS", descripcion: `${an20.bajos} de las últimas 20 rondas fueron < 2x` };

  if (an20.tendenciaSubida && an10.bajos >= 3)
    return { patron: "TENDENCIA_SUBIDA", descripcion: "Valores recientes bajos tras racha mixta — posible rebote" };

  if (an50.promedio > 5 && an10.bajos <= 2)
    return { patron: "POSIBLE_ALTA", descripcion: `Promedio últimas 50 rondas: ${an50.promedio.toFixed(2)}x` };

  return { patron: "ESPERAR", descripcion: "Sin patrón claro en este momento" };
}

function generarPrediccion(patron) {
  const ultimas20 = historial.slice(-20);
  const promedio  = ultimas20.length > 0 ? ultimas20.reduce((a, b) => a + b, 0) / ultimas20.length : 2;

  let prediccion, margen, riesgo, nivel;

  switch (patron) {
    case "RACHA_BAJA":
      prediccion = Math.max(2.5, promedio * 1.5); margen = 0.5; riesgo = "Medio";     nivel = "ENTRAR"; break;
    case "FRECUENCIA_CAIDAS":
      prediccion = Math.max(3,   promedio * 1.8); margen = 0.7; riesgo = "Medio-Alto"; nivel = "ENTRAR"; break;
    case "TENDENCIA_SUBIDA":
      prediccion = Math.max(4,   promedio * 2.0); margen = 1.0; riesgo = "Alto";       nivel = "ENTRAR"; break;
    case "POSIBLE_ALTA":
      prediccion = Math.max(8,   promedio * 2.5); margen = 2.0; riesgo = "Muy Alto";   nivel = "ALTA";   break;
    default:
      prediccion = promedio; margen = 0.5; riesgo = "Bajo"; nivel = "ESPERAR";
  }

  return {
    prediccion:    +prediccion.toFixed(2),
    retiroSeguro:  +(prediccion - margen).toFixed(2),
    riesgo,
    nivel
  };
}

function calcularProbabilidades() {
  const ultimas = historial.slice(-10);
  if (ultimas.length < 3) return { pBaja: 50, pMedia: 25, pAlta: 12 };

  const n     = ultimas.length;
  const bajos = ultimas.filter(x => x < 2).length;
  const altos = ultimas.filter(x => x >= 5).length;

  const ratioBajos = bajos / n;
  const ratioAltos = altos / n;

  let pBaja = 50, pMedia = 25, pAlta = 12;

  if (ratioBajos > 0.6) {
    pBaja  = Math.max(20, 50 - (ratioBajos - 0.5) * 80);
    pMedia = Math.min(45, 25 + (ratioBajos - 0.5) * 60);
    pAlta  = Math.min(30, 12 + (ratioBajos - 0.5) * 40);
  } else if (ratioAltos > 0.4) {
    pBaja  = Math.min(70, 50 + (ratioAltos - 0.3) * 60);
    pMedia = Math.max(15, 25 - (ratioAltos - 0.3) * 30);
    pAlta  = Math.max(5,  12 - (ratioAltos - 0.3) * 25);
  }

  const suma = pBaja + pMedia + pAlta;
  pBaja  = Math.round(pBaja  / suma * 100);
  pMedia = Math.round(pMedia / suma * 100);
  pAlta  = 100 - pBaja - pMedia;

  return { pBaja, pMedia, pAlta };
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function enviarConControl(mensaje) {
  if (mensaje === ultimoMensaje) return;
  const transcurrido = Date.now() - ultimoTiempoMensaje;
  if (transcurrido < INTERVALO_MIN_MS)
    await new Promise(r => setTimeout(r, INTERVALO_MIN_MS - transcurrido));
  ultimoMensaje      = mensaje;
  ultimoTiempoMensaje = Date.now();
  await sendNotification(mensaje);
}

// ── Procesamiento de ronda ───────────────────────────────────────────────────

async function procesarRonda(crashPoint) {
  historial.push(crashPoint);
  if (historial.length > MAX_HISTORIAL) historial.shift();

  Base44Service.guardarRonda(
    crashPoint,
    modoReal ? "ocr" : "bot",
    process.env.BASE44_SESION || undefined
  ).catch((error) => {
    logger.warn(`[Base44] No se pudo guardar ronda: ${error.message}`);
  });

  if (historial.length < 10) return;

  const { patron, descripcion } = detectarPatron();
  const { prediccion, retiroSeguro, riesgo, nivel } = generarPrediccion(patron);
  const { pBaja, pMedia, pAlta } = calcularProbabilidades();

  const estadoPanel = nivel === "ALTA" ? "POSIBLE ALTA" : nivel;

  const payload = {
    decision:     { estado: estadoPanel, cashout: retiroSeguro },
    ultimaRonda:  crashPoint,
    ultimasRondas: historial.slice(-5),
    prediccion,
    riesgo,
    patron,
    modoReal,
    pBaja,
    pMedia,
    pAlta,
    fuente: modoReal ? "REAL" : "SIM"
  };

  io.emit("data", payload);

  if (nivel === "ENTRAR") {
    const ultStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    await enviarConControl(
      `🚨 *ENTRAR* ${modoReal ? "(Datos Reales)" : "(Simulación)"}\n\n` +
      `Predicción próxima ronda: *${prediccion}x*\n` +
      `Retiro seguro: *${retiroSeguro}x*\n` +
      `Probabilidad alta (>5x): ${pAlta}%\n\n` +
      `_Últimas: ${ultStr}_\n_Patrón: ${descripcion}_`
    );
  } else if (nivel === "ALTA") {
    const ultStr = historial.slice(-5).map(x => `${x}x`).join(", ");
    await enviarConControl(
      `🔥 *POSIBLE ALTA* ${modoReal ? "(Datos Reales)" : "(Simulación)"}\n\n` +
      `Posible explosión > *${prediccion}x*\n` +
      `Probabilidad alta (>5x): ${pAlta}%\n\n` +
      `_Últimas: ${ultStr}_\n_Patrón: ${descripcion}_`
    );
  }
}

// ── Simulación fallback ───────────────────────────────────────────────────────

const ROUND_DIST = [
  { threshold: 0.50, min: 1,  range: 1  },
  { threshold: 0.75, min: 2,  range: 3  },
  { threshold: 0.88, min: 5,  range: 5  },
  { threshold: 0.95, min: 10, range: 10 },
  { threshold: 1.00, min: 20, range: 30 },
];

function obtenerRondaSimulada() {
  const r = Math.random();
  for (const { threshold, min, range } of ROUND_DIST)
    if (r < threshold) return +(min + Math.random() * range).toFixed(2);
  return +(ROUND_DIST.at(-1).min + Math.random() * ROUND_DIST.at(-1).range).toFixed(2);
}

let simulacionTimer = null;

function iniciarSimulacion() {
  if (simulacionTimer) return;
  console.log("[Bot] Iniciando modo SIMULACIÓN (fallback)");
  simulacionTimer = setInterval(async () => {
    if (!modoReal) await procesarRonda(obtenerRondaSimulada());
  }, 5000);
}

function detenerSimulacion() {
  if (simulacionTimer) { clearInterval(simulacionTimer); simulacionTimer = null; }
}

// ── Conector Pragmatic Play ──────────────────────────────────────────────────

const connector = new PragmaticConnector(
  async (crashPoint) => {
    if (!modoReal) {
      modoReal = true;
      detenerSimulacion();
      console.log("[Bot] ✅ Modo REAL activado — WebSocket High Flyer");
    }
    await procesarRonda(crashPoint);
  },
  (multiplicador) => {
    multiplicadorActual = multiplicador;
    io.emit("multiplier", { value: multiplicador });
  }
);

// ── Inicialización ───────────────────────────────────────────────────────────

(async () => {
  console.log("[CRASH-BOT] Inicializando Telegram");
  startBot();

  try {
    await sendNotification("🚀 Bot activo — conectando a High Flyer...");
  } catch (err) {
    console.error("[Telegram] Error:", err.message);
  }

  connector.start();
  iniciarSimulacion();

  setTimeout(() => {
    if (!modoReal)
      console.warn("[Bot] ⚠️ Sin datos reales — usando simulación. Abre el juego en tu navegador con la extensión activada.");
  }, 30000);

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Panel activo en http://${HOST}:${PORT}`);
    console.log(`🔌 Endpoint extensión: POST /api/round`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Server] Puerto ${PORT} ocupado, reintentando en 3s...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, HOST);
      }, 3000);
    }
  });
})();
