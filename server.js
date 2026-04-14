require("dotenv").config();
const Binance = require("node-binance-api");
const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const { sendNotification } = require("./telegram");

// --- Validación de variables de entorno ---
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

function credencialesValidas() {
  if (!API_KEY || !API_SECRET) return false;
  const placeholders = [
    "TU_API_KEY_AQUI", "TU_SECRET_AQUI",
    "your_binance_api_key_here", "your_binance_api_secret_here"
  ];
  return !placeholders.includes(API_KEY) && !placeholders.includes(API_SECRET);
}

// --- Configuración del servidor Express ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

let binance = null;
let prices = [];
let position = null; // "LONG" o null
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 10;
let tradingInterval = null;

// --- Inicialización de Binance con reintentos ---
async function initBinance(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔌 Conectando a Binance (intento ${attempt}/${retries})...`);
      const client = new Binance().options({
        APIKEY: API_KEY,
        APISECRET: API_SECRET,
        useServerTime: true
      });
      // Verificar conexión real obteniendo precios
      await client.prices("BTCUSDT");
      console.log("✅ Conexión a Binance establecida correctamente.");
      return client;
    } catch (err) {
      const errMsg = err.body || err.message || String(err);
      console.error(`❌ Error conectando a Binance (intento ${attempt}/${retries}): ${errMsg}`);
      if (attempt < retries) {
        const delay = attempt * 5000;
        console.log(`⏳ Reintentando en ${delay / 1000} segundos...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return null;
}

// 📊 ESTRATEGIA SIMPLE PERO REAL
function signal(data) {
  const short = data.slice(-5).reduce((a,b)=>a+b)/5;
  const long = data.slice(-20).reduce((a,b)=>a+b)/20;

  if (short > long) return "BUY";
  if (short < long) return "SELL";
  return "HOLD";
}

// 💰 COMPRAR
async function buy(price) {
  if (position) return;

  console.log("🟢 COMPRANDO BTC");

  await binance.marketBuy("BTCUSDT", 0.0001);

  position = "LONG";
  await sendNotification(`🟢 *COMPRA ejecutada*\nPrecio: *$${price.toFixed(2)}*\nPar: BTCUSDT`);
}

// 💸 VENDER
async function sell(price) {
  if (!position) return;

  console.log("🔴 VENDIENDO BTC");

  await binance.marketSell("BTCUSDT", 0.0001);

  position = null;
  await sendNotification(`🔴 *VENTA ejecutada*\nPrecio: *$${price.toFixed(2)}*\nPar: BTCUSDT`);
}

// 📡 LOOP DE TRADING
async function tradingLoop() {
  try {
    const book = await binance.prices("BTCUSDT");
    const price = parseFloat(book.BTCUSDT);

    if (isNaN(price)) {
      console.error("⚠️ Precio inválido recibido de Binance.");
      return;
    }

    consecutiveErrors = 0; // Resetear contador tras éxito

    prices.push(price);
    if (prices.length > 50) prices.shift();

    if (prices.length < 20) return;

    const sig = signal(prices);

    console.log("💰", price, "🚦", sig);

    if (sig === "BUY") await buy(price);
    if (sig === "SELL") await sell(price);

    io.emit("data", {
      price,
      signal: sig,
      position
    });

  } catch (e) {
    consecutiveErrors++;
    const errMsg = e.body || e.message || String(e);
    console.error(`ERROR (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, errMsg);

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error("🛑 Demasiados errores consecutivos. Intentando reconectar...");
      await sendNotification("🛑 *Bot desconectado*\nDemasiados errores. Intentando reconectar...");

      if (tradingInterval) {
        clearInterval(tradingInterval);
        tradingInterval = null;
      }

      // Intentar reconectar
      binance = await initBinance(3);
      if (binance) {
        consecutiveErrors = 0;
        tradingInterval = setInterval(tradingLoop, 3000);
        await sendNotification("🔄 *Bot reconectado correctamente*");
      } else {
        await sendNotification("❌ *No se pudo reconectar a Binance.* Revisa tus credenciales y conexión.");
      }
    }
  }
}

// --- Inicialización principal ---
async function main() {
  // Iniciar servidor HTTP siempre (health check disponible)
  server.listen(3000, () => {
    console.log("🌐 Servidor HTTP activo en http://localhost:3000");
  });

  if (!credencialesValidas()) {
    const msg = "⚠️ Credenciales de Binance no configuradas. "
      + "Configura API_KEY y API_SECRET en el archivo .env para activar el trading. "
      + "El servidor HTTP sigue activo en el puerto 3000.";
    console.warn(msg);
    await sendNotification("⚠️ *Bot iniciado sin trading*\nConfigura API\\_KEY y API\\_SECRET en .env.");
    return;
  }

  binance = await initBinance(3);

  if (!binance) {
    const msg = "❌ No se pudo conectar a Binance tras varios intentos. "
      + "Verifica tu conexión a internet y que tus credenciales (API_KEY, API_SECRET) sean correctas.";
    console.error(msg);
    await sendNotification("❌ *Error al conectar con Binance*\nRevisa tus credenciales y conexión a internet.");
    return;
  }

  tradingInterval = setInterval(tradingLoop, 3000);
  console.log("🚀 BOT REAL ACTIVO en http://localhost:3000");
  await sendNotification("🚀 *Bot iniciado correctamente*\nMonitoreando BTCUSDT en Binance.").catch(err => {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  });
}

main().catch(err => {
  console.error("💥 Error fatal al iniciar el bot:", err.message || err);
  process.exit(1);
});