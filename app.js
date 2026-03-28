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

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  model: null,
  cocoModel: null,
  mode: 'custom',       // 'custom' | 'coco'
  isRunning: false,
  continuousMode: true,
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
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js';
  document.head.appendChild(script);
  await new Promise(resolve => script.onload = resolve);
  // mobilenet_v2 balances speed and accuracy well on mobile
  state.cocoModel = await cocoSsd.load({ base: 'mobilenet_v2' });
  setLoadingProgress(60, 'COCO model loaded ✓');
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

  // Draw bounding boxes
  clearCanvas();
  predictions.forEach(pred => {
    const [x, y, w, h] = pred.bbox;
    const vocab = getVocab(pred.class);
    const scaleX = canvas.width  / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    ctx.strokeStyle = vocab.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);

    // Mini label above box
    ctx.fillStyle = vocab.color + 'CC';
    ctx.fillRect(x * scaleX, (y * scaleY) - 28, Math.min(w * scaleX, 150), 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(pred.class.toUpperCase(), (x * scaleX) + 6, (y * scaleY) - 8);
  });

  // Show best prediction in label card
  const best = predictions[0];
  displayLabel(best.class, best.score);
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
  const count = (state.learnedWords.get(label) || 0) + 1;
  state.learnedWords.set(label, count);
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

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
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
window.addEventListener('DOMContentLoaded', init);
