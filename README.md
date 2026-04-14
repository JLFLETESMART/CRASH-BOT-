# CRASH-BOT 🤖

Bot predictor de rondas tipo Crash/Aviator con lectura de pantalla en vivo, OCR y aprendizaje automático. Envía señales claras por Telegram: **APOSTAR**, **NO APOSTAR** o **ESPERAR**.

---

## ¿Qué hace?

- **Captura la pantalla en vivo** cada 3 segundos usando `screenshot-desktop`
- **Lee los multiplicadores** (x1.50, x20, x4.5, etc.) con OCR (`tesseract.js`)
- **Analiza patrones** en el historial de rondas (rachas bajas, tendencias, acumulación)
- **Genera predicciones** con nivel de riesgo y punto de retiro recomendado
- **Aprende con el tiempo** — guarda historial y precisión en `memoria.json`
- **Notifica por Telegram** con señales claras: ✅ APOSTAR / ❌ NO APOSTAR / ⏳ ESPERAR

---

## Señales del bot

| Señal | Significado |
|---|---|
| ✅ **APOSTAR** | Patrón favorable detectado — incluye cashout recomendado |
| ❌ **NO APOSTAR** | Riesgo alto de caída — mejor esperar |
| ⏳ **ESPERAR** | Sin patrón claro o recopilando datos |

---

## Lógica de predicción

El bot analiza las últimas **10, 20 y 50 rondas** y detecta:

| Patrón | Condición | Señal |
|---|---|---|
| Racha baja | ≥ 5 rondas bajas consecutivas | ✅ APOSTAR |
| Frecuencia caídas | ≥ 14/20 rondas recientes < 2x | ✅ APOSTAR |
| Acumulación | Tendencia descendente + muchas bajas | ✅ APOSTAR |
| Racha extrema | ≥ 7 bajos consecutivos + promedio alto | ✅ APOSTAR (Alto) |
| Rondas altas recientes | Promedio > 8x con pocas bajas | ❌ NO APOSTAR |

### Aprendizaje

- El bot guarda cada ronda en `memoria.json`
- Evalúa si sus predicciones anteriores fueron correctas
- Ajusta automáticamente sus predicciones según su precisión histórica
- Cuanto más tiempo corra, mejor se vuelven sus recomendaciones

---

## Instalación

### Requisitos
- [Node.js](https://nodejs.org/) 18 o superior
- Pantalla visible con el juego Crash/Aviator abierto

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/JLFLETESMART/CRASH-BOT-
cd CRASH-BOT-

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# edita .env con tus credenciales de Telegram
```

---

## Configuración del archivo `.env`

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
3. Busca el campo `"chat":{"id":...}` en la respuesta JSON.

---

## Ejecución

```bash
npm start
```

El bot:
1. Carga su memoria previa (si existe)
2. Inicializa el lector OCR
3. Comienza a capturar la pantalla cada 3 segundos
4. Lee multiplicadores y analiza patrones
5. Envía notificaciones por Telegram cuando detecta oportunidades

---

## Notificaciones por Telegram

### Al iniciar
```
🚀 CRASH BOT activo

📸 Leyendo pantalla en vivo
🧠 Rondas en memoria: 150
🎯 Precisión: 62.5%
```

### Señal de apostar
```
✅ APOSTAR

🎯 Retirar en: 3.50x
⚠️ Riesgo: MEDIO
📊 Confianza: MEDIA-ALTA

💡 14/20 rondas recientes fueron < 2x

Últimas: 1.2x, 1.5x, 1.1x, 1.3x, 1.4x
🧠 Precisión del bot: 62.5%
```

### Señal de no apostar
```
❌ NO APOSTAR

⚠️ Riesgo: ALTO
📊 Confianza: ALTA

💡 Rondas recientes muy altas — probable caída fuerte

Últimas: 15.2x, 8.5x, 12.1x, 9.3x, 7.4x
🧠 Precisión del bot: 62.5%
```

---

## Consola en vivo

```
╔══════════════════════════════════════════╗
║          CRASH BOT - EN VIVO             ║
╠══════════════════════════════════════════╣
║  Último detectado:  3.50x               ║
║  Últimas 5: 1.2x → 1.5x → 1.1x → ...  ║
╠══════════════════════════════════════════╣
║  ✅ Acción:  APOSTAR                     ║
║  🎯 Retirar en:  3.50x                  ║
║  ⚠️ Riesgo:  MEDIO                      ║
║  📊 Confianza:  MEDIA-ALTA              ║
║  💡 Razón:  14/20 rondas < 2x           ║
╠══════════════════════════════════════════╣
║  🧠 Rondas en memoria: 150              ║
║  🎯 Precisión: 62.5%                    ║
║     (50/80 predicciones acertadas)       ║
╚══════════════════════════════════════════╝
```

---

## Módulos

| Archivo | Descripción |
|---|---|
| `bot.js` | Motor principal: captura, OCR, análisis, predicción y aprendizaje |
| `telegram.js` | Módulo de notificaciones por Telegram |

---

## Archivos generados

| Archivo | Descripción |
|---|---|
| `memoria.json` | Historial de rondas y estadísticas de precisión (se genera automáticamente) |
| `captura.png` | Última captura de pantalla (se sobreescribe cada ciclo) |

