require("dotenv").config();
const Binance = require("node-binance-api");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { sendNotification } = require("./telegram");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

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

  console.log("🟢 COMPRANDO BTC");

  // cantidad pequeña de prueba
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

// 📡 LOOP REAL
setInterval(async () => {
  try {
    const book = await binance.prices("BTCUSDT");
    const price = parseFloat(book.BTCUSDT);

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
    const errMsg = e.body || e.message;
    console.log("ERROR:", errMsg);
    await sendNotification(`⚠️ *Error en el bot*\n\`${errMsg}\``);
  }
}, 3000);

server.listen(3000, () => {
  console.log("🚀 BOT REAL ACTIVO en http://localhost:3000");
  sendNotification("🚀 *Bot iniciado correctamente*\nMonitoreando BTCUSDT en Binance.").catch(err => {
    console.error("[Telegram] Error al notificar inicio:", err.message);
  });
});