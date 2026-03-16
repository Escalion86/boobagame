if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Silent fail keeps game usable even if SW registration is blocked.
    });
  });
}