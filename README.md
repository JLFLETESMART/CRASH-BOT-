# CRASH-BOT 🤖

Bot de trading automático para BTC/USDT en Binance con notificaciones por Telegram.

---

## ¿Qué hace?

- **`server.js`** – Conecta con Binance, detecta señales de compra/venta usando medias móviles y ejecuta órdenes reales. Envía notificaciones a Telegram en cada operación.
- **`bot.js`** – Captura pantalla, lee multiplicadores del juego Crash con OCR (Tesseract) y alerta cuando las condiciones son favorables para entrar.

---

## Instalación

### Requisitos
- [Node.js](https://nodejs.org/) 18 o superior

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/JLFLETESMART/CRASH-BOT-
cd CRASH-BOT-

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env .env.local   # o edita .env directamente
```

---

## Configuración del archivo `.env`

Edita el archivo `.env` con tus credenciales:

```env
# Binance API
API_KEY=tu_api_key_de_binance
API_SECRET=tu_api_secret_de_binance

# Telegram
TELEGRAM_TOKEN=token_de_tu_bot_de_telegram
TELEGRAM_CHAT_ID=tu_chat_id
```

### Cómo obtener el token de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Escribe `/newbot` y sigue los pasos.
3. Copia el token que recibes (ej: `1234567890:AAEa...`).

### Cómo obtener tu Chat ID

1. Inicia una conversación con tu bot (envía `/start`).
2. Visita en el navegador:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
3. Busca el campo `"chat":{"id":...}` en la respuesta JSON — ese es tu `TELEGRAM_CHAT_ID`.

---

## Ejecución

```bash
npm start
```

El bot arrancará en `http://localhost:3000` y enviará una notificación a Telegram confirmando el inicio.

---

## Despliegue gratuito (sin costos)

### Opción 1 – Replit (recomendado para empezar)

1. Crea una cuenta en [replit.com](https://replit.com).
2. Crea un nuevo Repl de tipo **Node.js**.
3. Sube los archivos del proyecto (o importa desde GitHub).
4. En la sección **Secrets** (ícono de candado), añade:
   - `API_KEY`, `API_SECRET`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`
5. En la consola ejecuta `npm install && npm start`.
6. Para mantenerlo activo 24/7 usa [UptimeRobot](https://uptimerobot.com) — configura un monitor HTTP apuntando a la URL de tu Repl.

### Opción 2 – Glitch

1. Crea una cuenta en [glitch.com](https://glitch.com).
2. Crea un nuevo proyecto Node.js e importa el repositorio.
3. Añade las variables de entorno en el archivo `.env` de Glitch.
4. El proyecto se ejecuta automáticamente.
5. Usa UptimeRobot para evitar que se duerma después de 5 minutos de inactividad.

### Opción 3 – Railway (500 horas gratis al mes)

1. Crea una cuenta en [railway.app](https://railway.app).
2. Conecta tu repositorio de GitHub.
3. Añade las variables de entorno en la sección **Variables**.
4. Railway detecta automáticamente que es Node.js y ejecuta `npm start`.

---

## Notificaciones que recibirás por Telegram

| Evento | Mensaje |
|---|---|
| Bot iniciado | 🚀 Bot iniciado correctamente |
| Compra ejecutada | 🟢 COMPRA ejecutada con precio |
| Venta ejecutada | 🔴 VENTA ejecutada con precio |
| Error en el bot | ⚠️ Error con descripción |
| Señal Crash (bot.js) | 🚨 ENTRAR con retiro y riesgo sugeridos |

---

## Advertencia

Este bot ejecuta órdenes reales en Binance. Úsalo bajo tu propia responsabilidad. Se recomienda probarlo primero en la red de pruebas (testnet) de Binance antes de operar con fondos reales.
