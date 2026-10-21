// Shared 4-digit keypad. Used by the popup, the lock overlay and the reminder window.
const PINPAD_CSS = `
.pp{display:grid;justify-items:center;gap:12px;color:var(--pp-ink,#0f172a);font-family:inherit}
.pp-title{font-weight:750;font-size:17px;text-align:center;letter-spacing:-0.01em}
.pp-dots{display:flex;gap:12px;height:20px;align-items:center}
.pp-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--pp-accent,#10b981);box-sizing:border-box;transition:all .15s}
.pp-dot.on{background:var(--pp-accent,#10b981);box-shadow:0 0 8px rgba(16,185,129,.4)}
.pp-grid{display:grid;grid-template-columns:repeat(3,62px);gap:8px}
.pp-grid button,.pp-grid span{height:48px}
.pp-grid button{font:inherit;font-size:19px;font-weight:650;border-radius:12px;border:1px solid var(--pp-line,#e2e8f0);background:var(--pp-bg,#fff);color:inherit;cursor:pointer;touch-action:manipulation;transition:all .12s}
.pp-grid button:hover{border-color:var(--pp-accent,#10b981);background:rgba(16,185,129,.05)}
.pp-grid button:active{transform:scale(.95)}
.pp-grid button:focus-visible{outline:2px solid var(--pp-accent,#10b981);outline-offset:2px}
.pp-msg{min-height:20px;font-size:13px;font-weight:600;color:var(--pp-msg,#ef4444);text-align:center}
.pp.shake{animation:ppshake .35s}
@keyframes ppshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@media (prefers-reduced-motion:reduce){.pp.shake{animation:none}}
`;

function createPinPad({ title = "Enter PIN", onSubmit, onCancel }) {
  const el = document.createElement("div");
  el.className = "pp";
  el.innerHTML = '<style>' + PINPAD_CSS + '</style><div class="pp-title"></div>' +
    '<div class="pp-dots" role="status"></div><div class="pp-grid"></div><div class="pp-msg" role="alert"></div>';
  el.querySelector(".pp-title").textContent = title;
  const dotsEl = el.querySelector(".pp-dots");
  const grid = el.querySelector(".pp-grid");
  const msgEl = el.querySelector(".pp-msg");
  let pin = "", busy = false;

  function render() {
    dotsEl.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const d = document.createElement("span");
      d.className = "pp-dot" + (i < pin.length ? " on" : "");
      dotsEl.appendChild(d);
    }
    dotsEl.setAttribute("aria-label", pin.length + " of 4 digits entered");
  }

  async function press(d) {
    if (busy || pin.length >= 4) return;
    pin += d;
    msgEl.textContent = "";
    render();
    if (pin.length === 4) {
      busy = true;
      const entered = pin;
      let r;
      try { r = await onSubmit(entered); } catch (e) { r = { ok: false }; }
      busy = false;
      pin = "";
      render();
      if (r && !r.ok) {
        msgEl.textContent = r.wait ? "Too many tries. Wait " + r.wait + " seconds." : "Wrong PIN. Try again.";
        el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      }
    }
  }
  function back() { if (!busy) { pin = pin.slice(0, -1); render(); } }

  function btn(label, aria, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-label", aria); b.onclick = fn;
    return b;
  }
  for (let i = 1; i <= 9; i++) grid.appendChild(btn(String(i), String(i), () => press(String(i))));
  if (onCancel) grid.appendChild(btn("✕", "Cancel", onCancel)); else grid.appendChild(document.createElement("span"));
  grid.appendChild(btn("0", "0", () => press("0")));
  grid.appendChild(btn("⌫", "Delete", back));
  render();

  // Returns true if the key was used by the keypad.
  function handleKey(e) {
    if (/^[0-9]$/.test(e.key)) { press(e.key); return true; }
    if (e.key === "Backspace") { back(); return true; }
    return false;
  }
  return { el, handleKey };
}
