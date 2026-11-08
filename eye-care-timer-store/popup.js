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

  // New Ergonomics & Focus Settings
  $("blueLightFilter").checked = !!s.blueLightFilter;
  $("blueLightWarmth").value = s.blueLightWarmth || 35;
  $("breakDelivery").value = s.breakDelivery || "fullscreen";
  $("meetingShield").checked = s.meetingShield !== false;
  $("macroInterval").value = String(s.macroInterval ?? 3);

  // New Kid Mode Settings
  $("volumeFade").checked = s.volumeFade !== false;
  $("dailyBudget").value = String(s.dailyBudget ?? 0);
  $("bedtimeCurfew").checked = !!s.bedtimeCurfew;
  $("bedtimeStart").value = s.bedtimeStart || "20:00";
  $("bedtimeEnd").value = s.bedtimeEnd || "07:00";

  $("warmthRow").hidden = !$("blueLightFilter").checked;
  $("curfewHoursRow").hidden = !$("bedtimeCurfew").checked;

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
  setupDataButtons();
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
for (const k of ["repeat", "sound", "ambientSound", "prewarn", "notify", "pauseMedia", "resumeMedia", "kidMode", "kidSpeech", "closeBrowser", "meetingShield", "volumeFade"]) {
  $(k).onchange = () => chrome.storage.local.set({ [k]: $(k).checked });
}
$("soundType").onchange = () => chrome.storage.local.set({ soundType: $("soundType").value });
$("kidTheme").onchange = () => chrome.storage.local.set({ kidTheme: $("kidTheme").value });

$("blueLightFilter").onchange = () => {
  const on = $("blueLightFilter").checked;
  $("warmthRow").hidden = !on;
  chrome.storage.local.set({ blueLightFilter: on }).then(() => send({ type: "syncWarmer" }));
};
$("blueLightWarmth").oninput = () => {
  chrome.storage.local.set({ blueLightWarmth: Number($("blueLightWarmth").value) });
};
$("breakDelivery").onchange = () => chrome.storage.local.set({ breakDelivery: $("breakDelivery").value });
$("macroInterval").onchange = () => chrome.storage.local.set({ macroInterval: Number($("macroInterval").value) });
$("dailyBudget").onchange = () => chrome.storage.local.set({ dailyBudget: Number($("dailyBudget").value) }).then(refresh);

$("bedtimeCurfew").onchange = () => {
  const on = $("bedtimeCurfew").checked;
  $("curfewHoursRow").hidden = !on;
  chrome.storage.local.set({ bedtimeCurfew: on }).then(refresh);
};
$("bedtimeStart").onchange = () => chrome.storage.local.set({ bedtimeStart: $("bedtimeStart").value });
$("bedtimeEnd").onchange = () => chrome.storage.local.set({ bedtimeEnd: $("bedtimeEnd").value });

function setupDataButtons() {
  $("exportData").onclick = async () => {
    const res = await send({ type: "exportStats" });
    if (res && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eyecare-stats-${new Date().toLocaleDateString("en-CA")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  $("resetData").onclick = async () => {
    if (confirm("Reset all break statistics and daily screen time history?")) {
      await send({ type: "resetStats" });
      renderInsights();
      refresh();
    }
  };
}

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

  // Eye Health Score
  const breakPoints = Math.min(60, todayBreaks * 12);
  const compPoints = Math.round(20 * (compliance / 100));
  const streakPoints = Math.min(20, currentStreak * 4);
  const score = todayBreaks > 0
    ? Math.min(100, breakPoints + compPoints + streakPoints)
    : Math.min(100, Math.max(45, streakPoints + compPoints));

  $("scoreVal").textContent = score;
  if (score >= 85) {
    $("scoreTitle").textContent = "Optimal Protection 🌟";
    $("scoreSub").textContent = "Superb break cadence and visual recovery.";
    $("scoreVal").style.color = "var(--accent)";
  } else if (score >= 65) {
    $("scoreTitle").textContent = "Good Habit Building 👍";
    $("scoreSub").textContent = "Keep resting your eyes every 20 minutes.";
    $("scoreVal").style.color = "var(--warn)";
  } else {
    $("scoreTitle").textContent = "Eye Rest Needed ⚠️";
    $("scoreSub").textContent = "Take more breaks to relieve digital fatigue.";
    $("scoreVal").style.color = "var(--urgent)";
  }

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

  // Shield Tags & Kid Budget in Timer view
  const shieldsBox = $("timerShields");
  shieldsBox.innerHTML = "";
  if (s.blueLightFilter) {
    const t = document.createElement("span");
    t.className = "shield-tag";
    t.textContent = "☀️ Warmer Tint";
    shieldsBox.appendChild(t);
  }
  if (s.meetingShield !== false) {
    const t = document.createElement("span");
    t.className = "shield-tag";
    t.textContent = "🛡️ Meeting Shield";
    shieldsBox.appendChild(t);
  }
  if (s.bedtimeCurfew) {
    const t = document.createElement("span");
    t.className = "shield-tag warn";
    t.textContent = `🌙 Curfew ${s.bedtimeStart || "20:00"}`;
    shieldsBox.appendChild(t);
  }

  // Kid budget bar
  const budgetBox = $("kidBudgetBar");
  const budgetMin = Number(s.dailyBudget) || 0;
  if (s.kidMode !== false && budgetMin > 0) {
    budgetBox.hidden = false;
    const usage = (s.kidDailyUsage && s.kidDailyUsage[new Date().toLocaleDateString("en-CA")]) || 0;
    $("kidBudgetLabel").textContent = `${usage} / ${budgetMin}m`;
    const pct = Math.min(100, Math.round((usage / budgetMin) * 100));
    const fill = $("kidBudgetFill");
    fill.style.width = pct + "%";
    fill.classList.toggle("exceeded", usage >= budgetMin);
  } else {
    budgetBox.hidden = true;
  }

  // Toolbar icon sync
  const sec = Math.floor(now / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    try { chrome.action.setIcon({ imageData: iconImageData(o) }); } catch (e) {}
  }
}

load();
