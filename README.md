# CRASH-BOT 🤖

Bot predictor de rondas tipo Aviator con notificaciones inteligentes por Telegram.

---

## ¿Qué hace?

- **`bot.js`** – Analiza el historial de rondas tipo Aviator, detecta patrones (rachas bajas, frecuencia de caídas, tendencias de subida) y envía señales **ENTRAR** o **POSIBLE ALTA** por Telegram.
- **`telegram.js`** – Módulo de notificaciones. Gestiona el envío de mensajes con control de errores.

---

## Lógica de predicción

El bot analiza las últimas **10, 20 y 50 rondas** y detecta los siguientes patrones:

| Patrón | Condición | Señal |
|---|---|---|
| `RACHA_BAJA` | ≥ 7 de las últimas 10 rondas < 2x | 🚨 ENTRAR |
| `FRECUENCIA_CAIDAS` | ≥ 14 de las últimas 20 rondas < 2x | 🚨 ENTRAR |
| `TENDENCIA_SUBIDA` | Valores recientes bajos tras racha mixta | 🚨 ENTRAR |
| `POSIBLE_ALTA` | Promedio 50 rondas > 5x y pocas bajas recientes | 🔥 POSIBLE ALTA |

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
# edita .env directamente
```

---

## Configuración del archivo `.env`

Edita el archivo `.env` con tus credenciales de Telegram:
**⚠️ Seguridad:** nunca subas ni hagas commit de `.env` al control de versiones.

```env
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

El bot iniciará, enviará `🚀 Bot activo y analizando rondas.` por Telegram y comenzará a analizar cada 5 segundos.

---

## Notificaciones que recibirás por Telegram

### Al iniciar
```
🚀 Bot activo y analizando rondas.
```

### Señal de entrada
```
🚨 ENTRAR

Predicción: 5.20x
Retiro seguro: 4.70x
Riesgo: Medio

Últimas rondas: 1.2x, 1.5x, 1.1x, 1.3x, 1.4x
Patrón: 7 de las últimas 10 rondas fueron < 2x
```

### Alerta de ronda alta
```
🔥 POSIBLE ALTA

Se detecta patrón de subida.
Últimas rondas: 1.2x, 1.5x, 1.1x, 1.3x, 1.4x

Posible explosión > 8.50x.
Basado en: Promedio últimas 50 rondas: 5.30x
```

---

## Control anti-spam

- Mínimo **4 segundos** entre mensajes.
- Los mensajes **idénticos consecutivos** no se reenvían.

---

## Despliegue gratuito (sin costos)

### Opción 1 – Replit (recomendado para empezar)

1. Crea una cuenta en [replit.com](https://replit.com).
2. Crea un nuevo Repl de tipo **Node.js**.
3. Sube los archivos del proyecto (o importa desde GitHub).
4. En la sección **Secrets** (ícono de candado), añade:
   - `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`
5. En la consola ejecuta `npm install && npm start`.
6. Para mantenerlo activo 24/7 usa [UptimeRobot](https://uptimerobot.com).

### Opción 2 – Glitch

1. Crea una cuenta en [glitch.com](https://glitch.com).
2. Crea un nuevo proyecto Node.js e importa el repositorio.
3. Añade las variables de entorno en el archivo `.env` de Glitch.
4. El proyecto se ejecuta automáticamente.

### Opción 3 – Railway (500 horas gratis al mes)

1. Crea una cuenta en [railway.app](https://railway.app).
2. Conecta tu repositorio de GitHub.
3. Añade las variables de entorno en la sección **Variables**.
4. Railway detecta automáticamente que es Node.js y ejecuta `npm start`.

---

## Módulos del bot

| Función | Descripción |
|---|---|
| `analizarRondas(rondas)` | Calcula bajos, promedio y tendencia de una lista de rondas |
| `detectarPatron()` | Evalúa el historial y devuelve el patrón activo |
| `generarPrediccion(patron)` | Genera predicción, retiro seguro y nivel de riesgo |
| `enviarConControl(mensaje)` | Envía por Telegram con control anti-spam y anti-duplicados |
| `ciclo()` | Loop principal: obtiene ronda, analiza y notifica |
