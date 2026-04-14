const config = require("./config");

/**
 * Calcula el punto de cashout dinámico basado en el análisis del historial.
 *
 * Lógica:
 * - Racha muy mala (muchos consecutivos bajos) → cashout conservador (1.8x)
 * - Estabilidad / pocas pérdidas → cashout agresivo (2.2x-2.5x)
 * - Se ajusta según volatilidad y tendencia
 *
 * @param {{
 *   consecutivosBajos: number,
 *   ratioBajos: number,
 *   promedioPonderado: number,
 *   volatilidad: number,
 *   tendencia: string,
 * }} analisis - Resultado de analizarHistorial()
 * @returns {{ cashout: number, tipo: string }}
 */
function calcularCashout(analisis) {
  const {
    consecutivosBajos,
    ratioBajos,
    volatilidad,
    tendencia,
  } = analisis;

  let cashout = (config.cashoutMin + config.cashoutMax) / 2; // base: punto medio
  let tipo = "normal";

  // --- Racha de bajos muy larga → conservador ---
  if (consecutivosBajos >= 8) {
    cashout = config.cashoutMin;
    tipo = "conservador";
  } else if (consecutivosBajos >= 6) {
    cashout = config.cashoutMin + 0.2;
    tipo = "conservador";
  } else if (consecutivosBajos >= config.rachaMinima) {
    // Racha moderada → ligeramente conservador
    cashout = (config.cashoutMin + config.cashoutMax) / 2;
    tipo = "moderado";
  }

  // --- Alta densidad de bajos → bajar cashout ---
  if (ratioBajos >= 0.7) {
    cashout = Math.min(cashout, config.cashoutMin + 0.2);
    tipo = "conservador";
  }

  // --- Volatilidad alta → reducir cashout por seguridad ---
  if (volatilidad > 5) {
    cashout = Math.max(config.cashoutMin, cashout - 0.3);
    tipo = "conservador";
  }

  // --- Tendencia estable o subiendo → se puede subir el cashout ---
  if (tendencia === "estable" && ratioBajos < 0.5) {
    cashout = Math.min(config.cashoutMax, cashout + 0.3);
    tipo = "agresivo";
  } else if (tendencia === "subiendo") {
    cashout = config.cashoutMax;
    tipo = "agresivo";
  }

  // Asegurar que cashout está dentro de los límites
  cashout = Math.max(config.cashoutMin, Math.min(config.cashoutMax, cashout));

  return {
    cashout: +cashout.toFixed(2),
    tipo,
  };
}

module.exports = { calcularCashout };
