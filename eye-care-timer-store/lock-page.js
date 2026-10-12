renderKidScreen(document.body, { onCountdownEnd: () => chrome.runtime.sendMessage({ type: "closeBrowser" }) });
const closeMe = () => chrome.windows.getCurrent((w) => chrome.windows.remove(w.id));
chrome.storage.local.get("locked").then(({ locked }) => { if (!locked) closeMe(); });
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c.locked && !c.locked.newValue) closeMe();
});
