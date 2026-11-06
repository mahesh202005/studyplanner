(function initializeHelpers(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseCsvList(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }

    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createMap(items, mapper) {
    const byId = {};
    const allIds = [];

    safeArray(items).forEach((item) => {
      const normalized = mapper(item);
      byId[normalized.id] = normalized;
      allIds.push(normalized.id);
    });

    return { byId, allIds };
  }

  function reorderId(list, id, targetIndex) {
    const copy = [...list];
    const currentIndex = copy.indexOf(id);

    if (currentIndex === -1) {
      return copy;
    }

    copy.splice(currentIndex, 1);
    copy.splice(targetIndex, 0, id);
    return copy;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function downloadJson(filename, content) {
    const blob = new Blob([content], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
      reader.readAsText(file);
    });
  }

  function isTypingTarget(element) {
    if (!element) {
      return false;
    }

    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    return tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable;
  }

  function playTone(frequency, durationMs, volume) {
    if (!global.AudioContext && !global.webkitAudioContext) {
      return;
    }

    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    global.setTimeout(() => {
      oscillator.stop();
      context.close();
    }, durationMs);
  }

  App.helpers = {
    clamp,
    createMap,
    createUuid,
    deepClone,
    downloadJson,
    escapeHtml,
    isTypingTarget,
    nowIso,
    parseCsvList,
    playTone,
    readFileAsText,
    reorderId,
    safeArray,
    safeObject
  };
})(window);
