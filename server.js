require("dotenv").config();
const Binance = require("node-binance-api");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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
}

// 💸 VENDER
async function sell() {
  if (!position) return;

  console.log("🔴 VENDIENDO BTC");

  await binance.marketSell("BTCUSDT", 0.0001);

  position = null;
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
    if (sig === "SELL") await sell();

    io.emit("data", {
      price,
      signal: sig,
      position
    });

  } catch (e) {
    console.log("ERROR:", e.body || e.message);
  }
}, 3000);

server.listen(3000, () => {
  console.log("🚀 BOT REAL ACTIVO en http://localhost:3000");
});