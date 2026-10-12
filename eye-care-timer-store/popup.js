const DEFAULT_PRESETS = [15, 20, 30];
const CIRC = 377; // 2 * PI * 60
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let presets = [...DEFAULT_PRESETS];
let lastSecond = -1;
let pinSet = false, unlocked = true, verifiedPin = "", pad = null;

async function load() {
  const s = await chrome.storage.local.get(null);
  if (Array.isArray(s.presets)) presets = s.presets;
  $("repeat").checked = !!s.repeat;
  $("sound").checked = s.sound !== false;
  $("notify").checked = s.notify !== false;
  $("pauseMedia").checked = s.pauseMedia !== false;
  $("resumeMedia").checked = s.resumeMedia !== false;
  $("kidMode").checked = s.kidMode !== false;
  $("closeBrowser").checked = s.closeBrowser !== false;

  const st = await send({ type: "pinStatus" });
  pinSet = !!(st && st.set);
  unlocked = !pinSet;            // with a PIN, the popup starts locked
  buildPad();
  applyLock();
  refreshAccess();
  renderChips();
  send({ type: "ack" });          // opening the popup dismisses the "!" badge
  refresh();
  setInterval(refresh, 500);
}

async function refreshAccess() {
  try {
    const on = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    $("accessStatus").textContent = on ? "On" : "Off";
  } catch (e) {}
}
$("openAccess").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("access.html") });

function buildPad() {
  pad = createPinPad({
    title: "Parent PIN",
    onSubmit: async (pin) => {
      const r = await send({ type: "verifyPin", pin });
      if (r && r.ok) { unlocked = true; verifiedPin = pin; applyLock(); }
      return r;
    }
  });
  $("lockPad").replaceChildren(pad.el);
}

function applyLock() {
  const locked = pinSet && !unlocked;
  document.body.classList.toggle("locked", locked);
  $("lockView").hidden = !locked;
  $("relock").hidden = !(pinSet && unlocked);
  $("savePin").textContent = pinSet ? "Change PIN" : "Set PIN";
  $("pinHint").textContent = pinSet
    ? "This popup asks for your PIN each time you open it."
    : "Set a PIN so your toddler can't unlock the screen or change the timer.";
}

document.addEventListener("keydown", (e) => {
  if (document.body.classList.contains("locked") && pad && pad.handleKey(e)) e.preventDefault();
});
$("relock").onclick = () => { unlocked = false; verifiedPin = ""; buildPad(); applyLock(); };

$("savePin").onclick = async () => {
  const pin = $("pin").value.trim();
  if (!/^\d{4}$/.test(pin)) { $("pinHint").textContent = "Enter exactly 4 digits."; $("pin").focus(); return; }
  const r = await send({ type: "setPin", pin, current: verifiedPin });
  if (r && r.ok) {
    pinSet = true; unlocked = true; verifiedPin = pin;
    $("pin").value = "";
    buildPad(); applyLock();
    $("pinHint").textContent = "PIN saved.";
  } else {
    $("pinHint").textContent = (r && r.error) || "Could not save the PIN.";
  }
};

function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  [...presets].sort((a, b) => a - b).forEach((m) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const go = document.createElement("button");
    go.textContent = m + " min";
    go.onclick = () => start(m);
    chip.appendChild(go);
    if (!DEFAULT_PRESETS.includes(m)) {
      const x = document.createElement("button");
      x.className = "x"; x.textContent = "×"; x.title = "Remove";
      x.setAttribute("aria-label", "Remove " + m + " minute preset");
      x.onclick = async () => {
        presets = presets.filter((p) => p !== m);
        await chrome.storage.local.set({ presets });
        renderChips();
      };
      chip.appendChild(x);
    }
    box.appendChild(chip);
  });
}

const start = (minutes) => send({ type: "start", minutes, repeat: $("repeat").checked }).then(refresh);

function readCustom() {
  const m = Math.round(Number($("custom").value));
  if (!m || m < 1 || m > 600) { $("custom").focus(); return null; }
  return m;
}
$("startCustom").onclick = () => { const m = readCustom(); if (m) start(m); };
$("saveCustom").onclick = async () => {
  const m = readCustom();
  if (!m) return;
  if (!presets.includes(m)) presets.push(m);
  await chrome.storage.local.set({ presets });
  $("custom").value = "";
  renderChips();
};
$("custom").addEventListener("keydown", (e) => { if (e.key === "Enter") $("startCustom").click(); });
for (const k of ["repeat", "sound", "notify", "pauseMedia", "resumeMedia", "kidMode", "closeBrowser"]) {
  $(k).onchange = () => chrome.storage.local.set({ [k]: $(k).checked });
}
$("stop").onclick = () => send({ type: "stop" }).then(refresh);
$("pause").onclick = () => send({ type: $("pause").dataset.mode === "resume" ? "resume" : "pause" }).then(refresh);

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function streak(days) {
  const d = new Date();
  if (!days[d.toLocaleDateString("en-CA")]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[d.toLocaleDateString("en-CA")]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

async function refresh() {
  const s = await chrome.storage.local.get(null);
  const now = Date.now();
  const o = iconOpts({ ...s, ringing: false }, now);
  const arc = $("arc");

  if (s.paused && s.pausedLeft != null) {
    $("time").textContent = fmt(s.pausedLeft);
    $("status").textContent = "Paused";
    $("pause").hidden = false; $("pause").textContent = "Resume"; $("pause").dataset.mode = "resume";
    $("stop").hidden = false;
  } else if (s.endTime) {
    $("time").textContent = fmt(Math.max(0, s.endTime - now));
    $("status").textContent = "until the break";
    $("pause").hidden = false; $("pause").textContent = "Pause"; $("pause").dataset.mode = "pause";
    $("stop").hidden = false;
  } else {
    $("time").textContent = "--:--";
    $("status").textContent = "No timer running";
    $("pause").hidden = true; $("stop").hidden = true;
  }
  arc.setAttribute("class", "arc " + (["warn", "urgent", "paused"].includes(o.state) ? o.state : ""));
  arc.style.strokeDashoffset = String(CIRC * (o.state === "idle" ? 1 : o.progress));

  // live toolbar icon: updated every second while the popup is open
  const sec = Math.floor(now / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    try { chrome.action.setIcon({ imageData: iconImageData(o) }); } catch (e) {}
  }

  const days = (s.stats && s.stats.days) || {};
  const n = days[new Date().toLocaleDateString("en-CA")] || 0;
  const st = streak(days);
  $("stats").textContent = "Today: " + n + (n === 1 ? " break" : " breaks") + (st > 1 ? "  ·  " + st + " day streak" : "");
}

load();
