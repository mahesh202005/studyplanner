(function bootstrapDashboard(global) {
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (global.location.protocol === "file:") {
      return;
    }

    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  }

  global.addEventListener("DOMContentLoaded", () => {
    try {
      const isAuthenticated =
        global.StudentDashboard &&
        global.StudentDashboard.auth &&
        typeof global.StudentDashboard.auth.init === "function"
          ? global.StudentDashboard.auth.init()
          : true;

      if (isAuthenticated && global.StudentDashboard && global.StudentDashboard.app) {
        global.StudentDashboard.app.init();
        registerServiceWorker();
      }
    } catch (error) {
      console.error("Dashboard boot failed.", error);
      document.body.classList.remove("is-booting");

      const overviewSection = document.getElementById("section-overview");
      if (overviewSection) {
        overviewSection.innerHTML = `
          <div class="empty-state">
            <div>
              <h3>Dashboard failed to load</h3>
              <p>${String(error && error.message ? error.message : error)}</p>
            </div>
          </div>
        `;
      }
    }
  });
})(window);
