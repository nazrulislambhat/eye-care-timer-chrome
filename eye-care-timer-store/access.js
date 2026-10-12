const $ = (id) => document.getElementById(id);
const SITES = { origins: ["<all_urls>"] };

async function refresh() {
  const on = await chrome.permissions.contains(SITES);
  $("status").textContent = on
    ? "On: every tab is covered and media is paused at break time."
    : "Off: the Bye-bye video screen opens in its own full-screen window.";
  $("allow").hidden = on;
  $("remove").hidden = !on;
}
$("allow").onclick = async () => {
  const ok = await chrome.permissions.request(SITES);   // must come from a click on this page
  if (ok) await chrome.runtime.sendMessage({ type: "enableSiteAccess" });
  refresh();
};
$("remove").onclick = async () => {
  await chrome.permissions.remove(SITES);
  await chrome.runtime.sendMessage({ type: "disableSiteAccess" });
  refresh();
};
refresh();
