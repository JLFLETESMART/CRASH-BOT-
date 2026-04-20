const urlInput    = document.getElementById('botUrl');
const secretInput = document.getElementById('botSecret');
const saveBtn     = document.getElementById('saveBtn');
const msgEl       = document.getElementById('msg');
const connDot     = document.getElementById('connDot');
const connText    = document.getElementById('connText');

// Cargar valores guardados
chrome.storage.sync.get(['botUrl', 'botSecret'], (data) => {
  if (data.botUrl)    urlInput.value    = data.botUrl;
  if (data.botSecret) secretInput.value = data.botSecret;
  if (data.botUrl && data.botSecret) checkConnection(data.botUrl, data.botSecret);
});

saveBtn.addEventListener('click', () => {
  const url    = urlInput.value.trim().replace(/\/$/, '');
  const secret = secretInput.value.trim();

  if (!url || !secret) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = '⚠️ Rellena los dos campos';
    return;
  }

  chrome.storage.sync.set({ botUrl: url, botSecret: secret }, () => {
    msgEl.style.color = '#ffcc00';
    msgEl.textContent = 'Guardado — probando conexión…';
    checkConnection(url, secret);
  });
});

function checkConnection(url, secret) {
  connDot.className  = 'dot';
  connText.textContent = 'Verificando…';

  fetch(url + '/api/round', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, crashPoint: 0 })
  })
  .then(async r => {
    const data = await r.json();
    if (r.ok || data.error === 'Valor inválido') {
      // 400 con "Valor inválido" = auth OK, solo el valor era malo
      connDot.className  = 'dot ok';
      connText.textContent = '✅ Bot conectado correctamente';
      msgEl.style.color  = '#00ff88';
      msgEl.textContent  = '¡Listo! Abre High Flyer y los datos se enviarán automáticamente.';
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
  })
  .catch(e => {
    connDot.className  = 'dot err';
    connText.textContent = '❌ Sin conexión';
    msgEl.style.color  = '#f87171';
    msgEl.textContent  = 'Error: ' + e.message;
  });
}
