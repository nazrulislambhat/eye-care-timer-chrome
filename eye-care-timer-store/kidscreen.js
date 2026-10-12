// The friendly "all done" screen. Rendered into a shadow root (page overlay)
// or straight into document.body (full-screen lock window).
const KS_CSS = `
.ks{position:fixed;top:0;left:0;right:0;bottom:0;background:#a4161a;color:#fff;
  font-family:ui-rounded,"Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif;
  overflow:hidden;display:grid;place-items:center;touch-action:none;user-select:none;-webkit-user-select:none}
.stage{position:relative;z-index:2;text-align:center;padding:0 5vw 10vh}
.sunny{width:clamp(140px,24vh,260px);height:auto;animation:bob 2.4s ease-in-out infinite}
.rays line{stroke:#ffb800;stroke-width:8;stroke-linecap:round}
.rays{transform-origin:100px 100px;animation:spin 24s linear infinite}
.wave{transform-origin:150px 128px;animation:wave 1.1s ease-in-out infinite}
h1{margin:.15em 0 0;font-size:clamp(40px,9vw,110px);line-height:1.05}
.done{margin:.1em 0 .45em;font-size:clamp(28px,5vw,60px);font-weight:700}
.idea{margin:0;font-size:clamp(20px,3.2vw,38px);font-weight:700}
.emoji{display:inline-block;font-size:1.3em;animation:hop 1.2s ease-in-out infinite}
.closing{margin-top:clamp(8px,1.6vh,20px);display:grid;justify-items:center;gap:6px}
.closing[hidden]{display:none}
.count{position:relative;width:clamp(72px,12vh,112px);aspect-ratio:1}
.count svg{width:100%;height:100%;transform:rotate(-90deg)}
.ctrack,.carc{fill:none;stroke-width:7}
.ctrack{stroke:rgba(255,255,255,.3)}
.carc{stroke:#fff;stroke-linecap:round;stroke-dasharray:214;stroke-dashoffset:0;transition:stroke-dashoffset .3s linear}
.num{position:absolute;top:0;left:0;right:0;bottom:0;display:grid;place-items:center;font-size:clamp(28px,5vh,46px);font-weight:700;font-variant-numeric:tabular-nums}
.cap{margin:0;font-size:clamp(15px,2vw,22px);font-weight:700}
.hills{position:absolute;left:0;right:0;bottom:0;width:100%;height:22vh;z-index:1}
.cloud{position:absolute;height:6vh;width:18vw;border-radius:999px;background:#fff;opacity:.22;z-index:0}
.c1{top:10%;left:-20vw;animation:drift 38s linear infinite}
.c2{top:26%;left:-20vw;width:12vw;animation:drift 52s linear infinite;animation-delay:-20s}
.parent{position:absolute;right:16px;bottom:14px;z-index:3;overflow:hidden;font:inherit;font-size:14px;
  color:#17325c;background:rgba(255,255,255,.6);border:0;border-radius:999px;padding:10px 16px;cursor:pointer}
.parent::after{content:"";position:absolute;left:0;bottom:0;height:3px;width:0;background:#a4161a}
.parent.holding::after{width:100%;transition:width 1.5s linear}
.modal{position:absolute;top:0;left:0;right:0;bottom:0;z-index:4;background:rgba(40,4,8,.62);display:grid;place-items:center}
.modal[hidden]{display:none}
.card{background:#fff;color:#3a0a0d;border-radius:20px;padding:24px 28px;max-width:92vw;
  --pp-ink:#3a0a0d;--pp-accent:#a4161a;--pp-line:#efcfd1;--pp-bg:#fff6f6}
.choices{display:grid;gap:12px;min-width:240px;text-align:center}
.choices h2{margin:0 0 4px;font-size:20px}
.choices button{font:inherit;font-weight:700;font-size:18px;padding:14px 18px;border-radius:14px;border:2px solid #a4161a;background:#fff;color:#3a0a0d;cursor:pointer}
.choices button.primary{background:#a4161a;color:#fff}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes wave{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes drift{to{transform:translateX(140vw)}}
@media (prefers-reduced-motion:reduce){.sunny,.rays,.wave,.emoji,.cloud{animation:none}.cloud{left:10vw}}
`;

function renderKidScreen(root, opts = {}) {
  const IDEAS = [
    ["🧱", "Let's build with blocks!"], ["💃", "Let's dance!"], ["🎨", "Let's draw!"],
    ["📖", "Let's read a book!"], ["🧸", "Let's play with teddy!"], ["🏃", "Let's run and jump!"]
  ];
  const idea = IDEAS[Math.floor(Math.random() * IDEAS.length)];
  let rays = "";
  for (let i = 0; i < 12; i++) rays += '<line x1="100" y1="14" x2="100" y2="30" transform="rotate(' + i * 30 + ' 100 100)"/>';

  const wrap = document.createElement("div");
  wrap.className = "ks";
  wrap.innerHTML =
    '<style>' + KS_CSS + '</style>' +
    '<div class="cloud c1"></div><div class="cloud c2"></div>' +
    '<main class="stage">' +
      '<svg class="sunny" viewBox="0 0 200 200" aria-hidden="true">' +
        '<g class="rays">' + rays + '</g>' +
        '<circle cx="100" cy="100" r="62" fill="#ffd23f"/>' +
        '<circle cx="76" cy="92" r="7" fill="#17325c"/><circle cx="124" cy="92" r="7" fill="#17325c"/>' +
        '<circle cx="78.5" cy="89.5" r="2.5" fill="#fff"/><circle cx="126.5" cy="89.5" r="2.5" fill="#fff"/>' +
        '<circle cx="62" cy="116" r="9" fill="#ff8fa3" opacity=".7"/><circle cx="138" cy="116" r="9" fill="#ff8fa3" opacity=".7"/>' +
        '<path d="M74 116 Q100 144 126 116" fill="none" stroke="#17325c" stroke-width="6" stroke-linecap="round"/>' +
        '<g class="wave"><path d="M150 128 Q172 118 176 92" fill="none" stroke="#f3b400" stroke-width="10" stroke-linecap="round"/>' +
        '<circle cx="177" cy="86" r="11" fill="#ffd23f" stroke="#f3b400" stroke-width="4"/></g>' +
      '</svg>' +
      '<h1>Bye-bye video!</h1><p class="done">All done!</p>' +
      '<p class="idea"><span class="emoji"></span> <span class="idea-text"></span></p>' +
      '<div class="closing" hidden><div class="count"><svg viewBox="0 0 80 80" aria-hidden="true">' +
      '<circle class="ctrack" cx="40" cy="40" r="34"/><circle class="carc" id="carc" cx="40" cy="40" r="34"/></svg>' +
      '<span class="num" role="timer">10</span></div><p class="cap">Closing the browser. See you later!</p></div>' +
    '</main>' +
    '<svg class="hills" viewBox="0 0 800 160" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0 90 Q200 10 400 80 T800 70 V160 H0Z" fill="#7d0f13"/>' +
      '<path d="M0 130 Q250 70 500 120 T800 110 V160 H0Z" fill="#5a0a0d"/></svg>' +
    '<button class="parent" type="button">Parent: hold to unlock</button>' +
    '<div class="modal" hidden><div class="card"></div></div>';
  wrap.querySelector(".emoji").textContent = idea[0];
  wrap.querySelector(".idea-text").textContent = idea[1];
  root.appendChild(wrap);

  // ---- countdown until the browser closes (the background worker does the closing) ----
  const closing = wrap.querySelector(".closing");
  const numEl = wrap.querySelector(".num");
  const carc = wrap.querySelector(".carc");
  let closeAt = 0, fired = false;
  function updateClose() {
    if (!closeAt) { closing.hidden = true; return; }
    closing.hidden = false;
    const ms = closeAt - Date.now();
    numEl.textContent = String(Math.max(0, Math.ceil(ms / 1000)));
    carc.style.strokeDashoffset = String(214 * (1 - Math.min(1, Math.max(0, ms) / 10000)));
    if (ms <= 0 && !fired) { fired = true; if (opts.onCountdownEnd) opts.onCountdownEnd(); }
  }
  chrome.storage.local.get("closeAt").then((s) => { closeAt = s.closeAt || 0; fired = false; updateClose(); });
  const onStore = (c, area) => {
    if (area === "local" && c.closeAt) { closeAt = c.closeAt.newValue || 0; fired = false; updateClose(); }
  };
  chrome.storage.onChanged.addListener(onStore);
  const closeTick = setInterval(updateClose, 250);

  const modal = wrap.querySelector(".modal");
  const card = wrap.querySelector(".card");
  const parentBtn = wrap.querySelector(".parent");
  let stage = "kid", pad = null, verifiedPin = "";

  async function submitPin(pin) {
    const r = await chrome.runtime.sendMessage({ type: "verifyPin", pin });
    if (r && r.ok) { verifiedPin = pin; setStage("choice"); }
    return r;
  }

  async function unlock(action) {
    const r = await chrome.runtime.sendMessage({ type: "unlock", pin: verifiedPin, action });
    if (!r || !r.ok) setStage("pin"); // the screen itself disappears via the storage change
  }

  function setStage(next) {
    stage = next;
    modal.hidden = next === "kid";
    card.replaceChildren();
    pad = null;
    if (next === "pin") {
      chrome.runtime.sendMessage({ type: "holdClose" });   // gives a parent a little extra time, once
      // No PIN set yet: skip the keypad and go straight to the choices.
      chrome.runtime.sendMessage({ type: "pinStatus" }).then((r) => {
        if (stage === "pin" && !(r && r.set)) { verifiedPin = ""; setStage("choice"); }
      });
      pad = createPinPad({ title: "Parent PIN", onSubmit: submitPin, onCancel: () => setStage("kid") });
      card.appendChild(pad.el);
    } else if (next === "choice") {
      const box = document.createElement("div");
      box.className = "choices";
      const h = document.createElement("h2"); h.textContent = "What now?";
      const more = document.createElement("button"); more.type = "button"; more.className = "primary";
      more.textContent = "10 more minutes"; more.onclick = () => unlock("extend");
      const done = document.createElement("button"); done.type = "button";
      done.textContent = "Close this screen"; done.onclick = () => unlock("done");
      box.append(h, more, done);
      card.appendChild(box);
    }
  }

  // Hold the Parent button for 1.5s so a tap from a toddler does nothing.
  let holdTimer = null;
  parentBtn.addEventListener("pointerdown", () => {
    parentBtn.classList.add("holding");
    holdTimer = setTimeout(() => { parentBtn.classList.remove("holding"); setStage("pin"); }, 1500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
    parentBtn.addEventListener(t, () => { clearTimeout(holdTimer); parentBtn.classList.remove("holding"); }));

  // Swallow every key so a toddler mashing the keyboard can't reach the page underneath.
  function onKey(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.type === "keydown" && stage === "pin" && pad) {
      if (e.key === "Escape") setStage("kid"); else pad.handleKey(e);
    }
  }
  const keyTypes = ["keydown", "keyup", "keypress"];
  keyTypes.forEach((t) => window.addEventListener(t, onKey, true));

  return {
    destroy() {
      keyTypes.forEach((t) => window.removeEventListener(t, onKey, true));
      clearTimeout(holdTimer);
      clearInterval(closeTick);
      chrome.storage.onChanged.removeListener(onStore);
      wrap.remove();
    }
  };
}
