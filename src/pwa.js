const installButton = document.querySelector("#installApp");
const offlineStatus = document.querySelector("#offlineStatus");
let installPrompt;
const standalone = matchMedia("(display-mode: standalone)");

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = standalone.matches;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = undefined;
  installButton.hidden = true;
  try { await prompt.prompt(); } catch { /* Browser-menu installation remains available. */ }
});
function hideInstallation() {
  if (standalone.matches) installButton.hidden = true;
}
standalone.addEventListener("change", hideInstallation);
window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  installButton.hidden = true;
});

function unavailable() {
  offlineStatus.textContent = "Offline noch nicht verfügbar";
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL("./sw.js", import.meta.url), { updateViaCache: "none" })
    .then(registration => {
      function status() {
        offlineStatus.textContent = registration.active?.state === "activated"
          ? "Offline verfügbar" : "Offline noch nicht verfügbar";
      }
      function watch(worker) {
        worker?.addEventListener("statechange", status);
      }
      status();
      watch(registration.installing);
      watch(registration.active);
      registration.addEventListener("updatefound", () => watch(registration.installing));
      navigator.serviceWorker.addEventListener("controllerchange", status);
    }).catch(unavailable);
} else {
  unavailable();
}
