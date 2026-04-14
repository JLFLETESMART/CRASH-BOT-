const config = require("./config");

/**
 * Estado de la banca del bot.
 * @typedef {{
 *   banca: number,
 *   apuesta: number,
 *   rondaGanada: boolean,
 *   activo: boolean,
 *   mensaje: string
 * }} EstadoBanca
 */

/**
 * Crea una nueva instancia del gestor de banca.
 * @returns {object} Gestor de banca con métodos para operar
 */
function crearGestorBanca() {
  let banca = config.bancaInicial;
  let apuesta = config.apuestaBase;
  let activo = true;

  /**
   * Registra el resultado de una ronda donde se entró.
   *
   * @param {boolean} gano - Si la ronda fue ganada (cashout exitoso)
   * @param {number} multiplicador - El multiplicador al que se hizo cashout (si ganó)
   * @returns {EstadoBanca}
   */
  function registrarResultado(gano, multiplicador) {
    if (!activo) {
      return {
        banca,
        apuesta,
        rondaGanada: false,
        activo: false,
        mensaje: "⛔ Bot detenido (objetivo alcanzado o banca agotada)",
      };
    }

    if (gano) {
      const ganancia = apuesta * (multiplicador - 1);
      banca = +(banca + ganancia).toFixed(2);
      apuesta = config.apuestaBase; // reset tras ganancia
      return {
        banca,
        apuesta,
        rondaGanada: true,
        activo: true,
        mensaje: `✅ Ganancia: +$${ganancia.toFixed(2)} → Banca: $${banca.toFixed(2)}`,
      };
    }

    // Pérdida
    banca = +(banca - apuesta).toFixed(2);
    // Progresión controlada: subir apuesta tras pérdida
    apuesta = Math.min(
      config.apuestaMaxima,
      +(apuesta * config.factorProgresion).toFixed(2)
    );

    // No apostar más de lo que hay en la banca
    apuesta = Math.min(apuesta, banca);

    // Verificar si se agotó la banca
    if (banca <= 0) {
      activo = false;
      banca = 0;
      return {
        banca,
        apuesta: 0,
        rondaGanada: false,
        activo: false,
        mensaje: "💀 Banca agotada. Bot detenido.",
      };
    }

    // Verificar si se alcanzó el objetivo
    if (banca >= config.objetivo) {
      activo = false;
      return {
        banca,
        apuesta: 0,
        rondaGanada: false,
        activo: false,
        mensaje: `🏆 ¡Objetivo alcanzado! Banca: $${banca.toFixed(2)}`,
      };
    }

    return {
      banca,
      apuesta,
      rondaGanada: false,
      activo: true,
      mensaje: `❌ Pérdida: -$${(banca + apuesta / config.factorProgresion - banca).toFixed(2)} → Banca: $${banca.toFixed(2)} | Próxima apuesta: $${apuesta.toFixed(2)}`,
    };
  }

  /**
   * Retorna el estado actual de la banca.
   * @returns {{ banca: number, apuesta: number, activo: boolean }}
   */
  function estado() {
    return { banca, apuesta, activo };
  }

  /**
   * Reinicia la banca a su estado inicial.
   */
  function reiniciar() {
    banca = config.bancaInicial;
    apuesta = config.apuestaBase;
    activo = true;
  }

  return { registrarResultado, estado, reiniciar };
}

module.exports = { crearGestorBanca };
