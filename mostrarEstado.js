/**
 * Muestra el estado actual del bot de forma limpia y visual.
 * Limpia la consola y muestra solo información relevante para decisiones.
 *
 * @param {{ estado: string, cashout?: number }} decision - Estado actual y cashout sugerido
 * @param {number} banca - Banca actual del usuario
 * @param {number} ultimo - Último valor de ronda o precio
 */
function mostrarEstado(decision, banca, ultimo) {
  console.clear();

  if (decision.estado && decision.estado.includes("ENTRAR")) {
    console.log("🚨 ENTRAR");
    console.log(`🎯 Retirar en: ${decision.cashout || 2}x`);
    console.log(`💰 Banca: ${banca}`);
  } else {
    console.log("⏳ Esperando oportunidad...");
    console.log(`📊 Último: ${ultimo}`);
    console.log(`💰 Banca: ${banca}`);
  }

  if (decision.estado && decision.estado.includes("PAUSA")) {
    console.log("⚠️ MERCADO INESTABLE");
  }
}

module.exports = { mostrarEstado };
