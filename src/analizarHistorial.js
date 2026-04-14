const config = require("./config");

/**
 * Analiza el historial de rondas recientes.
 * Calcula rachas de bajos consecutivos, promedio ponderado, volatilidad y tendencia.
 *
 * @param {number[]} historial - Array completo de resultados de rondas
 * @returns {{
 *   consecutivosBajos: number,
 *   totalBajos: number,
 *   ratioBajos: number,
 *   promedioPonderado: number,
 *   volatilidad: number,
 *   tendencia: string,
 *   ultimaRonda: number,
 *   ventana: number[]
 * }}
 */
function analizarHistorial(historial) {
  const ventana = historial.slice(-config.ventanaAnalisis);

  if (ventana.length < 5) {
    return {
      consecutivosBajos: 0,
      totalBajos: 0,
      ratioBajos: 0,
      promedioPonderado: 0,
      volatilidad: 0,
      tendencia: "insuficiente",
      ultimaRonda: ventana[ventana.length - 1] || 0,
      ventana,
    };
  }

  // Contar consecutivos bajos desde el final
  let consecutivosBajos = 0;
  for (let i = ventana.length - 1; i >= 0; i--) {
    if (ventana[i] < config.umbralBajo) {
      consecutivosBajos++;
    } else {
      break;
    }
  }

  // Total de bajos en la ventana
  const totalBajos = ventana.filter((x) => x < config.umbralBajo).length;
  const ratioBajos = totalBajos / ventana.length;

  // Promedio ponderado (rondas más recientes pesan más)
  let pesoTotal = 0;
  let sumaPonderada = 0;
  for (let i = 0; i < ventana.length; i++) {
    const peso = i + 1; // 1, 2, 3, ... N (más recientes pesan más)
    sumaPonderada += ventana[i] * peso;
    pesoTotal += peso;
  }
  const promedioPonderado = sumaPonderada / pesoTotal;

  // Volatilidad (desviación estándar)
  const media = ventana.reduce((a, b) => a + b, 0) / ventana.length;
  const varianza =
    ventana.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) /
    ventana.length;
  const volatilidad = Math.sqrt(varianza);

  // Tendencia: comparar promedio de primera mitad vs segunda mitad
  const mitad = Math.floor(ventana.length / 2);
  const primeraMitad = ventana.slice(0, mitad);
  const segundaMitad = ventana.slice(mitad);
  const promPrimera =
    primeraMitad.reduce((a, b) => a + b, 0) / primeraMitad.length;
  const promSegunda =
    segundaMitad.reduce((a, b) => a + b, 0) / segundaMitad.length;

  let tendencia;
  const diff = promSegunda - promPrimera;
  if (diff < -0.5) {
    tendencia = "bajando";
  } else if (diff > 0.5) {
    tendencia = "subiendo";
  } else {
    tendencia = "estable";
  }

  return {
    consecutivosBajos,
    totalBajos,
    ratioBajos: +ratioBajos.toFixed(3),
    promedioPonderado: +promedioPonderado.toFixed(2),
    volatilidad: +volatilidad.toFixed(2),
    tendencia,
    ultimaRonda: ventana[ventana.length - 1],
    ventana,
  };
}

module.exports = { analizarHistorial };
