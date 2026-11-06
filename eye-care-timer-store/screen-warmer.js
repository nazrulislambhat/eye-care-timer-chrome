// In-Browser Screen Warmer (Blue Light Filter)
(() => {
  const ID = "eyecare-screen-warmer-layer";

  function applyWarmth(settings) {
    let layer = document.getElementById(ID);
    if (!settings.blueLightFilter) {
      if (layer) layer.remove();
      return;
    }

    if (!layer) {
      layer = document.createElement("div");
      layer.id = ID;
      layer.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: 2147483646 !important;
        mix-blend-mode: multiply !important;
        transition: background-color 0.4s ease !important;
      `;
      (document.body || document.documentElement).appendChild(layer);
    }

    const warmth = Math.min(0.6, Math.max(0.1, (settings.blueLightWarmth || 35) / 100));
    // Warm amber color
    layer.style.backgroundColor = `rgba(255, 165, 45, ${warmth * 0.45})`;
  }

  chrome.storage.local.get(["blueLightFilter", "blueLightWarmth"]).then(applyWarmth);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.blueLightFilter || changes.blueLightWarmth)) {
      chrome.storage.local.get(["blueLightFilter", "blueLightWarmth"]).then(applyWarmth);
    }
  });
})();

