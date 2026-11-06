// Gentle Mode Break Banner - non-intrusive floating HUD at top of screen
(() => {
  if (document.getElementById("eyecare-gentle-banner-host")) return;

  const host = document.createElement("div");
  host.id = "eyecare-gentle-banner-host";
  host.style.cssText = "all:initial;position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;display:block;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
  const root = host.attachShadow({ mode: "open" });

  const LOOK_SECONDS = 20;
  let remaining = LOOK_SECONDS;
  let timerId = null;

  const style = document.createElement("style");
  style.textContent = `
    .hud {
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(6, 20, 18, 0.94);
      border: 1px solid rgba(52, 211, 153, 0.4);
      color: #f0fdf4;
      padding: 10px 18px;
      border-radius: 999px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(52, 211, 153, 0.2);
      backdrop-filter: blur(16px);
      animation: slideDown .3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideDown {
      from { transform: translateY(-40px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .hud.closing {
      animation: slideUp .25s ease forwards;
    }
    @keyframes slideUp {
      to { transform: translateY(-40px); opacity: 0; }
    }
    .eye-icon {
      font-size: 20px;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      font-size: 13px;
      font-weight: 700;
      color: #a7f3d0;
      letter-spacing: 0.02em;
    }
    .sub {
      font-size: 12px;
      color: #94a3b8;
    }
    .countdown-ring {
      position: relative;
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
    }
    .countdown-ring svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .track {
      fill: none;
      stroke: rgba(255, 255, 255, 0.15);
      stroke-width: 3;
    }
    .arc {
      fill: none;
      stroke: #34d399;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 88;
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1s linear;
    }
    .count-num {
      position: absolute;
      font-size: 12px;
      font-weight: 800;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 6px;
    }
    button {
      all: unset;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 999px;
      transition: all .15s ease;
      box-sizing: border-box;
    }
    .btn-done {
      background: #10b981;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    }
    .btn-done:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .btn-snooze {
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .btn-snooze:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }
  `;

  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="eye-icon">👀</div>
    <div class="countdown-ring">
      <svg viewBox="0 0 32 32">
        <circle class="track" cx="16" cy="16" r="14" />
        <circle class="arc" id="gentleArc" cx="16" cy="16" r="14" />
      </svg>
      <span class="count-num" id="gentleCount">${remaining}</span>
    </div>
    <div class="info">
      <div class="title" id="gentleTitle">20-20-20 Eye Break</div>
      <div class="sub" id="gentleSub">Look 20 feet away to relax ciliary muscles</div>
    </div>
    <div class="actions">
      <button class="btn-snooze" id="gentleSnooze">5m</button>
      <button class="btn-done" id="gentleDone">Done</button>
    </div>
  `;

  root.appendChild(style);
  root.appendChild(hud);
  document.documentElement.appendChild(host);

  const arc = root.getElementById("gentleArc");
  const countEl = root.getElementById("gentleCount");
  const CIRC = 88; // 2 * PI * 14

  function dismiss() {
    if (timerId) clearInterval(timerId);
    hud.classList.add("closing");
    setTimeout(() => {
      host.remove();
    }, 260);
  }

  timerId = setInterval(() => {
    remaining--;
    countEl.textContent = Math.max(remaining, 0);
    arc.style.strokeDashoffset = String(CIRC * (1 - Math.max(remaining, 0) / LOOK_SECONDS));

    if (remaining <= 0) {
      clearInterval(timerId);
      countEl.textContent = "✓";
      root.getElementById("gentleTitle").textContent = "Rest Complete!";
      root.getElementById("gentleSub").textContent = "Great work protecting your vision.";
      chrome.runtime.sendMessage({ type: "taken" });
      setTimeout(dismiss, 3000);
    }
  }, 1000);

  root.getElementById("gentleDone").onclick = () => {
    chrome.runtime.sendMessage({ type: "taken" });
    dismiss();
  };

  root.getElementById("gentleSnooze").onclick = () => {
    chrome.runtime.sendMessage({ type: "snooze", minutes: 5 });
    dismiss();
  };
})();

