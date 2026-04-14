# CRASH-BOT 🤖

Bot inteligente de crash tipo Aviator con análisis de patrones, gestión de banca y notificaciones por Telegram.

---

## ¿Qué hace?

Sistema automatizado que analiza rondas en tiempo real, detecta patrones de oportunidad y emite señales automáticas indicando cuándo entrar y en qué punto retirarse (cashout), maximizando ganancias y reduciendo riesgo.

### Características

- **Análisis inteligente** de las últimas 30 rondas (rachas, promedios ponderados, volatilidad, tendencia)
- **Entrada selectiva** solo cuando hay alta probabilidad (score ≥ 60/100)
- **Cashout dinámico** entre 1.8x y 2.5x según condiciones del historial
- **Gestión de banca** con progresión controlada y objetivos automáticos
- **Filtro anti-pérdidas** que pausa tras 2+ pérdidas consecutivas
- **Notificaciones Telegram** en tiempo real

---

## Arquitectura modular

```
bot.js                     → Orquestador principal (ciclo de rondas)
telegram.js                → Notificaciones Telegram
src/
  config.js                → Parámetros configurables
  analizarHistorial.js     → Análisis de historial (rachas, pesos, volatilidad)
  detectarEntrada.js       → Detección de entrada (score 0-100)
  calcularCashout.js       → Cashout dinámico (1.8x – 2.5x)
  gestionarBanca.js        → Gestión de banca y progresión
  antiPerdidas.js          → Filtro anti-pérdidas
```

| Módulo | Función principal | Descripción |
|---|---|---|
| `analizarHistorial` | `analizarHistorial(historial)` | Analiza últimas 30 rondas: rachas de bajos consecutivos, promedio ponderado, volatilidad, tendencia |
| `detectarEntrada` | `detectarEntrada(analisis)` | Genera score de entrada (0-100) usando pesos, NO aleatorios. Penaliza rachas mixtas |
| `calcularCashout` | `calcularCashout(analisis)` | Cashout dinámico: conservador (1.8x) en rachas malas, agresivo (2.5x) en estabilidad |
| `gestionarBanca` | `crearGestorBanca()` | Control de banca con progresión controlada, auto-stop al objetivo o banca 0 |
| `antiPerdidas` | `crearFiltroAntiPerdidas()` | Pausa tras 2+ pérdidas, requiere señal fuerte (score ≥ 80) para reanudar |

---

## Lógica de decisión

### Score de entrada (0-100)

| Factor | Puntos | Condición |
|---|---|---|
| Racha de bajos consecutivos | 0-40 | ≥ 5 consecutivos < 1.5x |
| Densidad de bajos | 0-25 | ≥ 50% de la ventana < 1.5x |
| Tendencia bajando | 0-20 | Promedio reciente menor que promedio anterior |
| Promedio ponderado bajo | 0-15 | < 2.0x |
| **Penalización: racha mixta** | -20 | Sin patrón claro |

**Entrada solo si score ≥ 60.**

### Cashout dinámico

| Condición | Cashout | Tipo |
|---|---|---|
| 8+ bajos consecutivos | 1.80x | Conservador |
| 6-7 bajos consecutivos | 2.00x | Conservador |
| 5 bajos consecutivos | 2.15x | Moderado |
| Tendencia estable, pocos bajos | 2.50x | Agresivo |
| Tendencia subiendo | 2.50x | Agresivo |

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

## Configuración

### Archivo `.env`

```env
# Telegram
TELEGRAM_TOKEN=token_de_tu_bot_de_telegram
TELEGRAM_CHAT_ID=tu_chat_id
```

### Parámetros del bot (`src/config.js`)

| Parámetro | Default | Descripción |
|---|---|---|
| `bancaInicial` | 100 | Capital inicial |
| `objetivo` | 1000 | Objetivo de ganancia (auto-stop) |
| `apuestaBase` | 1 | Apuesta inicial |
| `apuestaMaxima` | 20 | Límite de apuesta |
| `factorProgresion` | 1.5 | Multiplicador tras pérdida |
| `umbralBajo` | 1.5 | Valor considerado "bajo" |
| `rachaMinima` | 5 | Mínimo consecutivos para activar entrada |
| `scoreMinEntrada` | 60 | Score mínimo (0-100) para entrar |
| `cashoutMin` | 1.8 | Cashout mínimo |
| `cashoutMax` | 2.5 | Cashout máximo |
| `maxPerdidasConsecutivas` | 2 | Pérdidas antes de pausar |
| `intervaloRondaMs` | 5000 | Intervalo entre rondas (ms) |

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
3. Busca el campo `"chat":{"id":...}` en la respuesta JSON.

---

## Ejecución

```bash
npm start
```

### Salida en consola

```
═══════════════════════════════════════════════════════
🚀 CRASH BOT - HIGH FLYER
═══════════════════════════════════════════════════════
🏦 Banca inicial:  $100.00
🎯 Objetivo:       $1000.00
📉 Umbral bajo:    <1.5x
🔄 Racha mínima:   5 consecutivos
💰 Cashout:        1.8x – 2.5x
⏱️  Intervalo:      5s
═══════════════════════════════════════════════════════
───────────────────────────────────────────────────────
📊 Última ronda:     1.20x
📈 Estado:           🟢 ENTRAR (score: 75/100)
💰 Cashout:          2.00x (conservador)
🎯 Apuesta:          $1.00
🏦 Banca:            $101.00
───────────────────────────────────────────────────────
```

---

## Control anti-spam

- Mínimo **4 segundos** entre mensajes Telegram.
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

