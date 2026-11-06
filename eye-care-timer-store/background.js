// Eye Care Timer - background service worker.
// chrome.alarms keeps firing while the browser is minimized and wakes this worker.
importScripts("icon.js");

const ALARM = "eyeTimer";
const TICK = "eyeTick";
const PREWARN = "eyePrewarn";
const EXTEND_MINUTES = 10;
const CLOSE_SECONDS = 10;
const IDLE_DETECTION_SECONDS = 60;
let closeTimer = null;

const MESSAGES = [
  "Take care of your eyes. Look at something 20 feet away for 20 seconds.",
  "Great work! Give your eyes a rest and look out of a window for a moment.",
  "Time for a mini break. Blink slowly a few times and relax your eyes.",
  "Your eyes work hard for you. Look away from the screen and take a deep breath."
];

const get = (k) => chrome.storage.local.get(k);
const set = (o) => chrome.storage.local.set(o);
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

// ---------- parent PIN ----------
async function sha(salt, pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPin(pin) {
  const s = await get(["pinHash", "pinSalt", "pinFails", "pinLockUntil"]);
  if (!s.pinHash) return { ok: true, noPin: true };
  const now = Date.now();
  if (s.pinLockUntil && s.pinLockUntil > now) return { ok: false, wait: Math.ceil((s.pinLockUntil - now) / 1000) };
  if ((await sha(s.pinSalt, String(pin))) === s.pinHash) {
    await set({ pinFails: 0, pinLockUntil: 0 });
    return { ok: true };
  }
  const fails = (s.pinFails || 0) + 1;
  if (fails >= 5) { await set({ pinFails: 0, pinLockUntil: now + 30000 }); return { ok: false, wait: 30 }; }
  await set({ pinFails: fails });
  return { ok: false };
}

async function setPin(pin, current) {
  if (!/^\d{4}$/.test(String(pin))) return { ok: false, error: "The PIN must be exactly 4 digits." };
  const { pinHash } = await get("pinHash");
  if (pinHash) {
    const r = await verifyPin(current);
    if (!r.ok) return { ok: false, error: r.wait ? "Too many tries. Wait " + r.wait + " seconds." : "Current PIN is wrong." };
  }
  const salt = crypto.randomUUID();
  await set({ pinSalt: salt, pinHash: await sha(salt, String(pin)) });
  return { ok: true };
}

// ---------- optional all-sites access ("Full protection") ----------
// Without it: the Bye-bye video screen opens in its own full-screen window and the browser still closes.
// With it: the screen also covers every tab, and playing media is paused.
const SITES = { origins: ["<all_urls>"] };
const LOCK_SCRIPT_ID = "eyecare-lock";
const WARMER_SCRIPT_ID = "eyecare-warmer";
const hasSites = () => chrome.permissions.contains(SITES);

async function registerLockScript() {
  const have = await chrome.scripting.getRegisteredContentScripts({ ids: [LOCK_SCRIPT_ID] });
  if (have.length) return;
  await chrome.scripting.registerContentScripts([{
    id: LOCK_SCRIPT_ID, matches: ["<all_urls>"], runAt: "document_start", persistAcrossSessions: true,
    js: ["pinpad.js", "kidscreen.js", "lock-content.js"]
  }]);
}
async function unregisterLockScript() {
  try { await chrome.scripting.unregisterContentScripts({ ids: [LOCK_SCRIPT_ID] }); } catch (e) {}
}

async function syncScreenWarmer() {
  const { blueLightFilter } = await get("blueLightFilter");
  if (!blueLightFilter || !(await hasSites())) {
    try { await chrome.scripting.unregisterContentScripts({ ids: [WARMER_SCRIPT_ID] }); } catch (e) {}
    return;
  }
  const have = await chrome.scripting.getRegisteredContentScripts({ ids: [WARMER_SCRIPT_ID] });
  if (!have.length) {
    try {
      await chrome.scripting.registerContentScripts([{
        id: WARMER_SCRIPT_ID, matches: ["<all_urls>"], runAt: "document_idle", persistAcrossSessions: true,
        js: ["screen-warmer.js"]
      }]);
    } catch (e) {}
  }
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map((t) =>
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["screen-warmer.js"] }).catch(() => {})
  ));
}

// Tabs that were already open need the script too (registered scripts only run on new page loads).
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map(async (t) => {
    const r = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => typeof renderKidScreen === "function" });
    if (!(r[0] && r[0].result)) {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["pinpad.js", "kidscreen.js", "lock-content.js"] });
    }
  }));
}
chrome.permissions.onRemoved.addListener(async () => {
  if (!(await hasSites())) {
    unregisterLockScript();
    try { await chrome.scripting.unregisterContentScripts({ ids: [WARMER_SCRIPT_ID] }); } catch (e) {}
  }
});

// ---------- pause / resume media in browser tabs ----------
async function pauseMedia() {
  if (!(await hasSites())) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map((t) =>
    chrome.scripting.executeScript({
      target: { tabId: t.id, allFrames: true },
      func: () => {
        document.querySelectorAll("video, audio").forEach((m) => {
          if (!m.paused && !m.ended) { m.dataset.eyecarePaused = "1"; m.pause(); }
        });
      }
    }).catch(() => {}) // chrome:// pages, web store, etc. can't be scripted
  ));
}

async function resumeMedia() {
  const { resumeMedia: allowed } = await get("resumeMedia");
  if (allowed === false || !(await hasSites())) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map((t) =>
    chrome.scripting.executeScript({
      target: { tabId: t.id, allFrames: true },
      func: () => {
        document.querySelectorAll("[data-eyecare-paused]").forEach((m) => {
          delete m.dataset.eyecarePaused;
          m.play().catch(() => {});
        });
      }
    }).catch(() => {})
  ));
}

// ---------- gentle volume fade / restore for Kid Mode ----------
async function fadeMediaVolume() {
  if (!(await hasSites())) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map((t) =>
    chrome.scripting.executeScript({
      target: { tabId: t.id, allFrames: true },
      func: () => {
        document.querySelectorAll("video, audio").forEach((m) => {
          if (!m.paused && !m.ended) {
            if (m.dataset.eyecareOrigVolume == null) m.dataset.eyecareOrigVolume = String(m.volume);
            const current = m.volume;
            const target = 0.25;
            const step = Math.max(0.02, (current - target) / 10);
            let steps = 0;
            const fadeTimer = setInterval(() => {
              steps++;
              m.volume = Math.max(target, m.volume - step);
              if (steps >= 10 || m.volume <= target) clearInterval(fadeTimer);
            }, 3000);
          }
        });
      }
    }).catch(() => {})
  ));
}

async function restoreMediaVolume() {
  if (!(await hasSites())) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((t) => t.id != null).map((t) =>
    chrome.scripting.executeScript({
      target: { tabId: t.id, allFrames: true },
      func: () => {
        document.querySelectorAll("[data-eyecare-orig-volume]").forEach((m) => {
          const orig = parseFloat(m.dataset.eyecareOrigVolume);
          if (!isNaN(orig)) m.volume = orig;
          delete m.dataset.eyecareOrigVolume;
        });
      }
    }).catch(() => {})
  ));
}

// ---------- Meeting & Presentation Shield detection ----------
async function isMeetingActive() {
  const meetingDomains = [
    "meet.google.com",
    "teams.microsoft.com",
    "teams.live.com",
    "zoom.us",
    "webex.com",
    "chime.aws",
    "gotomeeting.com",
    "whereby.com"
  ];
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url) continue;
      const u = tab.url.toLowerCase();
      if (meetingDomains.some((d) => u.includes(d))) return true;
      if (tab.audible && (u.includes("call") || u.includes("conference") || /meet|zoom|teams|huddle/i.test(tab.title || ""))) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// ---------- Kid Mode Daily Budget & Bedtime Curfew ----------
function isBedtime(startStr = "20:00", endStr = "07:00") {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = (startStr || "20:00").split(":").map(Number);
  const [eH, eM] = (endStr || "07:00").split(":").map(Number);
  const startMinutes = (sH || 20) * 60 + (sM || 0);
  const endMinutes = (eH || 7) * 60 + (eM || 0);

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

async function checkKidRestrictions(requestedMinutes = 0) {
  const s = await get(["kidMode", "bedtimeCurfew", "bedtimeStart", "bedtimeEnd", "dailyBudget", "kidDailyUsage"]);
  if (s.kidMode === false) return { allowed: true };

  if (s.bedtimeCurfew && isBedtime(s.bedtimeStart, s.bedtimeEnd)) {
    return {
      allowed: false,
      reason: "bedtime",
      message: "It's bedtime (" + (s.bedtimeStart || "20:00") + " - " + (s.bedtimeEnd || "07:00") + "). Time to sleep!"
    };
  }

  const budget = Number(s.dailyBudget) || 0;
  if (budget > 0) {
    const usage = s.kidDailyUsage || {};
    const usedToday = usage[today()] || 0;
    if (usedToday >= budget) {
      return {
        allowed: false,
        reason: "budget",
        message: "Daily video allowance (" + budget + " min) reached for today!"
      };
    }
  }

  return { allowed: true };
}

async function addKidUsage(minutes) {
  if (!minutes || minutes <= 0) return;
  const s = await get(["kidDailyUsage", "kidMode"]);
  if (s.kidMode === false) return;
  const usage = s.kidDailyUsage || {};
  const t = today();
  usage[t] = (usage[t] || 0) + minutes;
  await set({ kidDailyUsage: usage });
}

// ---------- close the whole browser after the lock-screen countdown ----------
async function scheduleClose() {
  clearTimeout(closeTimer);
  const { closeAt } = await get("closeAt");
  if (!closeAt) return;
  closeTimer = setTimeout(closeBrowser, Math.max(0, closeAt - Date.now()) + 300);
}

async function closeBrowser() {
  const s = await get(["locked", "closeAt"]);
  if (!s.locked || !s.closeAt || Date.now() < s.closeAt - 500) return;   // cancelled, or too early
  await set({ closeAt: 0, closeHeld: false, locked: false, ringing: false });
  try {
    const tabs = await chrome.tabs.query({});
    await chrome.tabs.remove(tabs.map((t) => t.id).filter((id) => id != null));
  } catch (e) {}
  const wins = await chrome.windows.getAll();
  await Promise.allSettled(wins.map((w) => chrome.windows.remove(w.id)));
}

// A parent who starts entering the PIN gets 20 seconds, once per lock.
async function holdClose() {
  const s = await get(["closeAt", "closeHeld"]);
  if (!s.closeAt || s.closeHeld) return;
  await set({ closeAt: Date.now() + 20000, closeHeld: true });
  scheduleClose();
}

// ---------- full-screen windows ----------
async function openFullscreen(url) {
  for (const state of ["fullscreen", "maximized"]) {
    try { await chrome.windows.create({ url, state, focused: true }); return; } catch (e) {}
  }
  chrome.windows.create({ url, type: "popup", width: 900, height: 700, focused: true });
}

// ---------- live icon + badge ----------
async function refreshUI() {
  const s = await get(null);
  const now = Date.now();
  const o = iconOpts(s, now);
  try { await chrome.action.setIcon({ imageData: iconImageData(o) }); } catch (e) {}

  let text = "", color = ICON_COLORS[o.state];
  if (s.ringing) text = "!";
  else if (o.state === "paused") text = "II";
  else if (s.endTime) {
    const left = s.endTime - now;
    text = left <= 60000 ? "<1m" : Math.ceil(left / 60000) + "m";
  }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

let blinking = false;
async function blinkIcon() {
  if (blinking) return;
  blinking = true;
  let n = 0;
  const id = setInterval(async () => {
    n++;
    const { ringing } = await get("ringing");
    if (!ringing || n > 40) { clearInterval(id); blinking = false; refreshUI(); return; }
    try {
      await chrome.action.setIcon({ imageData: iconImageData({ state: "done", progress: 1, blink: n % 2 === 0 }) });
    } catch (e) {}
  }, 500);
}

// ---------- timer control ----------
async function startTimer(minutes, opts = {}) {
  // Check restrictions for kid mode unless bypassed by parent
  if (!opts.parentBypass && !opts.snooze) {
    const check = await checkKidRestrictions(minutes);
    if (!check.allowed) {
      return { ok: false, error: check.message, reason: check.reason };
    }
  }

  const duration = Math.round(minutes * 60 * 1000);
  const endTime = Date.now() + duration;
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(PREWARN);
  await chrome.alarms.create(ALARM, { when: endTime });
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 });

  // Schedule pre-warning 2 minutes before the timer ends if duration is > 2 mins
  if (minutes > 2) {
    await chrome.alarms.create(PREWARN, { when: endTime - 2 * 60 * 1000 });
  }

  const data = { endTime, duration, paused: false, idlePaused: false, idleStartedAt: 0 };
  if (opts.repeat !== undefined) data.repeat = !!opts.repeat;
  if (!opts.snooze) data.cycle = minutes;      // snooze must not change the repeat cycle
  if (!opts.keepRinging) { data.ringing = false; data.locked = false; data.closeAt = 0; }
  await set(data);
  await chrome.storage.local.remove("pausedLeft");
  await refreshUI();
  return { ok: true };
}

async function stopTimer() {
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(PREWARN);
  await chrome.alarms.clear(TICK);
  await set({ paused: false, ringing: false, locked: false, closeAt: 0, idlePaused: false, idleStartedAt: 0 });
  await chrome.storage.local.remove(["endTime", "duration", "pausedLeft"]);
  await restoreMediaVolume();
  await refreshUI();
}

async function pauseTimer() {
  const { endTime } = await get("endTime");
  if (!endTime) return;
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(PREWARN);
  await set({ paused: true, pausedLeft: Math.max(1000, endTime - Date.now()) });
  await chrome.storage.local.remove("endTime");
  await refreshUI();
}

async function resumeTimer() {
  const { pausedLeft } = await get("pausedLeft");
  if (!pausedLeft) return;
  const endTime = Date.now() + pausedLeft;
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(PREWARN);
  await chrome.alarms.create(ALARM, { when: endTime });
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 });
  if (pausedLeft > 120000) {
    await chrome.alarms.create(PREWARN, { when: endTime - 2 * 60 * 1000 });
  }
  await set({ endTime, paused: false, idlePaused: false, idleStartedAt: 0 });
  await chrome.storage.local.remove("pausedLeft");
  await refreshUI();
}

async function onPrewarn() {
  const s = await get(["kidMode", "prewarn", "notify", "volumeFade"]);
  if (s.prewarn === false || s.notify === false) return;
  const kid = s.kidMode !== false;

  // Fade tab media volume during 2-minute prewarn
  if (kid && s.volumeFade !== false) {
    await fadeMediaVolume();
  }

  chrome.notifications.create("eyePrewarnNotice", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: kid ? "Screen time almost done ⏳" : "Eye break in 2 minutes 👀",
    message: kid
      ? "2 minutes left! Time to wrap up your video and get ready to play."
      : "2 minutes left until your 20-20-20 eye break. Wrap up your current task!",
    priority: 1
  });
}

async function recordBreak() {
  const s = await get(["stats", "cycle"]);
  const stats = s.stats || {};
  const days = stats.days || {};
  days[today()] = (days[today()] || 0) + 1;
  const keys = Object.keys(days).sort();
  while (keys.length > 90) delete days[keys.shift()];
  
  const totalBreaks = (stats.totalBreaks || 0) + 1;
  const totalMinutes = (stats.totalMinutes || 0) + (s.cycle || 20);
  await set({ stats: { ...stats, days, totalBreaks, totalMinutes } });
}

async function recordSnooze() {
  const { stats } = await get("stats");
  const s = stats || {};
  const snoozes = s.snoozes || {};
  snoozes[today()] = (snoozes[today()] || 0) + 1;
  await set({ stats: { ...s, snoozes } });
}

// Parent entered the PIN on the lock screen.
async function unlock(pin, action) {
  const r = await verifyPin(pin);
  if (!r.ok) return r;
  chrome.notifications.clear("eyeDone");
  await set({ locked: false, ringing: false, closeAt: 0 });
  await restoreMediaVolume();
  if (action === "extend") {
    await resumeMedia();
    await startTimer(EXTEND_MINUTES, { snooze: true, parentBypass: true });
  } else {
    await refreshUI();
  }
  return { ok: true };
}

async function onTimerDone(opts = {}) {
  const s = await get(null);
  const kid = s.kidMode !== false;   // the Bye-bye video screen is the default
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  // Meeting Shield check for adult mode
  if (!kid && s.meetingShield !== false && !opts.force) {
    const inMeeting = await isMeetingActive();
    if (inMeeting) {
      chrome.notifications.create("meetingShield", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Meeting Shield Active 🛡️",
        message: "You are currently in a video call or meeting. Eye break deferred for 5 minutes.",
        priority: 1
      });
      await startTimer(5, { snooze: true });
      return;
    }
  }

  // Record screen time usage for kid mode
  if (kid && s.cycle) {
    await addKidUsage(s.cycle);
  }

  if (s.notify !== false) {
    chrome.notifications.create("eyeDone", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: kid ? "Screen time is over 🧸" : "Take care of your eyes 👀",
      message: kid
        ? (s.closeBrowser !== false ? "The browser will close in 10 seconds. Enter the parent PIN to stop it." : "Time to play something else. Enter the parent PIN to unlock.")
        : message,
      priority: 2,
      requireInteraction: true
    });
  }

  await set(kid ? { ringing: true, locked: true, closeAt: 0, closeHeld: false } : { ringing: true });
  if (s.pauseMedia !== false) await pauseMedia();

  if (kid) {
    await openFullscreen("lock.html");
    if (s.closeBrowser !== false) {
      await set({ closeAt: Date.now() + CLOSE_SECONDS * 1000 });
      scheduleClose();
    }
  } else {
    // Check break delivery mode: "fullscreen" (default) or "banner" (Gentle Mode)
    let bannerShown = false;
    if (s.breakDelivery === "banner") {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (activeTab && activeTab.id != null) {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["gentle-banner.js"]
          });
          bannerShown = true;
        }
      } catch (e) {
        bannerShown = false;
      }
    }

    if (!bannerShown) {
      const soundParam = s.sound !== false ? 1 : 0;
      const soundTypeParam = encodeURIComponent(s.soundType || "bowl");
      const ambientParam = s.ambientSound ? 1 : 0;
      const voiceParam = s.voiceGuidance ? 1 : 0;

      // Tiered Macro-break check (e.g. every 3rd or 4th break)
      let exerciseToUse = opts.exercise || s.preferredExercise || "rule";
      const totalDays = (s.stats && s.stats.days) || {};
      const breaksToday = totalDays[today()] || 0;
      const macroInterval = Number(s.macroInterval) || 3;
      if (!opts.exercise && macroInterval > 0 && breaksToday > 0 && (breaksToday % macroInterval === 0)) {
        exerciseToUse = "macro";
      }

      await openFullscreen("reminder.html?m=" + encodeURIComponent(message) +
        "&sound=" + soundParam +
        "&soundType=" + soundTypeParam +
        "&ambient=" + ambientParam +
        "&voice=" + voiceParam +
        "&exercise=" + encodeURIComponent(exerciseToUse));
    }
  }

  if (s.repeat && s.cycle) {
    await startTimer(s.cycle, { keepRinging: true, parentBypass: true });
  } else {
    await chrome.alarms.clear(TICK);
    await chrome.alarms.clear(PREWARN);
    await chrome.storage.local.remove(["endTime", "duration", "pausedLeft"]);
    await set({ paused: false });
  }
  blinkIcon();
  refreshUI();
}

// ---------- Smart Idle & Auto-Pause / Auto-Reset ----------
try {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
  chrome.idle.onStateChanged.addListener(async (newState) => {
    const s = await get(["idlePause", "idleResetMinutes", "endTime", "paused", "cycle", "idleStartedAt", "idlePaused"]);
    if (s.idlePause === false) return;

    if (newState === "idle" || newState === "locked") {
      // User stepped away or locked screen
      if (s.endTime && !s.paused) {
        const pausedLeft = Math.max(1000, s.endTime - Date.now());
        await chrome.alarms.clear(ALARM);
        await chrome.alarms.clear(PREWARN);
        await set({
          paused: true,
          pausedLeft,
          idlePaused: true,
          idleStartedAt: Date.now()
        });
        await chrome.storage.local.remove("endTime");
        await refreshUI();
      }
    } else if (newState === "active") {
      // User returned
      if (s.idlePaused) {
        const awayTime = s.idleStartedAt ? Date.now() - s.idleStartedAt : 0;
        const resetThreshold = (s.idleResetMinutes ?? 10) * 60 * 1000;

        if (resetThreshold > 0 && awayTime >= resetThreshold) {
          // User took a natural break away from the screen!
          await recordBreak();
          await set({ idlePaused: false, idleStartedAt: 0 });
          chrome.notifications.create("idleReset", {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "Welcome back! 🌿",
            message: "You were away for " + Math.round(awayTime / 60000) + " minutes (natural eye break). Timer refreshed!",
            priority: 1
          });
          await startTimer(s.cycle || 20, { parentBypass: true });
        } else {
          // Short absence: resume where paused
          await set({ idlePaused: false, idleStartedAt: 0 });
          await resumeTimer();
        }
      }
    }
  });
} catch (e) {}

// ---------- events ----------
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) onTimerDone();
  else if (alarm.name === TICK) refreshUI();
  else if (alarm.name === PREWARN) onPrewarn();
});

// ---------- keyboard commands ----------
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "take-break") {
    await onTimerDone({ force: true });
  } else if (command === "toggle-timer") {
    const s = await get(["endTime", "paused"]);
    if (s.paused) await resumeTimer();
    else if (s.endTime) await pauseTimer();
    else await startTimer(20);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const reply = (p) => p.then(sendResponse, () => sendResponse({ ok: false }));
  switch (msg.type) {
    case "start":                 reply(startTimer(msg.minutes, { repeat: msg.repeat, parentBypass: msg.parentBypass })); break;
    case "stop":                  reply(stopTimer().then(() => ({ ok: true }))); break;
    case "pause":                 reply(pauseTimer().then(() => ({ ok: true }))); break;
    case "resume":                reply(resumeTimer().then(() => ({ ok: true }))); break;
    case "snooze":                reply(recordSnooze().then(() => startTimer(msg.minutes || 5, { snooze: true, parentBypass: true })).then(() => ({ ok: true }))); break;
    case "taken":                 reply(recordBreak().then(() => ({ ok: true }))); break;
    case "launchBreak":           reply(onTimerDone({ exercise: msg.exercise, force: true }).then(() => ({ ok: true }))); break;
    case "ack":                   reply(set({ ringing: false }).then(refreshUI).then(() => ({ ok: true }))); break;
    case "resumeMedia":           reply(resumeMedia().then(() => ({ ok: true }))); break;
    case "syncWarmer":            reply(syncScreenWarmer().then(() => ({ ok: true }))); break;
    case "checkKidRestrictions":  reply(checkKidRestrictions(msg.minutes)); break;
    case "pinStatus":             reply(get("pinHash").then((s) => ({ set: !!s.pinHash }))); break;
    case "verifyPin":             reply(verifyPin(msg.pin)); break;
    case "setPin":                reply(setPin(msg.pin, msg.current)); break;
    case "unlock":                reply(unlock(msg.pin, msg.action)); break;
    case "enableSiteAccess":      reply(registerLockScript().then(injectIntoOpenTabs).then(syncScreenWarmer).then(() => ({ ok: true }))); break;
    case "disableSiteAccess":     reply(unregisterLockScript().then(syncScreenWarmer).then(() => ({ ok: true }))); break;
    case "holdClose":             reply(holdClose().then(() => ({ ok: true }))); break;
    case "closeBrowser":          reply(closeBrowser().then(() => ({ ok: true }))); break;
    case "resetStats":            reply(set({ stats: {}, kidDailyUsage: {} }).then(() => ({ ok: true }))); break;
    case "exportStats":           reply(get(["stats", "kidDailyUsage", "presets"]).then((data) => ({ ok: true, data }))); break;
    default: sendResponse({ ok: false });
  }
  return true;
});

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  await set({ ringing: false });
  refreshUI();
});

// Alarms don't survive a browser restart, so re-create them if time is left.
async function restore(startup) {
  const s = await get(["endTime", "locked"]);
  if (startup) await set({ closeAt: 0 });   // a restart cancels any countdown that was running
  if (s.endTime && s.endTime > Date.now()) {
    await chrome.alarms.create(ALARM, { when: s.endTime });
    await chrome.alarms.create(TICK, { periodInMinutes: 0.5 });
  } else if (s.endTime) {
    await chrome.storage.local.remove(["endTime", "duration"]);
  }
  if (await hasSites()) {
    registerLockScript().catch(() => {});
    syncScreenWarmer().catch(() => {});
  }
  refreshUI();
  if (startup && s.locked) openFullscreen("lock.html");   // still locked after a restart
}
chrome.runtime.onStartup.addListener(() => restore(true));
chrome.runtime.onInstalled.addListener(() => restore(false));

// If the worker was restarted mid-countdown, pick the countdown back up.
scheduleClose();
