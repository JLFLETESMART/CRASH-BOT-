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

const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
  useServerTime: true
});

let prices = [];
let position = null; // "LONG" o null
let banca = 1000;

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
  mostrarEstado({ estado: "ENTRAR", cashout: +(price * 1.02).toFixed(2) }, banca, price);
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

    if (prices.length < 20) {
      mostrarEstado({ estado: "ESPERAR" }, banca, price);
      return;
    }

    const sig = signal(prices);

    if (sig === "BUY") {
      mostrarEstado({ estado: "ENTRAR", cashout: +(price * 1.02).toFixed(2) }, banca, price);
      await buy(price);
    } else if (sig === "SELL") {
      mostrarEstado({ estado: "ESPERAR" }, banca, price);
      await sell(price);
    } else {
      mostrarEstado({ estado: "ESPERAR" }, banca, price);
    }

    io.emit("data", {
      price,
      signal: sig,
      position
    });

  } catch (_) {
    mostrarEstado({ estado: "ESPERAR PAUSA" }, banca, 0);
  }
}, 3000);

server.listen(3000, () => {
  mostrarEstado({ estado: "ESPERAR" }, banca, 0);
  sendNotification("🚀 *Bot iniciado correctamente*\nMonitoreando BTCUSDT en Binance.").catch(() => {
    // Error silenciado — se mantiene la consola limpia
  });
});