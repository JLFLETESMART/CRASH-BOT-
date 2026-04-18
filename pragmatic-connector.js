const WebSocket = require("ws");

const TABLE_ID = process.env.PP_TABLE_ID || "haphflyer2201jfm";
const BROADCASTER_WS = process.env.PP_BROADCASTER_WS || "wss://broadcaster.pragmaticplaylive.net/ws";
const GS_WS = process.env.PP_GS_WS || "wss://gs17.pragmaticplaylive.net/game";
// URL completo con autenticación (se obtiene de DevTools cuando el juego está abierto)
const FULL_WS_URL = process.env.PP_FULL_WS_URL || null;

const RECONNECT_DELAY_MS = 5000;
const PING_INTERVAL_MS = 25000;

class PragmaticConnector {
  constructor(onRoundComplete, onMultiplierUpdate) {
    this.onRoundComplete = onRoundComplete;
    this.onMultiplierUpdate = onMultiplierUpdate;
    this.ws = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.connected = false;
    this.useBroadcaster = true;
    this.rawLog = [];
  }

  start() {
    this._connect();
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
    }
    this.connected = false;
  }

  _getUrl() {
    // Prioridad: URL completo con auth > broadcaster > GS
    if (FULL_WS_URL) {
      return FULL_WS_URL;
    }
    if (this.useBroadcaster) {
      return `${BROADCASTER_WS}?tableId=${TABLE_ID}`;
    }
    return `${GS_WS}`;
  }

  _connect() {
    const url = this._getUrl();
    console.log(`[PP] Conectando a ${url} (tableId: ${TABLE_ID})`);

    try {
      this.ws = new WebSocket(url, {
        headers: {
          "Origin": "https://afun.com.mx",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        handshakeTimeout: 10000
      });
    } catch (err) {
      console.error("[PP] Error al crear WebSocket:", err.message);
      this._scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      console.log("[PP] Conexión abierta");
      this.connected = true;
      this._subscribe();
      this._startPing();
    });

    this.ws.on("message", (data) => {
      this._handleMessage(data);
    });

    this.ws.on("error", (err) => {
      console.error("[PP] Error WebSocket:", err.message);
    });

    this.ws.on("close", (code, reason) => {
      console.warn(`[PP] Conexión cerrada (${code}). Reconectando en ${RECONNECT_DELAY_MS / 1000}s...`);
      this.connected = false;
      this._stopPing();
      this._scheduleReconnect();
    });
  }

  _subscribe() {
    const msgs = [
      JSON.stringify({ type: "subscribe", tableId: TABLE_ID }),
      JSON.stringify({ action: "subscribe", tableId: TABLE_ID }),
      JSON.stringify({ cmd: "subscribe", tableId: TABLE_ID }),
      JSON.stringify({ event: "subscribe", data: { tableId: TABLE_ID } }),
    ];
    msgs.forEach(m => {
      try { this.ws.send(m); } catch (_) {}
    });
    console.log(`[PP] Suscripción enviada para tableId: ${TABLE_ID}`);
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.ping();
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch (_) {}
      }
    }, PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  _scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, RECONNECT_DELAY_MS);
  }

  _handleMessage(rawData) {
    let text;
    try {
      text = rawData.toString();
    } catch (_) {
      return;
    }

    // Guardar muestra de mensajes crudos para diagnóstico (primeros 50, siempre)
    this.rawLog.push(text.slice(0, 500));
    if (this.rawLog.length > 50) this.rawLog.shift();
    if (this.rawLog.length <= 10 || this.rawLog.length % 5 === 0) {
      console.log(`[PP RAW #${this.rawLog.length}]:`, text.slice(0, 500));
    }

    let msg;
    try {
      msg = JSON.parse(text);
    } catch (_) {
      // Protocolo Socket.IO: mensajes tipo "42[...]"
      if (text.startsWith("42")) {
        try {
          const arr = JSON.parse(text.slice(2));
          msg = { event: arr[0], data: arr[1] };
        } catch (_) {}
      } else if (text === "2") {
        // ping de Socket.IO
        try { this.ws.send("3"); } catch (_) {}
        return;
      } else {
        return;
      }
    }

    if (!msg) return;

    // Detectar crash point en distintos formatos posibles
    const crashPoint = this._extractCrashPoint(msg);
    if (crashPoint !== null) {
      console.log(`[PP] 💥 CRASH detectado: ${crashPoint}x`);
      this.onRoundComplete(crashPoint);
      return;
    }

    // Detectar multiplicador en vuelo
    const mult = this._extractMultiplier(msg);
    if (mult !== null && this.onMultiplierUpdate) {
      this.onMultiplierUpdate(mult);
    }

    // Detectar historial de rondas al conectarse
    const history = this._extractHistory(msg);
    if (history.length > 0) {
      console.log(`[PP] Historial recibido: ${history.length} rondas`);
      history.forEach(cp => this.onRoundComplete(cp));
    }
  }

  _extractCrashPoint(msg) {
    // Diferentes campos posibles según la versión del protocolo
    const candidates = [
      msg.crashPoint,
      msg.crash_point,
      msg.multiplier,
      msg.outcomeValue,
      msg.outcome,
      msg.result,
      msg.data?.crashPoint,
      msg.data?.crash_point,
      msg.data?.multiplier,
      msg.data?.outcomeValue,
      msg.payload?.crashPoint,
      msg.payload?.multiplier,
    ];

    const crashKeywords = [
      "crash", "CRASH", "Crash",
      "gameended", "game_ended", "GAME_ENDED", "GameEnded",
      "roundend", "round_end", "ROUND_END",
      "result", "RESULT",
      "finished", "FINISHED"
    ];

    const typeOrEvent = msg.type || msg.event || msg.action || msg.cmd || msg.status || "";
    const isCrashEvent = crashKeywords.some(k =>
      typeOrEvent.toLowerCase().includes(k.toLowerCase())
    );

    if (isCrashEvent) {
      for (const v of candidates) {
        const n = parseFloat(v);
        if (!isNaN(n) && n >= 1.0 && n <= 1000000) return +n.toFixed(2);
      }
    }

    return null;
  }

  _extractMultiplier(msg) {
    const liveKeywords = ["tick", "multiplier_update", "flying", "inprogress", "live"];
    const typeOrEvent = (msg.type || msg.event || msg.action || "").toLowerCase();
    const isLive = liveKeywords.some(k => typeOrEvent.includes(k));
    if (!isLive) return null;

    const v = msg.multiplier || msg.data?.multiplier || msg.value;
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 1.0) return +n.toFixed(2);
    return null;
  }

  _extractHistory(msg) {
    const rounds = [];
    const historyFields = [
      msg.history,
      msg.rounds,
      msg.data?.history,
      msg.data?.rounds,
      msg.payload?.history,
      msg.payload?.rounds,
    ];

    for (const field of historyFields) {
      if (Array.isArray(field) && field.length > 0) {
        for (const r of field) {
          const cp = r.crashPoint || r.crash_point || r.multiplier || r.value || r;
          const n = parseFloat(cp);
          if (!isNaN(n) && n >= 1.0 && n <= 1000000) {
            rounds.push(+n.toFixed(2));
          }
        }
        if (rounds.length > 0) break;
      }
    }

    return rounds;
  }

  getStatus() {
    return {
      connected: this.connected,
      tableId: TABLE_ID,
      rawLogSample: this.rawLog.slice(0, 5)
    };
  }
}

module.exports = PragmaticConnector;
