// Shared by the background worker (importScripts) and the popup (<script>).
// Draws the live toolbar icon: a progress ring around an eye.

const ICON_COLORS = {
  idle: "#1f7a6d", running: "#1f7a6d", warn: "#d98e04",
  urgent: "#d64545", paused: "#7b8a87", done: "#c1121f"
};

// Turns stored timer state into {state, progress} for the icon.
function iconOpts(s, now) {
  if (s.ringing) return { state: "done", progress: 1 };
  if (s.paused && s.pausedLeft != null && s.duration) {
    return { state: "paused", progress: 1 - s.pausedLeft / s.duration };
  }
  if (s.endTime && s.duration) {
    const left = Math.max(0, s.endTime - now);
    const state = left <= 60000 ? "urgent" : left <= 300000 ? "warn" : "running";
    return { state, progress: 1 - left / s.duration };
  }
  return { state: "idle", progress: 0 };
}

function drawIcon(size, { state = "idle", progress = 0, blink = false }) {
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext("2d");
  const cx = size / 2;
  const r = size / 2;

  g.beginPath();
  g.arc(cx, cx, r - 0.5, 0, Math.PI * 2);
  g.fillStyle = ICON_COLORS[state] || ICON_COLORS.idle;
  g.fill();

  // ring: faint track + white arc for the time still remaining
  const lw = Math.max(1.6, size * 0.11);
  const rr = r - lw / 2 - 0.5;
  g.lineWidth = lw;
  g.strokeStyle = "rgba(255,255,255,0.28)";
  g.beginPath(); g.arc(cx, cx, rr, 0, Math.PI * 2); g.stroke();

  g.strokeStyle = "#ffffff";
  g.beginPath();
  if (state === "done") {
    g.arc(cx, cx, rr, 0, Math.PI * 2);
  } else if (state !== "idle") {
    const start = -Math.PI / 2;
    g.arc(cx, cx, rr, start, start + Math.PI * 2 * Math.max(0.001, 1 - progress));
  }
  g.stroke();

  // eye
  const ew = size * 0.46, eh = blink ? size * 0.04 : size * 0.27;
  g.fillStyle = "#ffffff";
  g.beginPath(); g.ellipse(cx, cx, ew, eh, 0, 0, Math.PI * 2); g.fill();
  if (!blink) {
    g.fillStyle = "#12342f";
    g.beginPath(); g.arc(cx, cx, size * 0.115, 0, Math.PI * 2); g.fill();
  }
  return g.getImageData(0, 0, size, size);
}

function iconImageData(opts) {
  return { 16: drawIcon(16, opts), 32: drawIcon(32, opts) };
}
