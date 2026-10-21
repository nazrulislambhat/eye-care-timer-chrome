const DEFAULT_PRESETS = [15, 20, 30];
const CIRC = 390; // 2 * PI * 62
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let presets = [...DEFAULT_PRESETS];
let lastSecond = -1;
let pinSet = false, unlocked = true, verifiedPin = "", pad = null;

async function load() {
  const s = await chrome.storage.local.get(null);
  if (Array.isArray(s.presets)) presets = s.presets;

  // Settings inputs
  $("repeat").checked = !!s.repeat;
  $("sound").checked = s.sound !== false;
  $("ambientSound").checked = !!s.ambientSound;
  $("prewarn").checked = s.prewarn !== false;
  $("notify").checked = s.notify !== false;
  $("pauseMedia").checked = s.pauseMedia !== false;
  $("resumeMedia").checked = s.resumeMedia !== false;
  $("kidMode").checked = s.kidMode !== false;
  $("kidSpeech").checked = s.kidSpeech !== false;
  $("closeBrowser").checked = s.closeBrowser !== false;

  if (s.soundType) $("soundType").value = s.soundType;
  if (s.kidTheme) $("kidTheme").value = s.kidTheme;

  const st = await send({ type: "pinStatus" });
  pinSet = !!(st && st.set);
  unlocked = !pinSet; // with a PIN, popup starts locked
  buildPad();
  applyLock();
  refreshAccess();
  renderChips();
  setupTabs();
  setupExercises();
  send({ type: "ack" }); // opening popup dismisses "!" badge
  refresh();
  setInterval(refresh, 500);
}

// ---------- Tab Navigation ----------
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      tabContents.forEach((c) => {
        const show = c.id === "tab-" + tab;
        c.classList.toggle("active", show);
        c.hidden = !show;
      });
      if (tab === "insights") renderInsights();
    };
  });
}

function setupExercises() {
  document.querySelectorAll("[data-ex]").forEach((btn) => {
    btn.onclick = () => send({ type: "launchBreak", exercise: btn.dataset.ex });
  });
}

// ---------- Access Status ----------
async function refreshAccess() {
  try {
    const on = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    const el = $("accessStatus");
    el.textContent = on ? "Active" : "Off";
    el.style.borderColor = on ? "var(--accent)" : "var(--line)";
    el.style.color = on ? "var(--accent)" : "var(--muted)";
  } catch (e) {}
}
$("openAccess").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("access.html") });

// ---------- PIN Pad Lock ----------
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
    ? "Popup asks for your PIN each time you open it."
    : "Set a PIN so kids cannot change settings or exit breaks.";
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
    $("pinHint").textContent = "PIN saved successfully.";
  } else {
    $("pinHint").textContent = (r && r.error) || "Could not save the PIN.";
  }
};

// ---------- Preset Chips ----------
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

// Settings change listeners
for (const k of ["repeat", "sound", "ambientSound", "prewarn", "notify", "pauseMedia", "resumeMedia", "kidMode", "kidSpeech", "closeBrowser"]) {
  $(k).onchange = () => chrome.storage.local.set({ [k]: $(k).checked });
}
$("soundType").onchange = () => chrome.storage.local.set({ soundType: $("soundType").value });
$("kidTheme").onchange = () => chrome.storage.local.set({ kidTheme: $("kidTheme").value });

$("stop").onclick = () => send({ type: "stop" }).then(refresh);
$("pause").onclick = () => send({ type: $("pause").dataset.mode === "resume" ? "resume" : "pause" }).then(refresh);
$("breakNow").onclick = () => send({ type: "launchBreak" });

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

// ---------- Insights & 7-Day Chart ----------
async function renderInsights() {
  const s = await chrome.storage.local.get(["stats"]);
  const stats = s.stats || {};
  const days = stats.days || {};
  const snoozes = stats.snoozes || {};
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayBreaks = days[todayKey] || 0;
  const todaySnoozes = snoozes[todayKey] || 0;
  const currentStreak = streak(days);

  $("statToday").textContent = todayBreaks;
  $("statStreak").textContent = currentStreak + " d";
  const totalMin = stats.totalMinutes || (todayBreaks * 20);
  $("statMinutes").textContent = totalMin + " m";

  const totalAttempts = todayBreaks + todaySnoozes;
  const compliance = totalAttempts > 0 ? Math.round((todayBreaks / totalAttempts) * 100) : 100;
  $("statCompliance").textContent = compliance + "%";

  // Build 7-day chart
  const chartBox = $("barChart");
  chartBox.innerHTML = "";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekData = [];
  let maxCount = 1;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    const count = days[key] || 0;
    if (count > maxCount) maxCount = count;
    weekData.push({
      key,
      day: dayNames[d.getDay()],
      count,
      isToday: i === 0
    });
  }

  weekData.forEach((item) => {
    const col = document.createElement("div");
    col.className = "bar-col" + (item.isToday ? " today" : "");
    col.title = item.day + ": " + item.count + " breaks";

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const pct = Math.max(5, Math.round((item.count / maxCount) * 100));
    fill.style.height = (item.count > 0 ? pct : 4) + "%";

    track.appendChild(fill);

    const lbl = document.createElement("div");
    lbl.className = "bar-day";
    lbl.textContent = item.day[0];

    col.appendChild(track);
    col.appendChild(lbl);
    chartBox.appendChild(col);
  });
}

// ---------- Live UI Refresh Loop ----------
async function refresh() {
  const s = await chrome.storage.local.get(null);
  const now = Date.now();
  const o = iconOpts({ ...s, ringing: false }, now);
  const arc = $("arc");

  if (s.paused && s.pausedLeft != null) {
    $("time").textContent = fmt(s.pausedLeft);
    $("status").textContent = "Paused";
    $("status").style.color = "var(--warn)";
    $("pause").hidden = false; $("pause").textContent = "Resume"; $("pause").dataset.mode = "resume";
    $("stop").hidden = false;
  } else if (s.endTime) {
    const rem = Math.max(0, s.endTime - now);
    $("time").textContent = fmt(rem);
    $("status").textContent = rem <= 60000 ? "Final minute" : rem <= 300000 ? "Resting soon" : "Active focus";
    $("status").style.color = rem <= 60000 ? "var(--urgent)" : rem <= 300000 ? "var(--warn)" : "var(--accent)";
    $("pause").hidden = false; $("pause").textContent = "Pause"; $("pause").dataset.mode = "pause";
    $("stop").hidden = false;
  } else {
    $("time").textContent = "--:--";
    $("status").textContent = "Ready";
    $("status").style.color = "var(--muted)";
    $("pause").hidden = true; $("stop").hidden = true;
  }

  arc.setAttribute("class", "arc " + (["warn", "urgent", "paused"].includes(o.state) ? o.state : ""));
  arc.style.strokeDashoffset = String(CIRC * (o.state === "idle" ? 1 : o.progress));

  // Toolbar icon sync
  const sec = Math.floor(now / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    try { chrome.action.setIcon({ imageData: iconImageData(o) }); } catch (e) {}
  }
}

load();
