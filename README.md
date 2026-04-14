# CRASH-BOT 🤖

Bot predictor de rondas tipo Aviator con notificaciones inteligentes por Telegram.  
Sistema de producción profesional con Docker, logging avanzado y persistencia de datos.

---

## ¿Qué hace?

- Analiza el historial de rondas tipo Aviator y detecta patrones estadísticos.
- Envía señales **ENTRAR** o **POSIBLE ALTA** por Telegram con control anti-spam.
- Corre 24/7 con auto-restart, manejo robusto de errores y persistencia SQLite.
- Expone un endpoint `/health` para monitoreo.

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

## Estructura del proyecto

```
src/
├── config/           # Configuración centralizada y validación de env vars
├── services/
│   ├── BotService.js       # Lógica principal del bot
│   ├── TelegramService.js  # Envío de notificaciones Telegram
│   └── DatabaseService.js  # Persistencia SQLite
├── logger/           # Winston – logs en consola y archivo con rotación
├── utils/
│   └── retry.js      # Reintentos con exponential backoff
├── middlewares/
│   └── errorHandler.js # Manejo global de errores y señales del SO
└── index.js          # Punto de entrada + servidor HTTP /health
```

---

## Instalación rápida

### Requisitos
- [Node.js](https://nodejs.org/) 20 LTS
- (Opcional) [Docker](https://www.docker.com/) + Docker Compose para producción

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/JLFLETESMART/CRASH-BOT-.git
cd CRASH-BOT-

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales reales
```

---

## Configuración del archivo `.env`

```env
TELEGRAM_TOKEN=token_de_tu_bot
TELEGRAM_CHAT_ID=tu_chat_id
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DATABASE_URL=./data/crash-bot.db
```

Copia `.env.example` como referencia — contiene todas las variables disponibles con sus descripciones.

### Cómo obtener el token de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Escribe `/newbot` y sigue los pasos.
3. Copia el token que recibes (ej: `1234567890:AAEa...`).

### Cómo obtener tu Chat ID

1. Inicia una conversación con tu bot (envía `/start`).
2. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
3. Busca el campo `"chat":{"id":...}` en la respuesta JSON.

---

## Ejecución

```bash
# Modo producción
npm start

# Modo desarrollo (auto-reload con nodemon)
npm run dev
```

El bot iniciará y enviará `🚀 Bot iniciado correctamente` por Telegram.  
El health check estará disponible en `http://localhost:3000/health`.

---

## Docker (recomendado para producción)

```bash
# Construir imagen
npm run docker:build

# Iniciar con Docker Compose (background)
npm run docker:compose:up

# Ver logs
npm run docker:compose:logs

# Detener
npm run docker:compose:down
```

---

## Despliegue en VPS

Para despliegue en producción real (DigitalOcean, Linode, Hetzner, etc.)  
consulta la guía completa: **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

---

## Notificaciones que recibirás por Telegram

### Al iniciar
```
🚀 Bot iniciado correctamente
Analizando rondas en tiempo real.
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

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm start` | Inicia el bot en producción |
| `npm run dev` | Inicia con nodemon (auto-reload) |
| `npm test` | Verifica que todos los módulos cargan correctamente |
| `npm run build` | Valida la sintaxis de todo el código fuente |
| `npm run lint` | Ejecuta ESLint en `src/` |
| `npm run docker:build` | Construye la imagen Docker |
| `npm run docker:compose:up` | Inicia con Docker Compose |
| `npm run docker:compose:down` | Detiene Docker Compose |
| `npm run docker:compose:logs` | Muestra logs en vivo |

---

## Módulos principales

| Módulo | Descripción |
|---|---|
| `BotService.analizarRondas()` | Calcula bajos, promedio y tendencia |
| `BotService.detectarPatron()` | Evalúa el historial y devuelve el patrón activo |
| `BotService.generarPrediccion()` | Genera predicción, retiro seguro y nivel de riesgo |
| `TelegramService.sendNotification()` | Envía por Telegram con retry automático |
| `DatabaseService.saveRound()` | Persiste cada ronda en SQLite |
| `retry()` | Reintentos con exponential backoff |

