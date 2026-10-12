// Runs on every page. While the timer has locked the screen, covers the page
// with the kid screen and keeps any media paused.
(() => {
  let host = null, ctl = null, mediaTimer = null, observer = null;

  // While locked, stop pages from showing "Leave site?" prompts so the browser can close cleanly.
  window.addEventListener("beforeunload", (e) => { if (host) e.stopImmediatePropagation(); }, true);

  const pauseAll = () => document.querySelectorAll("video, audio").forEach((m) => {
    if (!m.paused && !m.ended) { m.dataset.eyecarePaused = "1"; m.pause(); }
  });

  async function show() {
    if (host || !document.documentElement) return;
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;display:block;";
    const root = host.attachShadow({ mode: "closed" });
    ctl = renderKidScreen(root);
    document.documentElement.appendChild(host);
    document.documentElement.style.setProperty("overflow", "hidden", "important");

    observer = new MutationObserver(() => {
      if (host && !host.isConnected && document.documentElement) document.documentElement.appendChild(host);
    });
    observer.observe(document.documentElement, { childList: true });

    const { pauseMedia } = await chrome.storage.local.get("pauseMedia");
    if (host && pauseMedia !== false) { pauseAll(); mediaTimer = setInterval(pauseAll, 1000); }
  }

  function hide() {
    if (!host) return;
    if (ctl) ctl.destroy();
    host.remove();
    host = null; ctl = null;
    clearInterval(mediaTimer); mediaTimer = null;
    if (observer) { observer.disconnect(); observer = null; }
    document.documentElement.style.removeProperty("overflow");
  }

  chrome.storage.local.get("locked").then(({ locked }) => { if (locked) show(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.locked) (changes.locked.newValue ? show : hide)();
  });
})();
