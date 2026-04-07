const screenshot = require("screenshot-desktop");
const Tesseract = require("tesseract.js");
const Jimp = require("jimp");
const notifier = require("node-notifier");

let historial = [];
let saldo = 1000; // 💰 tu banca inicial
let apuestaBase = 50;

function analizar() {
  let ultimas = historial.slice(-12);

  let bajos = ultimas.filter(x => x < 1.5).length;
  let ultimo = historial[historial.length - 1];

  if (ultimo >= 20) return { accion: "ESPERAR" };

  if (bajos >= 7) {
    return {
      accion: "ENTRAR",
      retiro: "2x",
      riesgo: "5x–10x"
    };
  }

  return { accion: "ESPERAR" };
}

function alerta(mensaje) {
  process.stdout.write('\x07');

  notifier.notify({
    title: "🔥 BOT HIGH FLYER",
    message: mensaje,
    sound: true
  });
}

async function capturar() {
  const imgPath = "screen.png";
  const cropPath = "crop.png";

  await screenshot({ filename: imgPath });

  const image = await Jimp.read(imgPath);

  const crop = image.crop(200, 200, 800, 400);
  await crop.writeAsync(cropPath);

  const { data: { text } } = await Tesseract.recognize(cropPath, "eng");

  let matches = text.match(/\d+(\.\d+)?/g);

  if (matches) {
    let numeros = matches
      .map(n => parseFloat(n))
      .filter(n => n >= 1 && n < 200);

    if (numeros.length > 0) {
      let ultimo = numeros[numeros.length - 1];

      if (!historial.includes(ultimo)) {
        historial.push(ultimo);

        console.clear();
        console.log("📊 Últimos:", historial.slice(-12));

        let decision = analizar();

        if (decision.accion === "ENTRAR") {
          let msg = `🚨 ENTRAR\nRetiro: ${decision.retiro}\nRiesgo: ${decision.riesgo}`;
          console.log(msg);
          alerta(msg);
        } else {
          console.log("⏳ ESPERAR");
        }
      }
    }
  }
}

console.log("🤖 BOT PRO++ ACTIVADO");

setInterval(capturar, 4000);