// assets/js/pwa.js
export async function initPWA({ swPath='./sw.js', scope='./', installBtnId, onUpdate }) {
  // SW
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register(swPath, { scope });
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(() => {
              onUpdate?.(reg);
              reg.waiting?.postMessage('SKIP_WAITING');
            });
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    } catch { /* silencioso */ }
  }

  // Instalar
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = installBtnId && document.getElementById(installBtnId);
    if (!btn) return;
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') { btn.textContent = 'Instalado / em instalação'; btn.disabled = true; }
      deferredPrompt = null;
    }, { once: true });
  });
}

function showUpdateBanner(onClick){
  const b = document.createElement('div');
  b.setAttribute('style', `
    position:fixed; left:50%; transform:translateX(-50%); bottom:16px; z-index:9999;
    background:#111827; color:#fff; padding:10px 14px; border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.3); display:flex; gap:10px; align-items:center;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
  `);
  b.innerHTML = `<span>🔄 Nova versão disponível</span>
    <button type="button" style="padding:6px 12px;border:none;border-radius:8px;
      background:linear-gradient(90deg,#22d3ee,#a78bfa); color:#0b1020; font-weight:800">Atualizar</button>`;
  b.querySelector('button').onclick = () => { onClick?.(); b.remove(); };
  document.body.appendChild(b);
}
