const params = new URLSearchParams(location.search);
const msg = params.get("m");
if (msg) document.getElementById("msg").textContent = msg;
const soundOn = params.get("sound") !== "0";
const soundType = params.get("soundType") || "bowl";
let ambientOn = params.get("ambient") === "1";
const initialExercise = params.get("exercise") || "rule";

const LOOK_SECONDS = 20;
const CIRC = 377;
let left = LOOK_SECONDS;
let counted = false;
const send = (m) => chrome.runtime.sendMessage(m);

// ---------- Sound Synthesis (Web Audio API) ----------
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundOn) return;
  try {
    const ac = getAudioContext();
    if (!ac) return;

    if (type === "bell") {
      // Zen Bell: clear high bell
      [1046.5, 2093].forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ac.destination);
        const t = ac.currentTime;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.3 : 0.08, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        osc.start(t);
        osc.stop(t + 1.9);
      });
    } else if (type === "chime") {
      // Classic Chime: 3-note arpeggio
      [[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([f, delay]) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(ac.destination);
        const t = ac.currentTime + delay;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        osc.start(t);
        osc.stop(t + 0.75);
      });
    } else {
      // Tibetan Singing Bowl (default): fundamental + 2.76x + 5.4x overtones
      const now = ac.currentTime;
      const partials = [
        { f: 216, g: 0.35, len: 3.5 },
        { f: 216 * 2.76, g: 0.12, len: 2.5 },
        { f: 216 * 5.4, g: 0.05, len: 1.8 }
      ];
      partials.forEach(({ f, g, len }) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(ac.destination);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(g, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
        osc.start(now);
        osc.stop(now + len + 0.1);
      });
    }
  } catch (e) {}
}

// Ambient Surf / Rainfall generator (filtered white/pink noise with subtle wave oscillation)
let ambientNodes = null;
function startAmbient() {
  try {
    const ac = getAudioContext();
    if (!ac || ambientNodes) return;
    const bufferSize = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter approximation
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    const gain = ac.createGain();
    gain.gain.value = 0.08;

    // Gentle wave modulation (LFO)
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.12; // 8-second cycle
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    noise.start();
    lfo.start();
    ambientNodes = { noise, lfo, gain };
  } catch (e) {}
}

function stopAmbient() {
  if (ambientNodes) {
    try {
      ambientNodes.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      setTimeout(() => {
        try {
          ambientNodes.noise.stop();
          ambientNodes.lfo.stop();
        } catch(e) {}
        ambientNodes = null;
      }, 350);
    } catch (e) {
      ambientNodes = null;
    }
  }
}

// Ambient Toggle UI
const ambientBtn = document.getElementById("ambientToggle");
function updateAmbientUI() {
  ambientBtn.classList.toggle("active", ambientOn);
  ambientBtn.setAttribute("aria-pressed", ambientOn ? "true" : "false");
  document.getElementById("ambientLabel").textContent = ambientOn ? "Ambient Playing" : "Ambient Sound";
}
ambientBtn.onclick = () => {
  ambientOn = !ambientOn;
  updateAmbientUI();
  if (ambientOn) startAmbient(); else stopAmbient();
  chrome.storage.local.set({ ambientSound: ambientOn });
};
updateAmbientUI();
if (ambientOn) startAmbient();

// ---------- Countdown & Progress ----------
function markTaken() {
  if (counted) return;
  counted = true;
  send({ type: "taken" });
}

const arc = document.getElementById("arc");
const count = document.getElementById("count");
const tick = setInterval(() => {
  left--;
  count.textContent = Math.max(left, 0);
  arc.style.strokeDashoffset = String(CIRC * (1 - Math.max(left, 0) / LOOK_SECONDS));
  if (left <= 0) {
    clearInterval(tick);
    count.textContent = "✓";
    document.getElementById("sub").textContent = "Rest complete! Your eyes thank you.";
    markTaken();
    playSound(soundType);
  }
}, 1000);

// ---------- Exercise Pacer Modes ----------
const tabs = document.querySelectorAll(".mode-tab");
const views = document.querySelectorAll(".pacer-view");

function setExerciseMode(mode) {
  tabs.forEach((t) => {
    const isTarget = t.dataset.mode === mode;
    t.classList.toggle("active", isTarget);
    t.setAttribute("aria-selected", isTarget ? "true" : "false");
  });
  views.forEach((v) => {
    v.classList.toggle("active", v.id === "view-" + mode);
  });
}

tabs.forEach((tab) => {
  tab.onclick = () => {
    const mode = tab.dataset.mode;
    setExerciseMode(mode);
    chrome.storage.local.set({ preferredExercise: mode });
  };
});
if (initialExercise) setExerciseMode(initialExercise);

// Breathing loop prompts
const orbLabel = document.getElementById("orbLabel");
let breathStep = 0;
setInterval(() => {
  breathStep = (breathStep + 1) % 10;
  if (breathStep < 4) {
    orbLabel.textContent = "Inhale gently (" + (4 - breathStep) + "s)...";
  } else if (breathStep < 6) {
    orbLabel.textContent = "Hold softly (" + (6 - breathStep) + "s)...";
  } else {
    orbLabel.textContent = "Exhale slowly (" + (10 - breathStep) + "s)...";
  }
}, 1000);

// Blink gym prompts
const blinkPrompt = document.getElementById("blinkPrompt");
let blinkCount = 1;
setInterval(() => {
  blinkCount = (blinkCount % 10) + 1;
  blinkPrompt.textContent = "Blink " + blinkCount + " of 10 · Pause & open";
}, 2000);

// ---------- Parent PIN Gate (if set) ----------
let pinSet = false, gatePad = null;
send({ type: "pinStatus" }).then((r) => { pinSet = !!(r && r.set); });

function gate(run) {
  if (!pinSet) return run();
  const g = document.getElementById("gate");
  const card = document.createElement("div");
  card.className = "gcard";
  gatePad = createPinPad({
    title: "Parent PIN",
    onSubmit: async (pin) => {
      const r = await send({ type: "verifyPin", pin });
      if (r && r.ok) { g.hidden = true; g.replaceChildren(); gatePad = null; run(); }
      return r;
    },
    onCancel: () => { g.hidden = true; g.replaceChildren(); gatePad = null; }
  });
  card.appendChild(gatePad.el);
  g.replaceChildren(card);
  g.hidden = false;
}
window.addEventListener("keydown", (e) => {
  if (gatePad && gatePad.handleKey(e)) e.preventDefault();
});

const closeWindow = () => chrome.windows.getCurrent((w) => chrome.windows.remove(w.id));
async function finish(extra) {
  stopAmbient();
  await send({ type: "ack" });
  await send({ type: "resumeMedia" });
  if (extra) await extra();
  closeWindow();
}

document.getElementById("ok").onclick = () => gate(() => { markTaken(); finish(); });
document.getElementById("snooze").onclick = () => gate(() => finish(() => send({ type: "snooze", minutes: 5 })));
window.addEventListener("pagehide", () => {
  stopAmbient();
  send({ type: "ack" });
});

// Initial chime sound at break onset
playSound(soundType);
