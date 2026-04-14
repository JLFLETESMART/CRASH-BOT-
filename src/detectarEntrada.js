const config = require("./config");

/**
 * Detecta si es buen momento para entrar basado en el análisis del historial.
 * Genera un score de entrada (0-100) usando lógica de pesos, NO aleatorios.
 *
 * Criterios:
 * - Racha de bajos consecutivos (peso principal)
 * - Ratio de bajos en la ventana
 * - Tendencia bajando (acumulación → probable rebote)
 * - Promedio ponderado bajo
 *
 * @param {{
 *   consecutivosBajos: number,
 *   totalBajos: number,
 *   ratioBajos: number,
 *   promedioPonderado: number,
 *   volatilidad: number,
 *   tendencia: string,
 *   ventana: number[]
 * }} analisis - Resultado de analizarHistorial()
 * @returns {{ entrar: boolean, score: number, razon: string }}
 */
function detectarEntrada(analisis) {
  const {
    consecutivosBajos,
    ratioBajos,
    promedioPonderado,
    tendencia,
    ventana,
  } = analisis;

  if (!ventana || ventana.length < 5) {
    return { entrar: false, score: 0, razon: "Historial insuficiente" };
  }

  let score = 0;
  const razones = [];

  // --- Factor 1: Racha de bajos consecutivos (0-40 puntos) ---
  // 5+ consecutivos es la condición principal
  if (consecutivosBajos >= config.rachaMinima) {
    // Escala: 5→30, 6→33, 7→36, 8→38, 9→39, 10+→40
    const puntos = Math.min(40, 20 + consecutivosBajos * 4);
    score += puntos;
    razones.push(`${consecutivosBajos} bajos consecutivos (+${puntos})`);
  } else if (consecutivosBajos >= 3) {
    const puntos = consecutivosBajos * 5;
    score += puntos;
    razones.push(`${consecutivosBajos} bajos consecutivos (+${puntos})`);
  }

  // --- Factor 2: Ratio de bajos en la ventana (0-25 puntos) ---
  if (ratioBajos >= 0.7) {
    score += 25;
    razones.push(`Alta densidad de bajos: ${(ratioBajos * 100).toFixed(0)}% (+25)`);
  } else if (ratioBajos >= 0.5) {
    const puntos = Math.round(ratioBajos * 30);
    score += puntos;
    razones.push(`Densidad media de bajos: ${(ratioBajos * 100).toFixed(0)}% (+${puntos})`);
  }

  // --- Factor 3: Tendencia bajando (0-20 puntos) ---
  // Acumulación de valores bajos sugiere posible rebote
  if (tendencia === "bajando") {
    score += 20;
    razones.push("Tendencia a la baja → posible rebote (+20)");
  } else if (tendencia === "estable" && ratioBajos > 0.4) {
    score += 10;
    razones.push("Tendencia estable con bajos frecuentes (+10)");
  }

  // --- Factor 4: Promedio ponderado bajo (0-15 puntos) ---
  if (promedioPonderado < 1.5) {
    score += 15;
    razones.push(`Promedio ponderado muy bajo: ${promedioPonderado}x (+15)`);
  } else if (promedioPonderado < 2.0) {
    score += 10;
    razones.push(`Promedio ponderado bajo: ${promedioPonderado}x (+10)`);
  }

  // --- Penalización: rachas mixtas ---
  // Si hay mezcla de altos y bajos sin patrón claro → reducir score
  if (consecutivosBajos < 3 && ratioBajos < 0.5 && tendencia !== "bajando") {
    score = Math.max(0, score - 20);
    if (score < config.scoreMinEntrada) {
      razones.push("Racha mixta sin patrón claro (-20)");
    }
  }

  // Limitar score a 0-100
  score = Math.min(100, Math.max(0, score));

  const entrar = score >= config.scoreMinEntrada;
  const razon = razones.length > 0
    ? razones.join(" | ")
    : "Sin señales de entrada";

  return { entrar, score, razon };
}

module.exports = { detectarEntrada };
