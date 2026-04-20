// High Flyer Bot Connector — content.js
// Intercepta el WebSocket de Pragmatic Play y reenvía datos al bot

(function () {
  'use strict';

  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function (url, protocols) {
    const ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    // Solo interceptar conexiones de Pragmatic Play
    const isPP = typeof url === 'string' && (
      url.includes('pragmaticplaylive.net') ||
      url.includes('broadcaster.pragmatic')
    );

    if (isPP) {
      console.log('[HF-Bot] WebSocket PP detectado:', url.slice(0, 80));

      ws.addEventListener('message', (event) => {
        try {
          const text = typeof event.data === 'string'
            ? event.data
            : null;

          if (!text) return;

          // Buscar crash point en el mensaje
          const crashPoint = extractCrashPoint(text);

          if (crashPoint !== null) {
            console.log('[HF-Bot] 💥 Crash detectado:', crashPoint + 'x');
            sendToBotServer(crashPoint);
          }
        } catch (e) {
          // silencioso
        }
      });
    }

    return ws;
  };

  // Copiar propiedades estáticas del WebSocket original
  Object.assign(window.WebSocket, OriginalWebSocket);
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  /**
   * Extrae el crash point de un mensaje JSON de Pragmatic Play.
   */
  function extractCrashPoint(text) {
    let msg;

    // Parsear JSON directo
    try {
      msg = JSON.parse(text);
    } catch (_) {
      // Protocolo Socket.IO: "42[event, data]"
      if (text.startsWith('42')) {
        try {
          const arr = JSON.parse(text.slice(2));
          msg = { event: arr[0], data: arr[1] };
        } catch (_) {}
      }
    }

    if (!msg) return null;

    const typeOrEvent = (
      msg.type || msg.event || msg.action ||
      msg.status || msg.cmd || ''
    ).toLowerCase();

    const crashKeywords = [
      'crash', 'game_ended', 'gameended', 'round_end',
      'roundend', 'result', 'finished', 'end'
    ];

    const isCrashEvent = crashKeywords.some(k => typeOrEvent.includes(k));
    if (!isCrashEvent) return null;

    const candidates = [
      msg.crashPoint, msg.crash_point,
      msg.multiplier, msg.outcomeValue, msg.outcome, msg.result,
      msg.data?.crashPoint, msg.data?.crash_point,
      msg.data?.multiplier, msg.data?.outcomeValue,
      msg.payload?.crashPoint, msg.payload?.multiplier,
    ];

    for (const v of candidates) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 1.0 && n <= 1000000) return +n.toFixed(2);
    }

    return null;
  }

  /**
   * Envía el crash point al servidor del bot.
   */
  function sendToBotServer(crashPoint) {
    chrome.storage.sync.get(['botUrl', 'botSecret'], (data) => {
      const url    = data.botUrl    || '';
      const secret = data.botSecret || '';

      if (!url || !secret) {
        console.warn('[HF-Bot] Configura la URL y la clave secreta en la extensión');
        return;
      }

      fetch(url + '/api/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, crashPoint })
      })
      .then(r => r.json())
      .then(d => console.log('[HF-Bot] ✅ Enviado al bot:', d))
      .catch(e => console.warn('[HF-Bot] Error al enviar:', e.message));
    });
  }

  console.log('[HF-Bot] Extensión lista — interceptando WebSockets de Pragmatic Play');
})();
