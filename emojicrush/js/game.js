// === Temas ===
const THEMES = {
  "Frutas": ["🍎","🍌","🍇","🍓","🍍","🍊","🍒"],
  "Carinhas": ["😀","😁","😂","😊","😍","😜","😎","😭"],
  "Carinhas de gato": ["😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  "Animais": ["🐶","🐱","🦊","🐻","🐼","🐨","🐯","🦁","🐷","🐸"]
};
const DEFAULT_THEME = "Frutas";

// === Config ===
const SIZE = 8;
const BASE_POINTS_PER_TILE = 10;
const HINT_IDLE_MS = 30000;   // 30s parado -> mostrar dica
const HINT_PULSE_MS = 4000;   // quanto tempo a dica pulsa
const HINT_TOGGLE_MS = 500;   // intervalo do pisca

// === Estado ===
let currentTheme = localStorage.getItem('emojicrush_theme') || DEFAULT_THEME;
let board = [];          // board[y][x] => emoji | null
let cells = [];          // cells[y][x] => elemento DOM
let selected = null;     // {x,y, el}
let dragStart = null;    // {x,y, clientX, clientY}
let busy = false;        // bloqueia interação durante resolução
let score = 0;

// ===== HUD / Pontuação =====
const scoreEl = () => document.getElementById('score');
function addScore(points) {
  score += points;
  const el = scoreEl();
  if (!el) return;
  el.textContent = score;
  el.classList.remove('score-bump');
  void el.offsetWidth; // reinicia animação
  el.classList.add('score-bump');
}

// ===== Som =====
let swapSound, matchSound;
function getSwapSound() {
  if (!swapSound) {
    swapSound = document.getElementById('swap-sound') || new Audio('./sounds/pop.mp3');
    swapSound.volume = 0.6;
  }
  return swapSound;
}
function getMatchSound() {
  if (!matchSound) {
    matchSound = document.getElementById('match-sound') || new Audio('./sounds/match.mp3');
    matchSound.volume = 0.7;
  }
  return matchSound;
}

// “Priming” para iOS (desbloqueia o áudio no primeiro gesto)
function primeAudio() {
  const s1 = getSwapSound();
  const s2 = getMatchSound();
  try {
    s1.volume = 0; s1.play().then(() => { s1.pause(); s1.currentTime = 0; s1.volume = 0.6; }).catch(()=>{});
    s2.volume = 0; s2.play().then(() => { s2.pause(); s2.currentTime = 0; s2.volume = 0.7; }).catch(()=>{});
  } catch {}
  window.removeEventListener('pointerdown', primeAudio);
  window.removeEventListener('touchstart', primeAudio);
  window.removeEventListener('click', primeAudio);
}
window.addEventListener('pointerdown', primeAudio, { once: true });
window.addEventListener('touchstart', primeAudio, { once: true });
window.addEventListener('click', primeAudio, { once: true });

function playSwapSound()  { const a = getSwapSound();  a.currentTime = 0; a.play().catch(()=>{}); }
function playMatchSound() { const a = getMatchSound(); a.currentTime = 0; a.play().catch(()=>{}); }

// ===== Util =====
const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const emojiSet = () => THEMES[currentTheme] || THEMES[DEFAULT_THEME];
const randomEmoji = () => {
  const set = emojiSet();
  return set[Math.floor(Math.random() * set.length)];
};
function isAdjacent(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1; }
function setBusy(on) {
  busy = on;
  const b = document.getElementById('board');
  if (b) b.classList.toggle('busy', on);
}

function swapModel(a, b) {
  const tmp = board[a.y][a.x];
  board[a.y][a.x] = board[b.y][b.x];
  board[b.y][b.x] = tmp;
}

function renderSwap(a, b) {
  const ea = cells[a.y][a.x], eb = cells[b.y][b.x];
  const tmpTxt = ea.textContent; ea.textContent = eb.textContent; eb.textContent = tmpTxt;
  ea.classList.add('flash'); eb.classList.add('flash'); playSwapSound();
  setTimeout(() => { ea.classList.remove('flash'); eb.classList.remove('flash'); }, 250);
}

function clearSelection() {
  if (selected?.el) selected.el.classList.remove('selected');
  selected = null;
}

// ===== Match-3 =====
function findMatches() {
  const toClear = new Set();

  // Linhas
  for (let y = 0; y < SIZE; y++) {
    let run = 1;
    for (let x = 1; x <= SIZE; x++) {
      const cur = x < SIZE ? board[y][x] : null;
      const prev = board[y][x - 1];
      if (cur === prev && cur !== null) {
        run++;
      } else {
        if (prev !== null && run >= 3) {
          for (let k = x - run; k < x; k++) toClear.add(`${k},${y}`);
        }
        run = 1;
      }
    }
  }

  // Colunas
  for (let x = 0; x < SIZE; x++) {
    let run = 1;
    for (let y = 1; y <= SIZE; y++) {
      const cur = y < SIZE ? board[y][x] : null;
      const prev = board[y - 1][x];
      if (cur === prev && cur !== null) {
        run++;
      } else {
        if (prev !== null && run >= 3) {
          for (let k = y - run; k < y; k++) toClear.add(`${x},${k}`);
        }
        run = 1;
      }
    }
  }

  return toClear;
}

function markMatches(toClear) {
  toClear.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    cells[y][x].classList.add('match');
  });
}

function clearMatches(toClear) {
  playMatchSound();
  return new Promise(resolve => {
    // anima desaparecer
    toClear.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      cells[y][x].classList.add('vanish');
    });
    setTimeout(() => {
      toClear.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        board[y][x] = null;
        const cell = cells[y][x];
        cell.textContent = '';
        cell.classList.remove('match', 'vanish');
      });
      resolve();
    }, 180);
  });
}

function applyGravity() {
  // compacta não-nulos para baixo em cada coluna
  for (let x = 0; x < SIZE; x++) {
    let write = SIZE - 1;
    for (let y = SIZE - 1; y >= 0; y--) {
      if (board[y][x] !== null) {
        const val = board[y][x];
        if (y !== write) {
          board[write][x] = val;
          board[y][x] = null;
        }
        write--;
      }
    }
  }
  // Atualiza DOM
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      cells[y][x].textContent = board[y][x] || '';
    }
  }
}

function refill() {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === null) {
        const e = randomEmoji();
        board[y][x] = e;
        cells[y][x].textContent = e;
      }
    }
  }
}

async function resolveBoardCascade() {
  let chain = 1;
  while (true) {
    const matches = findMatches();
    const count = matches.size;
    if (count === 0) break;

    // pontuação: peças × base × multiplicador de cascata
    addScore(count * BASE_POINTS_PER_TILE * chain);

    markMatches(matches);
    await clearMatches(matches);
    applyGravity();
    refill();

    chain++;
    await new Promise(r => setTimeout(r, 60)); // respiro visual
  }
}

// ===== Dica automática (idle) =====
let hintIdleTimer = null;
let hintPulseTimer = null;
let hintPulseInterval = null;
let hintPair = null; // {a:{x,y}, b:{x,y}}

function resetIdleHintTimer() {
  stopHintPulse();
  if (hintIdleTimer) clearTimeout(hintIdleTimer);
  hintIdleTimer = setTimeout(triggerHint, HINT_IDLE_MS);
}

function triggerHint() {
  // Não mostra dica se estiver resolvendo, se há seleção do usuário,
  // ou se o tabuleiro está em transição
  if (busy || selected) {
    resetIdleHintTimer();
    return;
  }
  const pair = findHintMove();
  if (!pair) {
    // Nenhuma jogada possível encontrada (situação rara). Apenas reagenda.
    resetIdleHintTimer();
    return;
  }
  hintPair = pair;
  startHintPulse(pair);
}

function findHintMove() {
  // Procura um par adjacente cuja troca gere matches
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // direita
      if (x + 1 < SIZE) {
        const a = { x, y }, b = { x: x + 1, y };
        if (wouldMatchAfterSwap(a, b)) return { a, b };
      }
      // abaixo
      if (y + 1 < SIZE) {
        const a = { x, y }, b = { x, y: y + 1 };
        if (wouldMatchAfterSwap(a, b)) return { a, b };
      }
    }
  }
  return null;
}

function wouldMatchAfterSwap(a, b) {
  // simula swap no modelo, verifica matches, reverte
  const va = board[a.y][a.x];
  const vb = board[b.y][b.x];
  board[a.y][a.x] = vb;
  board[b.y][b.x] = va;
  const has = findMatches().size > 0;
  // reverte
  board[a.y][a.x] = va;
  board[b.y][b.x] = vb;
  return has;
}

function startHintPulse(pair) {
  const ea = cells[pair.a.y][pair.a.x];
  const eb = cells[pair.b.y][pair.b.x];
  let on = false;

  // Pisca a classe .selected para aproveitar o estilo existente
  hintPulseInterval = setInterval(() => {
    on = !on;
    if (on) {
      ea.classList.add('selected');
      eb.classList.add('selected');
    } else {
      ea.classList.remove('selected');
      eb.classList.remove('selected');
    }
  }, HINT_TOGGLE_MS);

  hintPulseTimer = setTimeout(() => {
    stopHintPulse();
    resetIdleHintTimer(); // reagenda próxima dica
  }, HINT_PULSE_MS);
}

function stopHintPulse() {
  if (hintPulseInterval) { clearInterval(hintPulseInterval); hintPulseInterval = null; }
  if (hintPulseTimer) { clearTimeout(hintPulseTimer); hintPulseTimer = null; }
  if (hintPair) {
    const ea = cells[hintPair.a.y]?.[hintPair.a.x];
    const eb = cells[hintPair.b.y]?.[hintPair.b.x];
    ea && ea.classList.remove('selected');
    eb && eb.classList.remove('selected');
    hintPair = null;
  }
}

// ===== Interação =====
function chooseCell(x, y) {
  if (busy) return;
  stopHintPulse();          // qualquer ação do usuário cancela a dica
  resetIdleHintTimer();     // reinicia contagem de inatividade

  const el = cells[y][x];
  if (!selected) {
    selected = { x, y, el };
    el.classList.add('selected');
    return;
  }
  const other = { x, y, el };
  if (selected.x === x && selected.y === y) { clearSelection(); return; }
  if (!isAdjacent(selected, other)) {
    selected.el.classList.remove('selected');
    selected = other; selected.el.classList.add('selected'); return;
  }
  // adjacente -> tenta swap com validação
  selected.el.classList.remove('selected');
  const a = selected; const b = other; selected = null;
  swapAndResolve(a, b);
}

function onPointerDown(e, x, y) {
  if (busy) return;
  stopHintPulse();
  resetIdleHintTimer();

  const touch = e.touches?.[0] || e;
  dragStart = { x, y, clientX: touch.clientX, clientY: touch.clientY };
  if (!selected) {
    selected = { x, y, el: cells[y][x] };
    selected.el.classList.add('selected');
  }
}

function onPointerUp(e) {
  if (busy) return;
  stopHintPulse();
  resetIdleHintTimer();

  if (!dragStart) return;
  const touch = e.changedTouches?.[0] || e;
  const dx = touch.clientX - dragStart.clientX;
  const dy = touch.clientY - dragStart.clientY;

  const TH = 12; // px
  let nx = dragStart.x, ny = dragStart.y;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TH) {
    nx = dragStart.x + (dx > 0 ? 1 : -1);
  } else if (Math.abs(dy) > TH) {
    ny = dragStart.y + (dy > 0 ? 1 : -1);
  } else {
    chooseCell(dragStart.x, dragStart.y);
    dragStart = null;
    return;
  }

  if (inBounds(nx, ny)) {
    const a = { x: dragStart.x, y: dragStart.y, el: cells[dragStart.y][dragStart.x] };
    const b = { x: nx, y: ny, el: cells[ny][nx] };
    if (selected?.el) selected.el.classList.remove('selected');
    selected = null;
    swapAndResolve(a, b);
  } else {
    clearSelection();
  }
  dragStart = null;
}

// ===== Board =====
function createBoard() {
  board = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => randomEmoji())
  );
}

function renderBoard() {
  const container = document.getElementById('board');
  if (!container) return;

  container.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  container.innerHTML = '';
  cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = board[y][x];
      cell.dataset.x = x; cell.dataset.y = y;

      cell.addEventListener('click', () => chooseCell(x, y));
      cell.addEventListener('pointerdown', (e) => onPointerDown(e, x, y));
      cell.addEventListener('pointerup', onPointerUp);
      cell.addEventListener('touchstart', (e) => onPointerDown(e, x, y), { passive: true });
      cell.addEventListener('touchend', onPointerUp, { passive: true });
      cell.addEventListener('mousedown', (e) => onPointerDown(e, x, y));
      cell.addEventListener('mouseup', onPointerUp);

      container.appendChild(cell);
      cells[y][x] = cell;
    }
  }

  // sempre que o board é renderizado, reagendar dica
  resetIdleHintTimer();
}

function shuffleIfHasInitialMatches(maxTries = 50) {
  for (let i = 0; i < maxTries; i++) {
    if (findMatches().size === 0) return;
    // embaralha superficialmente
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const rx = Math.floor(Math.random() * SIZE);
        const ry = Math.floor(Math.random() * SIZE);
        const tmp = board[y][x]; board[y][x] = board[ry][rx]; board[ry][rx] = tmp;
      }
    }
  }
}

// ===== Tema: UI =====
function populateThemeSelect() {
  const sel = document.getElementById('themeSelect');
  if (!sel) return;
  sel.innerHTML = '';
  Object.keys(THEMES).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
  sel.value = currentTheme;
  sel.addEventListener('change', () => {
    const next = sel.value;
    if (!THEMES[next]) return;
    currentTheme = next;
    localStorage.setItem('emojicrush_theme', currentTheme);
    // reconstrói o board mantendo pontuação
    createBoard();
    shuffleIfHasInitialMatches();
    renderBoard(); // também reinicia o timer de dica
  });
}

// ===== Service Worker (escopo desta pasta) =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
}

// ===== Fluxo de jogada / resolução =====
function swapAndResolve(a, b) {
  stopHintPulse();      // ação do usuário cancela dica atual
  resetIdleHintTimer(); // reinicia contagem

  setBusy(true);
  // 1) swap
  swapModel(a, b);
  renderSwap(a, b);

  // 2) valida
  const hasMatch = findMatches().size > 0;
  if (!hasMatch) {
    // reverte
    setTimeout(() => {
      swapModel(a, b);
      renderSwap(a, b);
      setBusy(false);
      resetIdleHintTimer(); // volta a contar
    }, 140);
    return;
  }

  // 3) resolve cascata
  (async () => {
    await resolveBoardCascade();
    setBusy(false);
    resetIdleHintTimer(); // volta a contar após finalizar
  })();
}

// ===== Init =====
(function init() {
  populateThemeSelect();
  createBoard();
  shuffleIfHasInitialMatches();
  renderBoard();
})();
