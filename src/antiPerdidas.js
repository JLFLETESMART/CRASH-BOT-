const config = require("./config");

/**
 * Crea un filtro anti-pérdidas.
 * Si hay más de N pérdidas consecutivas, pausa las entradas
 * hasta que haya una señal fuerte.
 *
 * @returns {object} Filtro con métodos registrar, permitirEntrada, estado, reiniciar
 */
function crearFiltroAntiPerdidas() {
  let perdidasConsecutivas = 0;
  let pausado = false;

  /**
   * Registra el resultado de una entrada.
   * @param {boolean} gano - Si la ronda fue ganancia
   */
  function registrar(gano) {
    if (gano) {
      perdidasConsecutivas = 0;
      pausado = false;
    } else {
      perdidasConsecutivas++;
      if (perdidasConsecutivas >= config.maxPerdidasConsecutivas) {
        pausado = true;
      }
    }
  }

  /**
   * Verifica si se permite entrar.
   * Si está pausado, solo permite con señal fuerte (score alto).
   *
   * @param {number} score - Score de entrada (0-100) de detectarEntrada()
   * @returns {{ permitido: boolean, razon: string }}
   */
  function permitirEntrada(score) {
    if (!pausado) {
      return { permitido: true, razon: "Sin restricciones" };
    }

    // Señal fuerte: score >= 80 permite salir de la pausa
    if (score >= 80) {
      pausado = false;
      perdidasConsecutivas = 0;
      return {
        permitido: true,
        razon: `Señal fuerte (score ${score}) → saliendo de pausa`,
      };
    }

    return {
      permitido: false,
      razon: `Pausado: ${perdidasConsecutivas} pérdidas consecutivas. Esperando señal fuerte (score >= 80)`,
    };
  }

  /**
   * Retorna el estado del filtro.
   * @returns {{ perdidasConsecutivas: number, pausado: boolean }}
   */
  function estado() {
    return { perdidasConsecutivas, pausado };
  }

  /**
   * Reinicia el filtro.
   */
  function reiniciar() {
    perdidasConsecutivas = 0;
    pausado = false;
  }

  return { registrar, permitirEntrada, estado, reiniciar };
}

module.exports = { crearFiltroAntiPerdidas };
