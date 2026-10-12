const params = new URLSearchParams(location.search);
const msg = params.get("m");
if (msg) document.getElementById("msg").textContent = msg;
const soundOn = params.get("sound") === "1";

const LOOK_SECONDS = 20;
const CIRC = 377;
let left = LOOK_SECONDS;
let counted = false;
const send = (m) => chrome.runtime.sendMessage(m);

function chime() {
  if (!soundOn) return;
  try {
    const ac = new AudioContext();
    [[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(ac.destination);
      const st = ac.currentTime + t;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.25, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
      o.start(st); o.stop(st + 0.55);
    });
  } catch (e) {}
}

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
    document.getElementById("sub").textContent = "Nice! Your eyes thank you.";
    markTaken();
    chime();
  }
}, 1000);

// ---- parent PIN gate (only when a PIN has been set) ----
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

// Closing the window gives the screen back; media that was paused gets resumed.
const closeWindow = () => chrome.windows.getCurrent((w) => chrome.windows.remove(w.id));
async function finish(extra) {
  await send({ type: "ack" });
  await send({ type: "resumeMedia" });
  if (extra) await extra();
  closeWindow();
}
document.getElementById("ok").onclick = () => gate(() => { markTaken(); finish(); });
document.getElementById("snooze").onclick = () => gate(() => finish(() => send({ type: "snooze", minutes: 5 })));
window.addEventListener("pagehide", () => send({ type: "ack" }));

chime();
