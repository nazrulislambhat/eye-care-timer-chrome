// The friendly "all done" screen. Rendered into a shadow root (page overlay)
// or straight into document.body (full-screen lock window).
const KS_CSS = `
.ks{position:fixed;top:0;left:0;right:0;bottom:0;color:#fff;
  font-family:ui-rounded,"Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif;
  overflow:hidden;display:grid;place-items:center;touch-action:none;user-select:none;-webkit-user-select:none;
  background:radial-gradient(circle at 50% 30%, #c1121f 0%, #780016 100%);
  transition:background .5s ease}
.ks.theme-night{background:radial-gradient(ellipse at bottom, #1b263b 0%, #0d1b2a 100%)}
.stage{position:relative;z-index:2;text-align:center;padding:0 5vw 8vh}
.mascot-wrap{display:inline-block;position:relative}
.sunny{width:clamp(140px,24vh,260px);height:auto;animation:bob 2.4s ease-in-out infinite}
.rays line{stroke:#ffb800;stroke-width:8;stroke-linecap:round}
.rays{transform-origin:100px 100px;animation:spin 24s linear infinite}
.wave{transform-origin:150px 128px;animation:wave 1.1s ease-in-out infinite}
.moon-stars{display:none}
.theme-night .sunny-rays{display:none}
.theme-night .moon-stars{display:block}
.stars{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.star{position:absolute;background:#fff;border-radius:50%;opacity:.8;animation:twinkle 2s infinite ease-in-out}
h1{margin:.15em 0 0;font-size:clamp(38px,8.5vw,100px);line-height:1.05;text-shadow:0 3px 12px rgba(0,0,0,.25)}
.done{margin:.1em 0 .45em;font-size:clamp(26px,4.8vw,56px);font-weight:700;opacity:.95}
.idea{margin:0;font-size:clamp(18px,3vw,34px);font-weight:700;display:inline-flex;align-items:center;gap:8px;
  background:rgba(255,255,255,.15);backdrop-filter:blur(10px);padding:8px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.25)}
.emoji{display:inline-block;font-size:1.3em;animation:hop 1.2s ease-in-out infinite}
.closing{margin-top:clamp(10px,2vh,24px);display:grid;justify-items:center;gap:6px}
.closing[hidden]{display:none}
.count{position:relative;width:clamp(74px,12vh,114px);aspect-ratio:1}
.count svg{width:100%;height:100%;transform:rotate(-90deg)}
.ctrack,.carc{fill:none;stroke-width:7}
.ctrack{stroke:rgba(255,255,255,.25)}
.carc{stroke:#fff;stroke-linecap:round;stroke-dasharray:214;stroke-dashoffset:0;transition:stroke-dashoffset .3s linear;filter:drop-shadow(0 0 6px rgba(255,255,255,.5))}
.num{position:absolute;top:0;left:0;right:0;bottom:0;display:grid;place-items:center;font-size:clamp(28px,5vh,48px);font-weight:800;font-variant-numeric:tabular-nums}
.cap{margin:0;font-size:clamp(15px,2vw,22px);font-weight:700;opacity:.95}
.hills{position:absolute;left:0;right:0;bottom:0;width:100%;height:22vh;z-index:1;transition:opacity .5s}
.theme-night .hills{opacity:.4}
.cloud{position:absolute;height:6vh;width:18vw;border-radius:999px;background:#fff;opacity:.22;z-index:0}
.c1{top:10%;left:-20vw;animation:drift 38s linear infinite}
.c2{top:26%;left:-20vw;width:12vw;animation:drift 52s linear infinite;animation-delay:-20s}
.parent{position:absolute;right:18px;bottom:16px;z-index:3;overflow:hidden;font:inherit;font-size:14px;font-weight:600;
  color:#17325c;background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border:0;border-radius:999px;padding:10px 18px;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .15s}
.parent:active{transform:scale(.97)}
.parent::after{content:"";position:absolute;left:0;bottom:0;height:4px;width:0;background:#c1121f}
.parent.holding::after{width:100%;transition:width 1.5s linear}
.modal{position:absolute;top:0;left:0;right:0;bottom:0;z-index:4;background:rgba(10,5,15,.75);backdrop-filter:blur(8px);display:grid;place-items:center}
.modal[hidden]{display:none}
.card{background:#fff;color:#1c1917;border-radius:24px;padding:26px 30px;max-width:92vw;box-shadow:0 12px 36px rgba(0,0,0,.35);
  --pp-ink:#1c1917;--pp-accent:#c1121f;--pp-line:#e7e5e4;--pp-bg:#fafaf9}
.choices{display:grid;gap:12px;min-width:260px;text-align:center}
.choices h2{margin:0 0 6px;font-size:22px;font-weight:750}
.choices button{font:inherit;font-weight:700;font-size:17px;padding:14px 20px;border-radius:14px;border:2px solid #c1121f;background:#fff;color:#1c1917;cursor:pointer;transition:transform .12s}
.choices button:active{transform:scale(.97)}
.choices button.primary{background:#c1121f;color:#fff}
.confetti-canvas{position:absolute;inset:0;pointer-events:none;z-index:5}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes wave{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes drift{to{transform:translateX(140vw)}}
@keyframes twinkle{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}
@media (prefers-reduced-motion:reduce){.sunny,.rays,.wave,.emoji,.cloud,.star{animation:none}.cloud{left:10vw}}
`;

function renderKidScreen(root, opts = {}) {
  const DAY_IDEAS = [
    ["🧱", "Let's build with blocks!"], ["💃", "Let's dance!"], ["🎨", "Let's draw!"],
    ["📖", "Let's read a book!"], ["🧸", "Let's play with teddy!"], ["🏃", "Let's run and jump!"],
    ["🧩", "Let's solve a puzzle!"]
  ];
  const NIGHT_IDEAS = [
    ["📖", "Time for a bedtime story!"], ["🧸", "Let's tuck in teddy!"], ["🪥", "Time to brush teeth!"],
    ["⭐", "Let's count the stars!"], ["💤", "Time for sweet dreams!"]
  ];

  let rays = "";
  for (let i = 0; i < 12; i++) rays += '<line x1="100" y1="14" x2="100" y2="30" transform="rotate(' + i * 30 + ' 100 100)"/>';

  const wrap = document.createElement("div");
  wrap.className = "ks";
  wrap.innerHTML =
    '<style>' + KS_CSS + '</style>' +
    '<canvas class="confetti-canvas"></canvas>' +
    '<div class="stars" id="starsBox"></div>' +
    '<div class="cloud c1"></div><div class="cloud c2"></div>' +
    '<main class="stage">' +
      '<div class="mascot-wrap">' +
        '<div class="sunny-rays">' +
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
        '</div>' +
        '<div class="moon-stars">' +
          '<svg class="sunny" viewBox="0 0 200 200" aria-hidden="true">' +
            '<path d="M120 40 A65 65 0 1 0 160 145 A52 52 0 0 1 120 40 Z" fill="#ffd23f"/>' +
            '<circle cx="95" cy="95" r="6" fill="#0d1b2a"/>' +
            '<circle cx="97" cy="93" r="2" fill="#fff"/>' +
            '<path d="M84 115 Q96 128 108 115" fill="none" stroke="#0d1b2a" stroke-width="5" stroke-linecap="round"/>' +
            '<circle cx="82" cy="110" r="7" fill="#ff8fa3" opacity=".6"/>' +
            '<g class="wave"><path d="M140 120 Q160 110 165 90" fill="none" stroke="#f3b400" stroke-width="8" stroke-linecap="round"/>' +
            '<circle cx="165" cy="85" r="9" fill="#ffd23f"/></g>' +
          '</svg>' +
        '</div>' +
      '</div>' +
      '<h1 id="kidTitle">Bye-bye video!</h1>' +
      '<p class="done" id="kidDone">All done!</p>' +
      '<p class="idea"><span class="emoji"></span> <span class="idea-text"></span></p>' +
      '<div class="closing" hidden><div class="count"><svg viewBox="0 0 80 80" aria-hidden="true">' +
      '<circle class="ctrack" cx="40" cy="40" r="34"/><circle class="carc" id="carc" cx="40" cy="40" r="34"/></svg>' +
      '<span class="num" role="timer">10</span></div><p class="cap" id="closingCap">Closing the browser. See you later!</p></div>' +
    '</main>' +
    '<svg class="hills" viewBox="0 0 800 160" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0 90 Q200 10 400 80 T800 70 V160 H0Z" fill="#7d0f13"/>' +
      '<path d="M0 130 Q250 70 500 120 T800 110 V160 H0Z" fill="#5a0a0d"/></svg>' +
    '<button class="parent" type="button">Parent: hold to unlock</button>' +
    '<div class="modal" hidden><div class="card"></div></div>';

  root.appendChild(wrap);

  // Generate background stars for night mode
  const starsBox = wrap.querySelector("#starsBox");
  for (let i = 0; i < 35; i++) {
    const s = document.createElement("span");
    s.className = "star";
    s.style.top = Math.random() * 100 + "%";
    s.style.left = Math.random() * 100 + "%";
    const size = Math.random() * 3 + 2;
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.animationDelay = (Math.random() * 3) + "s";
    starsBox.appendChild(s);
  }

  // Theme & Voice handling
  chrome.storage.local.get(["kidTheme", "kidSpeech"]).then(({ kidTheme, kidSpeech }) => {
    const isNight = kidTheme === "night";
    if (isNight) {
      wrap.classList.add("theme-night");
      wrap.querySelector("#kidTitle").textContent = "Good night video! 🌙";
      wrap.querySelector("#kidDone").textContent = "All done for today!";
      wrap.querySelector("#closingCap").textContent = "Closing the browser. Sweet dreams!";
    }
    const pool = isNight ? NIGHT_IDEAS : DAY_IDEAS;
    const idea = pool[Math.floor(Math.random() * pool.length)];
    wrap.querySelector(".emoji").textContent = idea[0];
    wrap.querySelector(".idea-text").textContent = idea[1];

    // Friendly offline speech synthesis
    if (kidSpeech !== false && "speechSynthesis" in window) {
      try {
        const text = isNight ? "Good night video! Time for sleep! Sweet dreams." : "Bye-bye video! All done! Great job!";
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        u.pitch = 1.15;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  });

  // Confetti particles
  const canvas = wrap.querySelector(".confetti-canvas");
  let confettiAnim = null;
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const particles = [];
    const colors = ["#ffd23f", "#ff8fa3", "#4cc2ae", "#ffffff", "#ffb800", "#a2d2ff"];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltInc: Math.random() * 0.07 + 0.05
      });
    }
    function drawConfetti() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.tiltAngle += p.tiltInc;
        p.y += (Math.cos(p.d) + 1 + p.r / 2) / 2;
        p.x += Math.sin(0.01 * p.y);
        p.tilt = Math.sin(p.tiltAngle) * 12;
        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
        ctx.stroke();
        if (p.y > height) {
          p.x = Math.random() * width;
          p.y = -10;
        }
      });
      confettiAnim = requestAnimationFrame(drawConfetti);
    }
    drawConfetti();
  }

  // ---- countdown until the browser closes ----
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
    if (!r || !r.ok) setStage("pin");
  }

  function setStage(next) {
    stage = next;
    modal.hidden = next === "kid";
    card.replaceChildren();
    pad = null;
    if (next === "pin") {
      chrome.runtime.sendMessage({ type: "holdClose" });
      chrome.runtime.sendMessage({ type: "pinStatus" }).then((r) => {
        if (stage === "pin" && !(r && r.set)) { verifiedPin = ""; setStage("choice"); }
      });
      pad = createPinPad({ title: "Parent PIN", onSubmit: submitPin, onCancel: () => setStage("kid") });
      card.appendChild(pad.el);
    } else if (next === "choice") {
      const box = document.createElement("div");
      box.className = "choices";
      const h = document.createElement("h2"); h.textContent = "Parent Options";
      const more = document.createElement("button"); more.type = "button"; more.className = "primary";
      more.textContent = "+10 more minutes"; more.onclick = () => unlock("extend");
      const done = document.createElement("button"); done.type = "button";
      done.textContent = "Close this screen"; done.onclick = () => unlock("done");
      box.append(h, more, done);
      card.appendChild(box);
    }
  }

  let holdTimer = null;
  parentBtn.addEventListener("pointerdown", () => {
    parentBtn.classList.add("holding");
    holdTimer = setTimeout(() => { parentBtn.classList.remove("holding"); setStage("pin"); }, 1500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
    parentBtn.addEventListener(t, () => { clearTimeout(holdTimer); parentBtn.classList.remove("holding"); }));

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
      if (confettiAnim) cancelAnimationFrame(confettiAnim);
      chrome.storage.onChanged.removeListener(onStore);
      wrap.remove();
    }
  };
}
