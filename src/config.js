/**
 * Configuración central del bot de crash.
 * Todos los parámetros son ajustables sin tocar la lógica.
 */
module.exports = {
  // --- Banca ---
  bancaInicial: 100,
  objetivo: 1000,
  apuestaBase: 1,
  apuestaMaxima: 20,
  factorProgresion: 1.5, // multiplicador tras pérdida

  // --- Historial ---
  maxHistorial: 200,
  ventanaAnalisis: 30,   // últimas N rondas a analizar

  // --- Umbrales de entrada ---
  umbralBajo: 1.5,       // valor considerado "bajo"
  rachaMinima: 5,         // mínimo consecutivos <1.5x para activar entrada
  scoreMinEntrada: 60,    // score mínimo (0-100) para señal de entrada

  // --- Cashout ---
  cashoutMin: 1.8,
  cashoutMax: 2.5,

  // --- Anti-pérdidas ---
  maxPerdidasConsecutivas: 2,

  // --- Timing ---
  intervaloRondaMs: 5000, // intervalo entre rondas (ms)
  intervaloMinMensajeMs: 4000, // anti-spam Telegram
};
