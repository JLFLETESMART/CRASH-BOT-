require("dotenv").config();
const Binance = require("node-binance-api");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { sendNotification } = require("./telegram");
const { mostrarEstado } = require("./mostrarEstado");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// --- Banca ---
let banca = 100;

const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
  useServerTime: true
});

let prices = [];
let position = null; // "LONG" o null

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

  await binance.marketBuy("BTCUSDT", 0.0001);

  position = "LONG";
  mostrarEstado({ estado: "ENTRAR", cashout: price }, banca, price);
  await sendNotification(`🟢 *COMPRA ejecutada*\nPrecio: *$${price.toFixed(2)}*\nPar: BTCUSDT`);
}

// 💸 VENDER
async function sell(price) {
  if (!position) return;

  await binance.marketSell("BTCUSDT", 0.0001);

  position = null;
  mostrarEstado({ estado: "ESPERAR" }, banca, price);
  await sendNotification(`🔴 *VENTA ejecutada*\nPrecio: *$${price.toFixed(2)}*\nPar: BTCUSDT`);
}

// 📡 LOOP REAL
setInterval(async () => {
  try {
    const book = await binance.prices("BTCUSDT");
    const price = parseFloat(book.BTCUSDT);

    prices.push(price);
    if (prices.length > 50) prices.shift();

    if (prices.length < 20) return;

    const sig = signal(prices);

    if (sig === "BUY") {
      mostrarEstado({ estado: "ENTRAR", cashout: price }, banca, price);
    } else {
      mostrarEstado({ estado: "ESPERAR" }, banca, price);
    }

    if (sig === "BUY") await buy(price);
    if (sig === "SELL") await sell(price);

    io.emit("data", {
      price,
      signal: sig,
      position
    });

  } catch (e) {
    const errMsg = e.body || e.message;
    await sendNotification(`⚠️ *Error en el bot*\n\`${errMsg}\``).catch(() => {});
  }
}, 3000);

server.listen(3000, () => {
  mostrarEstado({ estado: "ESPERAR" }, banca, null);
  sendNotification("🚀 *Bot iniciado correctamente*\nMonitoreando BTCUSDT en Binance.").catch(() => {});
});