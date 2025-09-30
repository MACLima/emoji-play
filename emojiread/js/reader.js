// ==== iOS/Safari TTS unlock + vozes + FILA ====
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let TTS_READY = false;
function primeTTS() {
  if (TTS_READY || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); } catch {}
  TTS_READY = true;
}
window.addEventListener('touchstart', primeTTS, { once: true });
window.addEventListener('click',      primeTTS, { once: true });

let VOICES = [];
function refreshVoices(){ VOICES = speechSynthesis.getVoices(); }
speechSynthesis.addEventListener('voiceschanged', refreshVoices);
refreshVoices();

function awaitVoices(timeoutMs = 1500) {
  return new Promise(resolve => {
    const start = Date.now();
    (function loop() {
      if (VOICES.length) return resolve(VOICES);
      if (Date.now() - start > timeoutMs) return resolve(VOICES);
      try { speechSynthesis.getVoices(); } catch {}
      setTimeout(loop, 100);
    })();
  });
}

// ==== Fila de leitura ====
const queue = [];
let speaking = false;

function speakQueued(text, opts={}) {
  if (!text) return;
  queue.push({ text, opts });
  processQueue();
}

async function processQueue() {
  if (speaking || !queue.length) return;
  speaking = true;

  const { text, opts } = queue.shift();
  primeTTS();
  if (IS_IOS) { try { speechSynthesis.cancel(); } catch {} }

  await awaitVoices();

  const u = new SpeechSynthesisUtterance(text);
  u.lang  = opts.lang  || 'pt-BR';
  u.rate  = opts.rate  ?? parseFloat(document.getElementById('rate')?.value || 1);
  u.pitch = opts.pitch ?? parseFloat(document.getElementById('pitch')?.value || 1);

  const selName = document.getElementById('voice')?.value;
  let chosen = VOICES.find(v => v.name === selName);
  if (!chosen) {
    const br = VOICES.find(v => v.lang?.toLowerCase().startsWith('pt-br'));
    if (br) chosen = br;
  }
  if (chosen) { u.voice = chosen; u.lang = chosen.lang || u.lang; }

  u.onend = u.onerror = () => { speaking = false; processQueue(); };
  setTimeout(() => speechSynthesis.speak(u), 0);
}

function stopSpeech() {
  try { speechSynthesis.cancel(); } catch {}
  queue.length = 0;
  speaking = false;
}

// ======== Controles de voz ========
const voiceSel = document.getElementById('voice');
const rate = document.getElementById('rate');
const pitch = document.getElementById('pitch');

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSel.innerHTML = '';
  const sorted = voices.sort((a,b)=>{
    const aBR = /pt-BR|pt_BR|Portuguese \(Brazil\)/i.test(a.lang + ' ' + a.name);
    const bBR = /pt-BR|pt_BR|Portuguese \(Brazil\)/i.test(b.lang + ' ' + b.name);
    if (aBR && !bBR) return -1; if (!aBR && bBR) return 1; return a.lang.localeCompare(b.lang);
  });
  sorted.forEach((v)=>{
    const opt = document.createElement('option');
    opt.value = v.name; opt.textContent = `${v.name} — ${v.lang}`;
    voiceSel.appendChild(opt);
  });
  const idx = [...voiceSel.options].findIndex(o=>/pt-BR|Portuguese \(Brazil\)/i.test(o.textContent));
  if (idx>=0) voiceSel.selectedIndex = idx;
}
window.speechSynthesis.onvoiceschanged = loadVoices;
if (speechSynthesis.getVoices().length) loadVoices();

document.getElementById('stopAll').onclick = stopSpeech;

// ======== Leitor ========
const ttsText  = document.getElementById('ttsText');
const ttsPlay  = document.getElementById('ttsPlay');
const ttsStop  = document.getElementById('ttsStop');
const ttsClear = document.getElementById('ttsClear');

function playText() {
  const raw = (ttsText.value || '').trim();
  if (!raw) return;

  const parts = raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  let i = 0;
  (function step(){
    if (i >= parts.length) return;
    speakQueued(parts[i], { lang:'pt-BR' });
    i++; setTimeout(step, 600);
  })();
}
function stopAllSpeech() { stopSpeech(); }

ttsPlay .addEventListener('click', playText);
ttsStop .addEventListener('click', stopAllSpeech);
ttsClear.addEventListener('click', ()=>{ ttsText.value=''; stopAllSpeech(); });
