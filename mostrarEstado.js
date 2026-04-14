/**
 * Módulo de visualización limpia para el bot.
 * Muestra solo información clara y útil para decisiones.
 */

/**
 * Muestra el estado actual del bot de forma limpia y minimalista.
 * @param {{ estado: string, cashout?: number }} decision - Estado actual de la decisión
 * @param {number} banca - Banca actual del usuario
 * @param {number} [ultimo] - Último valor de ronda/precio
 */
function mostrarEstado(decision, banca, ultimo) {
  console.clear();

  console.log("═══════════════════════════════");
  console.log("         CRASH BOT");
  console.log("═══════════════════════════════\n");

  if (decision.estado && decision.estado.includes("ENTRAR")) {
    const cashout = decision.cashout || "2.00";
    console.log("  🚨 ENTRAR");
    console.log(`  🎯 Retirar en: ${cashout}x`);
    console.log(`  💰 Banca: $${banca}`);
  } else {
    console.log("  ⏳ Esperando oportunidad...");
    if (ultimo !== undefined && ultimo !== null) {
      console.log(`  📊 Último: ${ultimo}x`);
    }
    console.log(`  💰 Banca: $${banca}`);
  }

  if (decision.estado && decision.estado.includes("PAUSA")) {
    console.log("\n  ⚠️  MERCADO INESTABLE");
  }

  console.log("\n═══════════════════════════════\n");
}

module.exports = { mostrarEstado };
