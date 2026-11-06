(function initializeAuth(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});
  const USER_STORE_KEY = "studentProductivityDashboard.auth.users.v1";
  const SESSION_STORE_KEY = "studentProductivityDashboard.auth.session.v1";
  const memoryStore = {};
  let currentMode = "signin";

  function readStorage(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    }
  }

  function writeStorage(key, value) {
    memoryStore[key] = value;

    try {
      global.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Unable to persist auth data to local storage.", error);
    }
  }

  function removeStorage(key) {
    delete memoryStore[key];

    try {
      global.localStorage.removeItem(key);
    } catch (error) {
      console.warn("Unable to remove auth data from local storage.", error);
    }
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function loadUsers() {
    try {
      const raw = readStorage(USER_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Unable to read saved auth users.", error);
      return [];
    }
  }

  function saveUsers(users) {
    writeStorage(USER_STORE_KEY, JSON.stringify(users));
  }

  function readSession() {
    try {
      const raw = readStorage(SESSION_STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSession(user) {
    writeStorage(
      SESSION_STORE_KEY,
      JSON.stringify({
        email: user.email,
        name: user.name || "",
        loggedInAt: new Date().toISOString()
      })
    );
  }

  function clearSession() {
    removeStorage(SESSION_STORE_KEY);
  }

  function encodePassword(password) {
    try {
      return global.btoa(unescape(encodeURIComponent(password)));
    } catch (error) {
      return password;
    }
  }

  function decodePassword(password) {
    try {
      return decodeURIComponent(escape(global.atob(password)));
    } catch (error) {
      return password;
    }
  }

  function validateCredentials(email, password) {
    if (!normalizeEmail(email)) {
      return "Enter your email address.";
    }

    if (!String(password || "").trim()) {
      return "Enter your password.";
    }

    if (String(password).length < 6) {
      return "Password must be at least 6 characters.";
    }

    return "";
  }

  function signup(payload) {
    const name = String(payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const error = validateCredentials(email, password);
    if (error) {
      return { ok: false, message: error };
    }

    const users = loadUsers();
    if (users.some((user) => user.email === email)) {
      return { ok: false, message: "That email already has an account. Please sign in instead." };
    }

    const user = {
      id: `user-${Date.now()}`,
      name: name || email.split("@")[0],
      email,
      password: encodePassword(password),
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);
    saveSession(user);
    return { ok: true, user };
  }

  function signin(payload) {
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const error = validateCredentials(email, password);
    if (error) {
      return { ok: false, message: error };
    }

    const users = loadUsers();
    const user = users.find((entry) => entry.email === email);
    if (!user) {
      return { ok: false, message: "No account was found for that email. Create one first." };
    }

    if (decodePassword(user.password) !== password) {
      return { ok: false, message: "Incorrect password. Try again." };
    }

    saveSession(user);
    return { ok: true, user };
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session || !session.email) {
      return null;
    }

    const user = loadUsers().find((entry) => entry.email === normalizeEmail(session.email));
    if (!user) {
      clearSession();
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }

  function getScopedStorageKey(baseKey) {
    const user = getCurrentUser();
    if (!user) {
      return baseKey;
    }

    return `${baseKey}.${normalizeEmail(user.email)}`;
  }

  function showPlanner() {
    const authShell = document.getElementById("authShell");
    const appShell = document.getElementById("appShell");
    const accountChip = document.getElementById("accountChip");
    const user = getCurrentUser();

    if (authShell) {
      authShell.hidden = true;
    }

    if (appShell) {
      appShell.hidden = false;
    }

    if (accountChip && user) {
      accountChip.textContent = user.email;
    }
  }

  function showAuth() {
    const authShell = document.getElementById("authShell");
    const appShell = document.getElementById("appShell");

    if (authShell) {
      authShell.hidden = false;
    }

    if (appShell) {
      appShell.hidden = true;
    }

    document.body.classList.remove("is-booting");
  }

  function setError(message) {
    const errorEl = document.getElementById("authError");
    if (!errorEl) {
      return;
    }

    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }

  function setMode(mode) {
    currentMode = mode === "signup" ? "signup" : "signin";

    const authNameGroup = document.getElementById("authNameGroup");
    const authName = document.getElementById("authName");
    const authHelpText = document.getElementById("authHelpText");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    const authPassword = document.getElementById("authPassword");

    if (authNameGroup) {
      authNameGroup.hidden = currentMode !== "signup";
    }

    if (authName) {
      authName.required = currentMode === "signup";
    }

    if (authPassword) {
      authPassword.autocomplete = currentMode === "signup" ? "new-password" : "current-password";
    }

    if (authHelpText) {
      authHelpText.textContent =
        currentMode === "signup"
          ? "Create a local account for this browser and start using your personal planner."
          : "Sign in with your saved account to open the dashboard.";
    }

    if (authSubmitBtn) {
      authSubmitBtn.textContent = currentMode === "signup" ? "Create account" : "Sign in";
    }

    if (signInTab) {
      signInTab.classList.toggle("is-active", currentMode === "signin");
      signInTab.setAttribute("aria-selected", currentMode === "signin" ? "true" : "false");
    }

    if (signUpTab) {
      signUpTab.classList.toggle("is-active", currentMode === "signup");
      signUpTab.setAttribute("aria-selected", currentMode === "signup" ? "true" : "false");
    }

    setError("");
  }

  function handleAuthSubmit(event) {
    event.preventDefault();

    const nameInput = document.getElementById("authName");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const payload = {
      name: nameInput ? nameInput.value : "",
      email: emailInput ? emailInput.value : "",
      password: passwordInput ? passwordInput.value : ""
    };

    const result = currentMode === "signup" ? signup(payload) : signin(payload);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError("");
    showPlanner();

    if (App.app && typeof App.app.init === "function") {
      App.app.init();
    }
  }

  function handleModeSwitch(event) {
    const button = event.target.closest("[data-auth-mode]");
    if (!button) {
      return;
    }

    setMode(button.dataset.authMode);
  }

  function logout() {
    clearSession();
    global.location.reload();
  }

  function bindAuthUi() {
    const authForm = document.getElementById("authForm");
    const authCard = document.querySelector(".auth-card");
    const logoutBtn = document.getElementById("logoutBtn");

    if (authForm) {
      authForm.addEventListener("submit", handleAuthSubmit);
    }

    if (authCard) {
      authCard.addEventListener("click", handleModeSwitch);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  }

  function init() {
    bindAuthUi();
    if (getCurrentUser()) {
      showPlanner();
      return true;
    }

    showAuth();
    setMode("signin");
    return false;
  }

  App.auth = {
    getCurrentUser,
    getScopedStorageKey,
    init,
    isAuthenticated: function isAuthenticated() {
      return Boolean(getCurrentUser());
    },
    logout,
    signin,
    signup
  };
})(window);
