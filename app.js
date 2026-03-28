/**
 * SmallTalk Village — AR Vocabulary Explorer
 * Core Application Logic
 *
 * Supports two modes:
 *  1. Custom Model Mode  — loads Teachable Machine TF.js model from /model/
 *  2. Demo Mode          — uses COCO-SSD pre-trained object detector
 */

// ─── Vocabulary Database ────────────────────────────────────────────────────
// Maps object class names → { phonetic, example sentence, color }
const VOCAB_DB = {
  // Teachable Machine custom classes (lowercase match)
  cup:       { phonetic: '/kʌp/',      example: 'Could I have a cup of coffee?',      color: '#FF6B6B' },
  desk:      { phonetic: '/dɛsk/',     example: 'Please leave it on the desk.',        color: '#4ECDC4' },
  chair:     { phonetic: '/tʃɛr/',     example: 'Have a seat in that chair.',          color: '#45B7D1' },
  book:      { phonetic: '/bʊk/',      example: 'I read a great book last night.',     color: '#96CEB4' },
  pen:       { phonetic: '/pɛn/',      example: 'May I borrow your pen?',              color: '#FFEAA7' },
  phone:     { phonetic: '/foʊn/',     example: 'My phone is running low on battery.', color: '#DDA0DD' },
  laptop:    { phonetic: '/ˈlæptɒp/', example: 'I need my laptop for the meeting.',   color: '#98D8C8' },
  bag:       { phonetic: '/bæɡ/',      example: 'Could you watch my bag for a moment?', color: '#F7DC6F' },
  bottle:    { phonetic: '/ˈbɒt.əl/', example: 'Don\'t forget your water bottle.',    color: '#85C1E9' },
  keyboard:  { phonetic: '/ˈkiː.bɔːd/', example: 'The keyboard feels comfortable.',  color: '#C39BD3' },
  // COCO-SSD class names
  person:    { phonetic: '/ˈpɜːr.sən/', example: 'That person looks friendly.',       color: '#FF8A65' },
  cell_phone:{ phonetic: '/sɛl foʊn/', example: 'My cell phone has great battery life.', color: '#DDA0DD' },
  laptop_computer: { phonetic: '/ˈlæptɒp/', example: 'She is working on her laptop.', color: '#98D8C8' },
  mouse:     { phonetic: '/maʊs/',     example: 'Click the mouse to select it.',       color: '#80CBC4' },
  keyboard_item: { phonetic: '/ˈkiː.bɔːd/', example: 'Type on the keyboard.',        color: '#C39BD3' },
  book_item: { phonetic: '/bʊk/',      example: 'This is a fascinating book.',         color: '#96CEB4' },
  chair_item:{ phonetic: '/tʃɛr/',     example: 'Please pull up a chair.',             color: '#45B7D1' },
  bottle_item:{ phonetic: '/ˈbɒt.əl/', example: 'The bottle is almost empty.',        color: '#85C1E9' },
  cup_item:  { phonetic: '/kʌp/',      example: 'This cup is too hot to hold.',        color: '#FF6B6B' },
  backpack:  { phonetic: '/ˈbæk.pæk/', example: 'I carry my books in a backpack.',   color: '#F7DC6F' },
  tv:        { phonetic: '/ˌtiːˈviː/', example: 'Let\'s watch something on TV.',      color: '#AED6F1' },
  clock:     { phonetic: '/klɒk/',     example: 'Check the clock on the wall.',        color: '#A9DFBF' },
  scissors:  { phonetic: '/ˈsɪz.əz/', example: 'Hand me the scissors, please.',       color: '#F1948A' },
};

function getVocab(label) {
  const key = label.toLowerCase().replace(/ /g, '_');
  return VOCAB_DB[key] || VOCAB_DB[label.toLowerCase()] || {
    phonetic: '',
    example: `That is a ${label.toLowerCase()}.`,
    color: '#A8A8A8',
  };
}

// ─── Speech ──────────────────────────────────────────────────────────────────
const speech = {
  synth: window.speechSynthesis,
  voice: null, // will be set after voices load
};

function initSpeech() {
  const pickVoice = () => {
    const voices = speech.synth.getVoices();
    // Prefer en-US voices; Samantha is the default iOS voice
    speech.voice =
      voices.find(v => v.name === 'Samantha') ||
      voices.find(v => v.lang === 'en-US' && v.localService) ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] || null;
  };
  pickVoice();
  // voices load asynchronously on some browsers
  if (speech.synth.onvoiceschanged !== undefined) {
    speech.synth.onvoiceschanged = pickVoice;
  }
}

/**
 * Speak text aloud.
 * @param {string} text  - Text to speak
 * @param {number} rate  - Speech rate (0.5 – 1.5). Default 0.85 (slightly slow for learners)
 */
function speak(text, rate = 0.85) {
  if (!speech.synth) return;
  speech.synth.cancel(); // stop any current speech
  const utt = new SpeechSynthesisUtterance(text);
  utt.voice  = speech.voice;
  utt.lang   = 'en-US';
  utt.rate   = rate;
  utt.pitch  = 1.0;
  utt.volume = 1.0;
  speech.synth.speak(utt);
}

// ─── 3D Model Map ─────────────────────────────────────────────────────────────
// Each entry: { glb: URL for 3D viewer, usdz: URL for iOS AR Quick Look }
// GLB  = shown in model-viewer (works everywhere)
// USDZ = used by iOS AR Quick Look (native ARKit placement)
//
// Free GLB sources:  https://poly.pizza  |  https://sketchfab.com/features/free-3d-models
// GLB → USDZ:        Reality Converter (free Mac app from Apple)
// Once you download models, put them in assets/models/ and update paths below.
const MODEL_MAP = {
  // --- Working demo models (publicly hosted) ---
  bottle:   {
    glb:  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
    usdz: 'https://developer.apple.com/augmented-reality/quick-look/models/teapot/teapot.usdz',
  },
  // --- Placeholders: replace with your own models ---
  // Download from poly.pizza, put in assets/models/, update path
  cup:      { glb: null, usdz: 'https://developer.apple.com/augmented-reality/quick-look/models/teapot/teapot.usdz' },
  chair:    { glb: null, usdz: null },
  desk:     { glb: null, usdz: null },
  laptop:   { glb: null, usdz: null },
  book:     { glb: null, usdz: null },
  pen:      { glb: null, usdz: null },
  phone:    { glb: null, usdz: null },
  bag:      { glb: null, usdz: null },
  keyboard: { glb: null, usdz: null },
  backpack: { glb: null, usdz: null },
  tv:       { glb: null, usdz: 'https://developer.apple.com/augmented-reality/quick-look/models/retrotv/retrotv.usdz' },
  clock:    { glb: null, usdz: null },
  scissors: { glb: null, usdz: null },
  mouse:    { glb: null, usdz: null },
};

// ─── 3D Viewer ────────────────────────────────────────────────────────────────
let viewerCurrentItem = null;

function open3DViewer(item) {
  viewerCurrentItem = item;
  const vocab   = getVocab(item.key);
  const models  = MODEL_MAP[item.key] || {};

  $('mv-word').textContent     = item.label.toUpperCase();
  $('mv-word').style.color     = vocab.color;
  $('mv-phonetic').textContent = vocab.phonetic;
  $('mv-example').textContent  = `"${vocab.example}"`;

  const mv = document.getElementById('main-model-viewer');

  if (models.glb) {
    mv.setAttribute('src', models.glb);
    $('mv-no-model-hint').classList.add('hidden');
  } else {
    mv.removeAttribute('src');
    $('mv-no-model-hint').classList.remove('hidden');
  }

  if (models.usdz) {
    mv.setAttribute('ios-src', models.usdz);
    $('mv-ar-btn').classList.remove('hidden');
  } else {
    mv.removeAttribute('ios-src');
    // On non-iOS or no USDZ, hide the AR button
    $('mv-ar-btn').classList.add('hidden');
  }

  $('object-picker-panel').classList.add('hidden');
  $('model-viewer-panel').classList.remove('hidden');
}

function close3DViewer() {
  $('model-viewer-panel').classList.add('hidden');
  viewerCurrentItem = null;
  const mv = document.getElementById('main-model-viewer');
  mv.removeAttribute('src');
}

// ─── Web Audio Feedback ───────────────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone(freq, startTime, duration, vol = 0.22, type = 'sine') {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime); osc.stop(startTime + duration + 0.02);
  } catch { /* audio not available */ }
}

function playCorrectSound() {
  const t = getAudioCtx().currentTime;
  playTone(523.25, t,       0.12); // C5
  playTone(659.25, t + 0.1, 0.12); // E5
  playTone(783.99, t + 0.2, 0.25); // G5
}

function playWrongSound() {
  const t = getAudioCtx().currentTime;
  playTone(311.13, t,        0.18, 0.2, 'square');
  playTone(233.08, t + 0.15, 0.28, 0.2, 'square');
}

function playDiscoverSound() {
  const t = getAudioCtx().currentTime;
  [523, 587, 659, 784].forEach((f, i) => playTone(f, t + i * 0.07, 0.1, 0.18));
}

function playSuccessSound() {
  const t = getAudioCtx().currentTime;
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, t + i * 0.1, 0.15));
}

// ─── Toast Notifications ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 2500, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast show toast-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── Quiz System ──────────────────────────────────────────────────────────────
const quizState = {
  active: false,
  questions: [],
  currentQ: 0,
  score: 0,
  totalQ: 5,
  answered: false,
};

function getQuizableWords() {
  const seen = new Set(
    [...state.learnedWords.keys()].map(k => k.toLowerCase())
  );
  return PLACEABLE_OBJECTS.filter(
    item => seen.has(item.key) || seen.has(item.label.toLowerCase())
  );
}

function updateQuizButton() {
  const btn = document.getElementById('btn-quiz');
  if (!btn) return;
  const n = getQuizableWords().length;
  if (n >= 3) {
    btn.classList.remove('hidden');
    btn.querySelector('span:last-child').textContent = `Quiz (${n})`;
  }
}

function startQuiz() {
  const quizable = getQuizableWords();
  if (quizable.length < 3) {
    showToast('Scan at least 3 objects first! 📷', 2200, 'warn');
    return;
  }
  quizState.active   = true;
  quizState.score    = 0;
  quizState.currentQ = 0;
  quizState.totalQ   = Math.min(5, quizable.length);

  const shuffled = [...quizable].sort(() => Math.random() - 0.5);
  quizState.questions = shuffled.slice(0, quizState.totalQ).map(item => {
    const distractors = PLACEABLE_OBJECTS
      .filter(p => p.key !== item.key)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return {
      correct: item,
      choices: [item, ...distractors].sort(() => Math.random() - 0.5),
    };
  });

  document.getElementById('quiz-question-area').classList.remove('hidden');
  document.getElementById('quiz-result-area').classList.add('hidden');
  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-panel').classList.remove('hidden');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.currentQ];
  quizState.answered = false;

  document.getElementById('quiz-progress').textContent =
    `${quizState.currentQ + 1} / ${quizState.totalQ}`;
  document.getElementById('quiz-score').textContent = `Score: ${quizState.score}`;
  document.getElementById('quiz-emoji').textContent = q.correct.emoji;
  document.getElementById('quiz-phonetic-hint').textContent =
    getVocab(q.correct.key).phonetic;
  document.getElementById('quiz-feedback').classList.add('hidden');

  const grid = document.getElementById('quiz-choices');
  grid.innerHTML = '';
  q.choices.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice-btn';
    btn.textContent = item.label.toUpperCase();
    btn.dataset.key = item.key;
    btn.addEventListener('click', () => handleQuizAnswer(item, btn));
    grid.appendChild(btn);
  });
}

function handleQuizAnswer(selected, btn) {
  if (quizState.answered) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.currentQ];
  const isCorrect = selected.key === q.correct.key;

  document.querySelectorAll('.quiz-choice-btn').forEach(b => {
    if (b.dataset.key === q.correct.key) b.classList.add('quiz-correct');
    else if (b === btn && !isCorrect)     b.classList.add('quiz-wrong');
    b.disabled = true;
  });

  const fb = document.getElementById('quiz-feedback');
  if (isCorrect) {
    quizState.score++;
    playCorrectSound();
    speak(q.correct.label, 0.85);
    fb.textContent = '✓ Correct!';
    fb.className = 'quiz-feedback quiz-fb-correct';
  } else {
    playWrongSound();
    speak(q.correct.label, 0.85);
    fb.textContent = `✗  It's "${q.correct.label}"`;
    fb.className = 'quiz-feedback quiz-fb-wrong';
  }
  fb.classList.remove('hidden');

  setTimeout(() => {
    quizState.currentQ++;
    if (quizState.currentQ >= quizState.totalQ) showQuizResult();
    else { fb.classList.add('hidden'); renderQuizQuestion(); }
  }, 2000);
}

function showQuizResult() {
  const pct   = Math.round(quizState.score / quizState.totalQ * 100);
  const stars = pct >= 80 ? '🌟🌟🌟' : pct >= 60 ? '⭐⭐' : '⭐';
  const msg   = pct >= 80 ? 'Excellent! Keep it up!'
              : pct >= 60 ? 'Good job! Keep practicing.'
              : 'Keep scanning and learning!';

  document.getElementById('quiz-question-area').classList.add('hidden');
  document.getElementById('quiz-result-area').classList.remove('hidden');
  document.getElementById('quiz-result-stars').textContent  = stars;
  document.getElementById('quiz-result-score').textContent  = `${quizState.score} / ${quizState.totalQ}`;
  document.getElementById('quiz-result-pct').textContent    = `${pct}%`;
  document.getElementById('quiz-result-msg').textContent    = msg;

  if (pct >= 80) playSuccessSound();
}

function closeQuiz() {
  document.getElementById('quiz-panel').classList.add('hidden');
  quizState.active = false;
}

// ─── AR Placement: Placeable Objects Catalogue ───────────────────────────────
const PLACEABLE_OBJECTS = [
  { key: 'cup',      emoji: '☕', label: 'Cup' },
  { key: 'chair',    emoji: '🪑', label: 'Chair' },
  { key: 'desk',     emoji: '🗂️', label: 'Desk' },
  { key: 'laptop',   emoji: '💻', label: 'Laptop' },
  { key: 'book',     emoji: '📖', label: 'Book' },
  { key: 'pen',      emoji: '✏️', label: 'Pen' },
  { key: 'phone',    emoji: '📱', label: 'Phone' },
  { key: 'bag',      emoji: '👜', label: 'Bag' },
  { key: 'bottle',   emoji: '🍶', label: 'Bottle' },
  { key: 'keyboard', emoji: '⌨️', label: 'Keyboard' },
  { key: 'backpack', emoji: '🎒', label: 'Backpack' },
  { key: 'tv',       emoji: '📺', label: 'TV' },
  { key: 'clock',    emoji: '⏰', label: 'Clock' },
  { key: 'scissors', emoji: '✂️', label: 'Scissors' },
  { key: 'mouse',    emoji: '🖱️', label: 'Mouse' },
];

// ─── Three.js AR Placement Scene ─────────────────────────────────────────────
const arThree = {
  renderer: null,
  scene: null,
  camera: null,
  clock: null,
  placed: [],        // array of placed object data
  ghostSprite: null, // preview sprite following finger before placement
  selectedItem: null,
};

// Placement interaction state
const placementState = {
  active: false,     // currently in "tap to place" mode
  ghostX: 0,
  ghostY: 0,
};

function initArThree() {
  const threeCanvas = document.getElementById('ar-three-canvas');
  if (!window.THREE || !threeCanvas) return;

  arThree.renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
  arThree.renderer.setPixelRatio(window.devicePixelRatio);
  arThree.renderer.setSize(window.innerWidth, window.innerHeight);

  arThree.scene = new THREE.Scene();
  arThree.clock = new THREE.Clock();

  const w = window.innerWidth, h = window.innerHeight;
  arThree.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100);
  arThree.camera.position.z = 10;

  window.addEventListener('resize', () => {
    const w2 = window.innerWidth, h2 = window.innerHeight;
    arThree.renderer.setSize(w2, h2);
    arThree.camera.left   = -w2 / 2;
    arThree.camera.right  =  w2 / 2;
    arThree.camera.top    =  h2 / 2;
    arThree.camera.bottom = -h2 / 2;
    arThree.camera.updateProjectionMatrix();
  });
}

/**
 * Build a canvas texture showing emoji + word + phonetic in a card.
 * @param {string} emoji
 * @param {string} label
 * @param {string} phonetic
 * @param {string} color  hex color
 * @param {number} alpha  0–1, used for ghost preview
 */
function makeObjectCardTexture(emoji, label, phonetic, color, alpha = 1) {
  const W = 220, H = 220;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const c2 = c.getContext('2d');

  // Dark card background
  c2.globalAlpha = alpha * 0.88;
  c2.fillStyle = '#0f0f1a';
  roundedRect(c2, 12, 12, W - 24, H - 24, 22);
  c2.fill();

  // Glowing border
  c2.globalAlpha = alpha;
  c2.strokeStyle = color;
  c2.lineWidth = 3;
  c2.shadowColor = color;
  c2.shadowBlur = 14;
  roundedRect(c2, 12, 12, W - 24, H - 24, 22);
  c2.stroke();
  c2.shadowBlur = 0;

  // Emoji
  c2.font = '72px serif';
  c2.textAlign = 'center';
  c2.textBaseline = 'alphabetic';
  c2.fillText(emoji, W / 2, 108);

  // Word
  c2.font = 'bold 26px Arial, sans-serif';
  c2.fillStyle = color;
  c2.fillText(label.toUpperCase(), W / 2, 148);

  // Phonetic
  c2.font = 'italic 17px Arial, sans-serif';
  c2.fillStyle = 'rgba(255,255,255,0.55)';
  c2.fillText(phonetic, W / 2, 172);

  return new THREE.CanvasTexture(c);
}

function roundedRect(ctx2d, x, y, w, h, r) {
  ctx2d.beginPath();
  ctx2d.moveTo(x + r, y);
  ctx2d.lineTo(x + w - r, y);
  ctx2d.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx2d.lineTo(x + w, y + h - r);
  ctx2d.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx2d.lineTo(x + r, y + h);
  ctx2d.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx2d.lineTo(x, y + r);
  ctx2d.quadraticCurveTo(x, y, x + r, y);
  ctx2d.closePath();
}

/** Convert screen (x,y) pixels → Three.js ortho world coords */
function screenToWorld(sx, sy) {
  return {
    x:  sx - window.innerWidth  / 2,
    y: -(sy - window.innerHeight / 2),
  };
}

/** Enter "tap to place" mode for the given catalogue item */
function enterPlacementMode(item) {
  placementState.active = true;
  arThree.selectedItem  = item;
  placementState.ghostX = window.innerWidth  / 2;
  placementState.ghostY = window.innerHeight / 2;

  // Show placement hint bar immediately (no Three.js dependency)
  const hint = document.getElementById('placement-hint');
  if (hint) {
    hint.querySelector('.hint-word').textContent = item.label;
    hint.classList.remove('hidden');
  }

  // Create/move the DOM ghost card
  let ghost = document.getElementById('ar-ghost-card');
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.id = 'ar-ghost-card';
    ghost.className = 'ar-placed-card ar-ghost';
    document.getElementById('ar-container').appendChild(ghost);
  }
  const vocab = getVocab(item.key);
  ghost.innerHTML = `
    <span class="placed-emoji">${item.emoji}</span>
    <span class="placed-word" style="color:${vocab.color}">${item.label.toUpperCase()}</span>
    <span class="placed-phonetic">${vocab.phonetic}</span>
    <button class="ghost-place-btn" id="ghost-place-btn">Tap to Place ✓</button>
  `;
  ghost.style.left = `${placementState.ghostX}px`;
  ghost.style.top  = `${placementState.ghostY}px`;
  ghost.classList.remove('hidden');

  // Direct button on ghost: most reliable way to trigger placement
  document.getElementById('ghost-place-btn').addEventListener('click', e => {
    e.stopPropagation();
    const ghost2 = document.getElementById('ar-ghost-card');
    const rect   = ghost2 ? ghost2.getBoundingClientRect() : null;
    const sx = rect ? rect.left + rect.width  / 2 : placementState.ghostX;
    const sy = rect ? rect.top  + rect.height / 2 : placementState.ghostY;
    placeObjectAt(sx, sy);
  });
}

/** Exit placement mode without placing */
function exitPlacementMode() {
  placementState.active = false;
  arThree.selectedItem  = null;

  const hint = document.getElementById('placement-hint');
  if (hint) hint.classList.add('hidden');

  const ghost = document.getElementById('ar-ghost-card');
  if (ghost) ghost.classList.add('hidden');
}

/**
 * Add drag-to-reposition + tap-to-speak to a placed card.
 * Touch/mouse delta < 8px → treat as tap (speak word).
 * Touch/mouse delta ≥ 8px → treat as drag (reposition card).
 */
function makeDraggable(card, item) {
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;
  let dragging = false;
  let moved = false;

  function onStart(cx, cy) {
    startX    = cx;
    startY    = cy;
    startLeft = parseFloat(card.style.left) || 0;
    startTop  = parseFloat(card.style.top)  || 0;
    dragging  = true;
    moved     = false;
    card.classList.add('dragging');
    // Pause float animation while dragging
    card.style.animationPlayState = 'paused';
  }

  function onMove(cx, cy) {
    if (!dragging) return;
    const dx = cx - startX;
    const dy = cy - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    if (moved) {
      card.style.left = `${startLeft + dx}px`;
      card.style.top  = `${startTop  + dy}px`;
    }
  }

  function onEnd(e) {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('dragging');
    card.style.animationPlayState = '';

    if (!moved) {
      // Short tap — speak word (ignore remove-button, handled separately)
      if (!e.target.closest('.placed-remove')) {
        speak(item.label, 0.8);
        card.classList.add('placed-pulse');
        setTimeout(() => card.classList.remove('placed-pulse'), 400);
      }
    }
  }

  // ── Touch events ──
  card.addEventListener('touchstart', e => {
    if (e.target.closest('.placed-remove')) return;
    e.stopPropagation(); // don't bubble to ar-container placement handler
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.stopPropagation();
    onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  card.addEventListener('touchend', e => {
    if (!dragging) return;
    e.stopPropagation();
    onEnd(e);
  }, { passive: true });

  // ── Mouse events (desktop testing) ──
  card.addEventListener('mousedown', e => {
    if (e.target.closest('.placed-remove')) return;
    e.stopPropagation();
    onStart(e.clientX, e.clientY);

    const onMouseMove = ev => onMove(ev.clientX, ev.clientY);
    const onMouseUp   = ev => {
      onEnd(ev);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  });

  // Remove button
  card.querySelector('.placed-remove').addEventListener('click', e => {
    e.stopPropagation();
    card.remove();
    arThree.placed = arThree.placed.filter(o => o.card !== card);
    if (arThree.placed.length === 0) {
      document.getElementById('placed-toolbar').classList.add('hidden');
    }
  });
}

/** Place the selected object at screen position (sx, sy) */
function placeObjectAt(sx, sy) {
  if (!placementState.active || !arThree.selectedItem) return;

  const item  = arThree.selectedItem;
  const vocab = getVocab(item.key);

  // Build a DOM card at the tapped position
  const card = document.createElement('div');
  card.className = 'ar-placed-card ar-placed-card--placed';
  card.style.left = `${sx}px`;
  card.style.top  = `${sy}px`;
  card.innerHTML = `
    <div class="placed-drag-handle">⠿</div>
    <span class="placed-emoji">${item.emoji}</span>
    <span class="placed-word" style="color:${vocab.color}">${item.label.toUpperCase()}</span>
    <span class="placed-phonetic">${vocab.phonetic}</span>
    <button class="placed-remove" title="Remove">✕</button>
  `;

  makeDraggable(card, item);

  document.getElementById('ar-container').appendChild(card);
  arThree.placed.push({ card, item });

  speak(item.label, 0.8);

  document.getElementById('placed-toolbar').classList.remove('hidden');
  exitPlacementMode();
}

/** Remove all placed objects */
function clearAllPlaced() {
  arThree.placed.forEach(o => o.card.remove());
  arThree.placed = [];
  document.getElementById('placed-toolbar').classList.add('hidden');
}

/** Animate Three.js scene (bounding-box canvas only now) */
function tickArThree() {
  // Update DOM ghost card position
  if (placementState.active) {
    const ghost = document.getElementById('ar-ghost-card');
    if (ghost && !ghost.classList.contains('hidden')) {
      ghost.style.left = `${placementState.ghostX}px`;
      ghost.style.top  = `${placementState.ghostY}px`;
    }
  }

  // Render Three.js scene (bounding boxes drawn on ar-canvas separately)
  if (arThree.renderer) {
    arThree.renderer.render(arThree.scene, arThree.camera);
  }
}

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  model: null,
  cocoModel: null,
  mode: 'custom',       // 'custom' | 'coco'
  isRunning: false,
  continuousMode: true,
  autoSpeak: true,      // auto-pronounce when a new word is detected
  lastLabel: null,
  lastConfidence: 0,
  learnedWords: new Map(), // label → count
  frameCount: 0,
  lastFpsTime: Date.now(),
  lastInferenceTime: 0,
  inferenceIntervalMs: 300, // run inference at most ~3 fps to keep phone cool
  animFrameId: null,
  labelDebounceTimer: null,
};

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const video      = $('webcam');
const canvas     = $('ar-canvas');
const ctx        = canvas.getContext('2d');
const labelCard  = $('label-card');
const detectedLabel  = $('detected-label');
const phoneticLabel  = $('phonetic-label');
const exampleSentence = $('example-sentence');
const confidenceText = $('confidence-text');
const ringFill   = $('ring-fill');
const loadingScreen = $('loading-screen');
const loadingFill   = $('loading-fill');
const loadingText   = $('loading-text');
const arContainer   = $('ar-container');
const noModelScreen = $('no-model-screen');
const scanIndicator = $('scan-indicator');
const historyPanel  = $('history-panel');
const historyList   = $('history-list');
const fpsDisplay    = $('fps-display');

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  setLoadingProgress(10, 'Checking model files…');

  const hasCustomModel = await checkCustomModelExists();

  if (hasCustomModel) {
    state.mode = 'custom';
    await loadCustomModel();
  } else {
    // No custom model — fall back to COCO-SSD automatically
    state.mode = 'coco';
    await loadCocoModel();
  }

  setLoadingProgress(70, 'Starting camera…');
  await startCamera();
  setLoadingProgress(90, 'Initialising AR…');
  setupCanvas();
  initArThree();
  setupEventListeners();
  setLoadingProgress(100, 'Ready!');

  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      arContainer.classList.remove('hidden');
      if (state.mode === 'coco') {
        $('model-status').textContent = '🟡 COCO-SSD (80 objects)';
      }
      startLoop();
    }, 500);
  }, 400);
}

// ─── Model Loading ───────────────────────────────────────────────────────────
async function checkCustomModelExists() {
  try {
    const res = await fetch('./model/metadata.json', { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadCustomModel() {
  setLoadingProgress(20, 'Loading Teachable Machine model…');
  try {
    const modelURL  = './model/model.json';
    const metaURL   = './model/metadata.json';
    state.model = await tmImage.load(modelURL, metaURL);
    setLoadingProgress(60, 'Model loaded ✓');
  } catch (err) {
    console.error('Custom model load error:', err);
    showNoModelScreen();
  }
}

async function loadCocoModel() {
  setLoadingProgress(20, 'Loading COCO-SSD model (may take ~30s)…');
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js';
      script.onload  = resolve;
      script.onerror = () => reject(new Error('Failed to load COCO-SSD script'));
      // 30s timeout
      const timer = setTimeout(() => reject(new Error('COCO-SSD script timeout')), 30000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      document.head.appendChild(script);
    });
    state.cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' }); // lite = faster download
    setLoadingProgress(60, 'COCO model loaded ✓');
  } catch (err) {
    console.error('COCO-SSD load error:', err);
    setLoadingProgress(60, '⚠️ Model load failed, AR scan disabled');
    // Continue anyway — AR placement still works without the model
  }
}

// ─── Camera ──────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }, // rear camera on mobile
        width:  { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise(resolve => video.onloadedmetadata = resolve);
    video.play();
  } catch (err) {
    alert('Camera access denied. Please allow camera permissions and reload.');
    console.error(err);
  }
}

function setupCanvas() {
  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
function startLoop() {
  state.isRunning = true;
  loop();
}

async function loop() {
  if (!state.isRunning) return;

  updateFps();
  tickArThree(); // animate 3D emoji sprites every frame

  if (state.continuousMode) {
    await runInference();
  }

  state.animFrameId = requestAnimationFrame(loop);
}

async function runInference() {
  if (!video.readyState || video.readyState < 2) return;

  // Throttle: skip frames to avoid overheating on mobile
  const now = Date.now();
  if (now - state.lastInferenceTime < state.inferenceIntervalMs) return;
  state.lastInferenceTime = now;

  try {
    if (state.mode === 'custom' && state.model) {
      await inferCustom();
    } else if (state.mode === 'coco' && state.cocoModel) {
      await inferCoco();
    }
  } catch (err) {
    console.warn('Inference error:', err);
  }
}

async function inferCustom() {
  const predictions = await state.model.predict(video);
  // predictions: [{ className, probability }]
  const best = predictions.reduce((a, b) => a.probability > b.probability ? a : b);

  if (best.probability > 0.65) {
    displayLabel(best.className, best.probability);
  } else {
    // Low confidence — fade label
    if (best.probability < 0.4) hideLabelCard();
  }
}

async function inferCoco() {
  const predictions = await state.cocoModel.detect(video);
  if (predictions.length === 0) {
    hideLabelCard();
    clearCanvas();
    return;
  }

  const scaleX = canvas.width  / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  clearCanvas();
  predictions.forEach(pred => {
    const [x, y, w, h] = pred.bbox;
    const vocab = getVocab(pred.class);
    drawArBox(x * scaleX, y * scaleY, w * scaleX, h * scaleY, vocab.color);
  });

  // Show best prediction in label card
  const best = predictions[0];
  displayLabel(best.class, best.score);
}

/** Draw a glowing AR-style bounding box with animated corner brackets */
function drawArBox(x, y, w, h, color) {
  const cornerLen = Math.min(w, h) * 0.2;
  const now = Date.now();

  ctx.save();

  // Outer glow
  ctx.shadowColor   = color;
  ctx.shadowBlur    = 18;
  ctx.strokeStyle   = color;
  ctx.lineWidth     = 2;

  // Animated dashed border
  const dashOffset = (now / 40) % 20;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -dashOffset;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Solid corner brackets (no shadow blur for crispness)
  ctx.shadowBlur  = 0;
  ctx.lineWidth   = 3.5;
  ctx.strokeStyle = color;

  const corners = [
    [x,     y,     cornerLen, 0,        0,        cornerLen],  // TL
    [x + w, y,     -cornerLen, 0,       0,        cornerLen],  // TR
    [x,     y + h, cornerLen, 0,        0,        -cornerLen], // BL
    [x + w, y + h, -cornerLen, 0,       0,        -cornerLen], // BR
  ];
  corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx1, cy + dy1);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx2, cy + dy2);
    ctx.stroke();
  });

  // Pulse fill (subtle)
  const alpha = (Math.sin(now / 400) * 0.5 + 0.5) * 0.08;
  ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ─── Label Display ───────────────────────────────────────────────────────────
function displayLabel(label, confidence) {
  const vocab = getVocab(label);
  const pct   = Math.round(confidence * 100);

  // Debounce: only update UI if label changed or confidence jumped significantly
  if (label === state.lastLabel && Math.abs(confidence - state.lastConfidence) < 0.05) return;

  state.lastLabel      = label;
  state.lastConfidence = confidence;

  // Update card content
  detectedLabel.textContent    = label.toUpperCase();
  detectedLabel.style.color    = vocab.color;
  phoneticLabel.textContent    = vocab.phonetic;
  exampleSentence.textContent  = `"${vocab.example}"`;

  // Update confidence ring
  confidenceText.textContent   = `${pct}%`;
  ringFill.style.stroke        = vocab.color;
  ringFill.setAttribute('stroke-dasharray', `${pct}, 100`);

  // Show card with animation
  labelCard.classList.remove('hidden');
  labelCard.classList.add('pop-in');
  setTimeout(() => labelCard.classList.remove('pop-in'), 400);

  // Auto-pronounce the word when it first appears
  if (state.autoSpeak) {
    speak(label);
  }

  // Track learned words
  trackWord(label);
}

function hideLabelCard() {
  if (!labelCard.classList.contains('hidden')) {
    labelCard.classList.add('hidden');
  }
  state.lastLabel = null;
}

// ─── Word Tracking ───────────────────────────────────────────────────────────
function trackWord(label) {
  const prev  = state.learnedWords.get(label) || 0;
  const count = prev + 1;
  state.learnedWords.set(label, count);

  if (prev === 0) {
    // First time discovering this word
    playDiscoverSound();
    showToast(`✨ New word: ${label.toUpperCase()}`, 2200, 'discover');
    updateQuizButton();
  } else if (count === 5) {
    showToast(`⭐ Mastered: ${label.toUpperCase()}!`, 2200, 'master');
  }
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.learnedWords.size === 0) {
    historyList.innerHTML = '<p class="empty-hint">No words learned yet. Start scanning!</p>';
    return;
  }
  const sorted = [...state.learnedWords.entries()].sort((a, b) => b[1] - a[1]);
  sorted.forEach(([label, count]) => {
    const vocab = getVocab(label);
    const item  = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-dot" style="background:${vocab.color}"></div>
      <div class="history-info">
        <span class="history-word">${label}</span>
        <span class="history-phonetic">${vocab.phonetic}</span>
      </div>
      <button class="btn-speak-history" data-word="${label}" title="Pronounce">🔊</button>
      <span class="history-count">×${count}</span>
    `;
    historyList.appendChild(item);
  });
}

// ─── FPS ─────────────────────────────────────────────────────────────────────
function updateFps() {
  state.frameCount++;
  const now = Date.now();
  if (now - state.lastFpsTime >= 1000) {
    fpsDisplay.textContent = `${state.frameCount} fps`;
    state.frameCount  = 0;
    state.lastFpsTime = now;
  }
}

// ─── Loading Helpers ──────────────────────────────────────────────────────────
function setLoadingProgress(pct, text) {
  loadingFill.style.width = `${pct}%`;
  loadingText.textContent = text;
}

function showNoModelScreen() {
  loadingScreen.classList.add('hidden');
  noModelScreen.classList.remove('hidden');
}

// ─── Object Picker ────────────────────────────────────────────────────────────
function buildObjectPicker() {
  const grid = document.getElementById('picker-grid');
  if (grid.childElementCount > 0) return; // already built

  PLACEABLE_OBJECTS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    const vocab = getVocab(item.key);
    btn.innerHTML = `
      <span class="picker-emoji">${item.emoji}</span>
      <span class="picker-word" style="color:${vocab.color}">${item.label}</span>
      <span class="picker-phonetic">${vocab.phonetic}</span>
    `;
    btn.addEventListener('click', () => {
      open3DViewer(item);
    });
    grid.appendChild(btn);
  });
}

/** Tap on a placed object → speak the word */
function handlePlacedObjectTap(sx, sy) {
  const { x, y } = screenToWorld(sx, sy);
  const THRESHOLD = 80; // pixels in ortho space
  for (const obj of arThree.placed) {
    const dx = obj.sprite.position.x - x;
    const dy = obj.sprite.position.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) {
      speak(obj.item.label, 0.8);
      // Brief pulse effect
      obj.sprite.scale.set(165, 165, 1);
      setTimeout(() => obj.sprite.scale.set(140, 140, 1), 300);
      break;
    }
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Speak the detected word
  $('btn-speak-word').addEventListener('click', () => {
    if (state.lastLabel) speak(state.lastLabel, 0.8);
  });

  // Read the example sentence (slightly slower for learning)
  $('btn-speak-sentence').addEventListener('click', () => {
    const sentence = $('example-sentence').textContent.replace(/^"|"$/g, '');
    if (sentence) speak(sentence, 0.75);
  });

  // Toggle auto-speak
  $('btn-auto-speak').addEventListener('click', () => {
    state.autoSpeak = !state.autoSpeak;
    const btn = $('btn-auto-speak');
    btn.dataset.active = state.autoSpeak;
    btn.classList.toggle('active', state.autoSpeak);
    btn.querySelector('.btn-icon').textContent = state.autoSpeak ? '🔈' : '🔇';
  });

  // Single scan button
  $('btn-scan').addEventListener('click', async () => {
    scanIndicator.classList.remove('hidden');
    state.continuousMode = false;
    $('btn-continuous').dataset.active = 'false';
    $('btn-continuous').classList.remove('active');

    await runInference();

    setTimeout(() => scanIndicator.classList.add('hidden'), 1200);
  });

  // Toggle continuous mode
  $('btn-continuous').addEventListener('click', () => {
    state.continuousMode = !state.continuousMode;
    const btn = $('btn-continuous');
    btn.dataset.active = state.continuousMode;
    btn.classList.toggle('active', state.continuousMode);
  });

  // History panel
  $('btn-history').addEventListener('click', () => {
    renderHistory();
    historyPanel.classList.remove('hidden');
  });

  $('btn-close-history').addEventListener('click', () => {
    historyPanel.classList.add('hidden');
  });

  // Pronounce words in history list (event delegation)
  $('history-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-speak-history');
    if (btn) speak(btn.dataset.word);
  });

  // ── AR Placement ──────────────────────────────────────────────────────────

  // Quiz
  $('btn-quiz').addEventListener('click', startQuiz);
  $('btn-quiz-close').addEventListener('click', closeQuiz);
  $('btn-quiz-again').addEventListener('click', startQuiz);

  // Open object picker panel
  $('btn-place-ar').addEventListener('click', () => {
    buildObjectPicker();
    $('object-picker-panel').classList.remove('hidden');
  });

  // 3D viewer panel controls
  $('btn-close-mv').addEventListener('click', close3DViewer);

  $('mv-speak-btn').addEventListener('click', () => {
    if (viewerCurrentItem) speak(viewerCurrentItem.label, 0.8);
  });

  $('mv-place-btn').addEventListener('click', () => {
    if (!viewerCurrentItem) return;
    const item = viewerCurrentItem; // save before close3DViewer nulls it
    close3DViewer();
    enterPlacementMode(item);
  });

  // Close picker without selecting
  $('btn-close-picker').addEventListener('click', () => {
    $('object-picker-panel').classList.add('hidden');
  });

  // Cancel placement mode
  $('btn-cancel-place').addEventListener('click', () => {
    exitPlacementMode();
  });

  // Clear all placed objects
  $('btn-clear-placed').addEventListener('click', () => {
    clearAllPlaced();
  });

  // All placement interactions are attached to ar-container (the full-screen parent).
  // ar-three-canvas has pointer-events:none so we cannot use it directly.
  // We filter out taps that originate inside interactive UI elements.
  const arContainerEl = document.getElementById('ar-container');

  // Only block placement when tapping actual UI controls (not the label card or video)
  const isInteractiveTarget = el =>
    el.closest('#control-bar, #placed-toolbar, #object-picker-panel, #history-panel, #status-bar, .placed-remove');

  // Track ghost position on touch move
  arContainerEl.addEventListener('touchmove', e => {
    if (!placementState.active) return;
    placementState.ghostX = e.touches[0].clientX;
    placementState.ghostY = e.touches[0].clientY;
  }, { passive: true });

  // Track ghost position on mouse move (desktop testing)
  arContainerEl.addEventListener('mousemove', e => {
    if (!placementState.active) return;
    placementState.ghostX = e.clientX;
    placementState.ghostY = e.clientY;
  });

  // Click (desktop) — place or speak
  arContainerEl.addEventListener('click', e => {
    if (isInteractiveTarget(e.target)) return;
    if (placementState.active) {
      placeObjectAt(e.clientX, e.clientY);
    } else {
      handlePlacedObjectTap(e.clientX, e.clientY);
    }
  });

  // Touch end (mobile) — place or speak
  arContainerEl.addEventListener('touchend', e => {
    if (isInteractiveTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (placementState.active) {
      placeObjectAt(t.clientX, t.clientY);
    } else {
      handlePlacedObjectTap(t.clientX, t.clientY);
    }
  }, { passive: true });

  // Demo mode (COCO)
  const demoBtn = $('btn-demo-mode');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      noModelScreen.classList.add('hidden');
      loadingScreen.classList.remove('hidden');
      state.mode = 'coco';
      await loadCocoModel();
      setLoadingProgress(70, 'Starting camera…');
      await startCamera();
      setLoadingProgress(90, 'Initialising AR…');
      setupCanvas();
      initArThree();
      setupEventListeners();
      setLoadingProgress(100, 'Ready (Demo Mode)!');
      setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
          loadingScreen.classList.add('hidden');
          arContainer.classList.remove('hidden');
          $('model-status').textContent = '🟡 Demo Mode (COCO)';
          startLoop();
        }, 500);
      }, 400);
    });
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initSpeech();
  init();
});
