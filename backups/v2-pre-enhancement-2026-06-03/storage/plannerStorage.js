(function initializePlannerStorage(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});
  const {
    APP_NAME,
    APP_VERSION,
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    LEGACY_THEME_KEY,
    LEGACY_NOTIFICATION_KEY,
    PRIORITY_OPTIONS,
    THEMES,
    DEFAULT_COLLAPSED_SECTIONS,
    POMODORO_PRESETS
  } = App.constants;
  const { createMap, createUuid, deepClone, nowIso, parseCsvList, safeArray, safeObject } = App.helpers;
  const {
    addDays,
    getDateKey,
    getLastDateKeys,
    getMonthProgress,
    getStreakStatsFromKeys,
    getTodayKey,
    getWeekDays,
    startOfDay,
    toDate
  } = App.dateUtils;
  const memoryStore = {};

  function getStorageKey(baseKey) {
    if (baseKey === LEGACY_STORAGE_KEY || baseKey === LEGACY_THEME_KEY || baseKey === LEGACY_NOTIFICATION_KEY) {
      return baseKey;
    }

    if (App.auth && typeof App.auth.getScopedStorageKey === "function") {
      return App.auth.getScopedStorageKey(baseKey);
    }

    return baseKey;
  }

  function readStorage(key) {
    const resolvedKey = getStorageKey(key);
    try {
      return global.localStorage.getItem(resolvedKey);
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memoryStore, resolvedKey) ? memoryStore[resolvedKey] : null;
    }
  }

  function writeStorage(key, value) {
    const resolvedKey = getStorageKey(key);
    memoryStore[resolvedKey] = value;

    try {
      global.localStorage.setItem(resolvedKey, value);
    } catch (error) {
      console.warn("Persistent storage is unavailable. Using in-memory state for this session.", error);
    }
  }

  function normalizePriority(rawPriority) {
    const key = String(rawPriority && rawPriority.level ? rawPriority.level : rawPriority || "medium")
      .trim()
      .toLowerCase();

    return PRIORITY_OPTIONS[key] || PRIORITY_OPTIONS.medium;
  }

  function defaultFocusTimer() {
    const preset = POMODORO_PRESETS.focus25;
    return {
      mode: preset.mode,
      presetId: preset.id,
      durationSeconds: preset.durationSeconds,
      running: false,
      endsAt: null,
      startedAt: null,
      cycleCount: 0,
      activeLabel: "Ready for a focused session"
    };
  }

  function normalizeAssignment(rawAssignment) {
    const raw = safeObject(rawAssignment);
    const status = raw.status || (raw.complete ? "completed" : "todo");
    const priority = normalizePriority(raw.priority);
    const completedAt = status === "completed" ? raw.completedAt || raw.completed_at || nowIso() : null;

    return {
      id: String(raw.id || createUuid()),
      title: String(raw.title || "Untitled assignment").trim(),
      description: String(raw.description || ""),
      subject: String(raw.subject || "General"),
      tags: parseCsvList(raw.tags),
      status,
      priority,
      dueDate: String(raw.dueDate || raw.due_date || ""),
      createdAt: raw.createdAt || raw.created_at || nowIso(),
      completedAt,
      attachments: safeArray(raw.attachments).map((item) => String(item)),
      notes: String(raw.notes || "")
    };
  }

  function normalizeExam(rawExam) {
    const raw = safeObject(rawExam);
    return {
      id: String(raw.id || createUuid()),
      name: String(raw.name || "Untitled exam").trim(),
      subject: String(raw.subject || "General"),
      date: String(raw.date || ""),
      notes: String(raw.notes || ""),
      location: String(raw.location || ""),
      reminderDays: safeArray(raw.reminderDays).map((item) => Number(item)).filter((item) => !Number.isNaN(item)),
      createdAt: raw.createdAt || nowIso()
    };
  }

  function normalizeHabit(rawHabit) {
    const raw = safeObject(rawHabit);
    const history = {};

    Object.entries(safeObject(raw.history)).forEach(([key, value]) => {
      if (value) {
        history[key] = true;
      }
    });

    return {
      id: String(raw.id || createUuid()),
      name: String(raw.name || "New habit").trim(),
      target: {
        frequency: String((raw.target && raw.target.frequency) || "daily"),
        goal: Number((raw.target && raw.target.goal) || raw.goal || 1)
      },
      history,
      createdAt: raw.createdAt || nowIso()
    };
  }

  function normalizeWeeklyTask(rawTask) {
    const raw = safeObject(rawTask);
    const rawDate = typeof raw.date === "string" ? raw.date.slice(0, 10) : "";
    const fallbackDate = rawDate || (Number.isInteger(raw.day)
      ? getDateKey(addDays(startOfDay(new Date()), raw.day - ((new Date().getDay() + 6) % 7)))
      : getDateKey(startOfDay(new Date())));
    const startTime = String(raw.startTime || raw.time || "").trim();

    return {
      id: String(raw.id || createUuid()),
      title: String(raw.title || "New study task").trim(),
      date: fallbackDate,
      day: Number.isInteger(raw.day) ? raw.day : Number(raw.day || 0),
      startTime,
      notes: String(raw.notes || ""),
      status: String(raw.status || "planned"),
      createdAt: raw.createdAt || nowIso()
    };
  }

  function normalizeFocusSession(rawSession) {
    const raw = safeObject(rawSession);
    return {
      id: String(raw.id || createUuid()),
      mode: String(raw.mode || "work"),
      minutes: Number(raw.minutes || 0),
      label: String(raw.label || "Focus session"),
      startedAt: raw.startedAt || nowIso(),
      completedAt: raw.completedAt || nowIso()
    };
  }

  function normalizeCollection(rawCollection, normalizer) {
    if (Array.isArray(rawCollection)) {
      return createMap(rawCollection, normalizer);
    }

    const collection = safeObject(rawCollection);
    const ids = safeArray(collection.allIds);
    const byId = safeObject(collection.byId);
    const sourceItems = ids.length ? ids.map((id) => byId[id]).filter(Boolean) : Object.values(byId);
    return createMap(sourceItems, normalizer);
  }

  function mapLegacyTheme(legacyTheme) {
    if (!legacyTheme) {
      return "midnight";
    }

    const lookup = {
      T: "midnight",
      O: "ocean",
      S: "ember",
      G: "midnight",
      L: "daylight"
    };

    return lookup[legacyTheme] || legacyTheme;
  }

  function isValidTheme(themeId) {
    return THEMES.some((theme) => theme.id === themeId);
  }

  function getCurrentSemesterLabel() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (month >= 1 && month <= 5) {
      return `Spring ${year}`;
    }

    if (month >= 6 && month <= 8) {
      return `Summer ${year}`;
    }

    return `Fall ${year}`;
  }

  function getCurrentMonthKey(referenceDate) {
    const reference = startOfDay(referenceDate || new Date());
    const year = reference.getFullYear();
    const month = String(reference.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function normalizeSettings(rawSettings, legacyState) {
    const raw = safeObject(rawSettings);
    const legacyTheme = readStorage(LEGACY_THEME_KEY) || safeObject(legacyState).theme;
    const theme = isValidTheme(raw.theme) ? raw.theme : mapLegacyTheme(legacyTheme || "midnight");
    const browserPermission = global.Notification ? global.Notification.permission : "default";
    const storedPermission = readStorage(LEGACY_NOTIFICATION_KEY) || browserPermission;
    const notifications = safeObject(raw.notifications);
    const sounds = safeObject(raw.sounds);
    const preferences = safeObject(raw.preferences);
    const profile = safeObject(raw.profile);

    return {
      theme: isValidTheme(theme) ? theme : "midnight",
      profile: {
        name: typeof profile.name === "string" ? profile.name : "",
        semester: typeof profile.semester === "string" && profile.semester.trim()
          ? profile.semester.trim()
          : getCurrentSemesterLabel()
      },
      notifications: {
        enabled: typeof notifications.enabled === "boolean" ? notifications.enabled : storedPermission === "granted",
        permission: notifications.permission || storedPermission || "default",
        reminderWindows: {
          assignments: safeArray(notifications.reminderWindows && notifications.reminderWindows.assignments).length
            ? notifications.reminderWindows.assignments
            : [3, 1, 0],
          exams: safeArray(notifications.reminderWindows && notifications.reminderWindows.exams).length
            ? notifications.reminderWindows.exams
            : [7, 3, 1, 0]
        },
        history: safeObject(notifications.history)
      },
      sounds: {
        enabled: sounds.enabled !== false,
        volume: typeof sounds.volume === "number" ? sounds.volume : 0.18
      },
      preferences: {
        sidebarCollapsed: Boolean(preferences.sidebarCollapsed),
        focusMode: Boolean(preferences.focusMode),
        activeSection: preferences.activeSection || "overview",
        activePlannerTab: preferences.activePlannerTab || "assignments",
        currentPlannerMonthKey: preferences.currentPlannerMonthKey || getCurrentMonthKey(),
        assignmentSearch: preferences.assignmentSearch || "",
        assignmentStatusFilter: preferences.assignmentStatusFilter || "all",
        assignmentPriorityFilter: preferences.assignmentPriorityFilter || "all",
        assignmentSubjectFilter: preferences.assignmentSubjectFilter || "",
        assignmentSort: preferences.assignmentSort || "dueSoon",
        collapsedSections: {
          ...DEFAULT_COLLAPSED_SECTIONS,
          ...safeObject(preferences.collapsedSections)
        }
      }
    };
  }

  function legacyHabitHistory(days) {
    const history = {};
    const weekDays = getWeekDays(new Date());

    safeArray(days).forEach((value, index) => {
      if (value && weekDays[index]) {
        history[weekDays[index].key] = true;
      }
    });

    return history;
  }

  function createSeedState() {
    const createdAt = nowIso();
    const currentUser = App.auth && typeof App.auth.getCurrentUser === "function" ? App.auth.getCurrentUser() : null;
    const assignments = [
      {
        title: "Data structures assignment #3",
        description: "Implement graph traversals and submit the reflection summary.",
        subject: "CSE301",
        tags: ["coding", "graphs"],
        status: "todo",
        priority: "high",
        dueDate: getDateKey(addDays(new Date(), 3)),
        notes: "Review BFS edge cases before submission."
      },
      {
        title: "Marketing case study report",
        description: "Prepare the final deck and add competitor research screenshots.",
        subject: "MBA201",
        tags: ["presentation", "research"],
        status: "in_progress",
        priority: "medium",
        dueDate: getDateKey(addDays(new Date(), 5)),
        notes: "Need two more case comparisons."
      },
      {
        title: "Physics lab report",
        description: "Finalize calculations and attach experiment photos.",
        subject: "PHY102",
        tags: ["lab", "report"],
        status: "todo",
        priority: "low",
        dueDate: getDateKey(addDays(new Date(), 8)),
        notes: ""
      }
    ];
    const exams = [
      {
        name: "Algorithms mid-term",
        subject: "CSE301",
        date: new Date(Date.now() + 11 * 86400000).toISOString(),
        reminderDays: [7, 3, 1],
        notes: "Revise dynamic programming and greedy proofs."
      },
      {
        name: "Marketing finals",
        subject: "MBA201",
        date: new Date(Date.now() + 18 * 86400000).toISOString(),
        reminderDays: [7, 3, 1],
        notes: "Practice two long-form case answers."
      }
    ];
    const habits = [
      { name: "Study 2 focused hours", history: { [getTodayKey()]: true } },
      { name: "Review notes", history: {} },
      { name: "No phone before class", history: {} }
    ];
    const weeklyTasks = [
      { title: "Revise DSA chapter 5", date: getDateKey(addDays(startOfDay(new Date()), 1)), notes: "Solve 3 extra questions." },
      { title: "Physics numerics", date: getDateKey(addDays(startOfDay(new Date()), 3)), notes: "" },
      { title: "Marketing reading", date: getDateKey(addDays(startOfDay(new Date()), 5)), notes: "Chapter 7 summary." }
    ];

    return {
      meta: {
        appName: APP_NAME,
        version: APP_VERSION,
        createdAt,
        lastUpdated: createdAt
      },
      settings: {
        ...normalizeSettings({}, {}),
        profile: {
          name: currentUser && currentUser.name ? currentUser.name : "",
          semester: getCurrentSemesterLabel()
        }
      },
      planner: {
        assignments: createMap(assignments, normalizeAssignment),
        exams: createMap(exams, normalizeExam),
        habits: createMap(habits, normalizeHabit),
        weeklyTasks: createMap(weeklyTasks, normalizeWeeklyTask),
        focusTimer: defaultFocusTimer()
      },
      analytics: {
        heatmap: {},
        weeklyProgress: {},
        streaks: {},
        focusSessions: {
          sessions: [],
          totals: { completedSessions: 0, totalFocusMinutes: 0, todayMinutes: 0 }
        }
      }
    };
  }

  function migrateLegacyState(legacyState) {
    const legacy = safeObject(legacyState);
    const assignments = safeArray(legacy.assignments).map((assignment) => ({
      ...assignment,
      description: "",
      tags: [],
      status: assignment.complete ? "completed" : "todo",
      notes: assignment.complete ? "Migrated completed assignment." : "Migrated from the legacy planner."
    }));
    const exams = safeArray(legacy.exams).map((exam) => ({
      ...exam,
      reminderDays: [7, 3, 1],
      notes: "Migrated from the legacy planner."
    }));
    const habits = safeArray(legacy.habits).map((habit) => ({
      id: habit.id,
      name: habit.name,
      history: legacyHabitHistory(habit.days)
    }));
    const weeklyTasks = safeArray(legacy.weeklyTasks).map((task) => ({
      ...task,
      notes: "Migrated from the legacy weekly planner."
    }));

    return {
      meta: {
        appName: APP_NAME,
        version: APP_VERSION,
        createdAt: nowIso(),
        lastUpdated: nowIso()
      },
      settings: normalizeSettings({ theme: mapLegacyTheme(legacy.theme) }, legacy),
      planner: {
        assignments: createMap(assignments, normalizeAssignment),
        exams: createMap(exams, normalizeExam),
        habits: createMap(habits, normalizeHabit),
        weeklyTasks: createMap(weeklyTasks, normalizeWeeklyTask),
        focusTimer: {
          ...defaultFocusTimer(),
          durationSeconds: safeObject(legacy.pomodoro).timeLeft || defaultFocusTimer().durationSeconds,
          cycleCount: safeObject(legacy.pomodoro).cycles || 0,
          activeLabel: safeObject(legacy.pomodoro).activeLabel || "Migrated focus session"
        }
      },
      analytics: {
        heatmap: {},
        weeklyProgress: {},
        streaks: {},
        focusSessions: {
          sessions: [],
          totals: { completedSessions: 0, totalFocusMinutes: 0, todayMinutes: 0 }
        }
      }
    };
  }

  function normalizeFocusTimer(rawTimer) {
    const raw = safeObject(rawTimer);
    const preset = POMODORO_PRESETS[raw.presetId] || POMODORO_PRESETS.focus25;

    return {
      ...defaultFocusTimer(),
      ...raw,
      presetId: preset.id,
      mode: raw.mode || preset.mode,
      durationSeconds: Number(raw.durationSeconds || preset.durationSeconds),
      cycleCount: Number(raw.cycleCount || 0)
    };
  }

  function normalizePlanner(rawPlanner) {
    const planner = safeObject(rawPlanner);
    return {
      assignments: normalizeCollection(planner.assignments, normalizeAssignment),
      exams: normalizeCollection(planner.exams, normalizeExam),
      habits: normalizeCollection(planner.habits, normalizeHabit),
      weeklyTasks: normalizeCollection(planner.weeklyTasks, normalizeWeeklyTask),
      focusTimer: normalizeFocusTimer(planner.focusTimer)
    };
  }

  function normalizeState(rawState) {
    if (!rawState) {
      return createSeedState();
    }

    if (rawState.meta && rawState.settings && rawState.planner) {
      const createdAt = rawState.meta.createdAt || nowIso();
      return {
        meta: {
          appName: rawState.meta.appName || APP_NAME,
          version: APP_VERSION,
          createdAt,
          lastUpdated: rawState.meta.lastUpdated || createdAt
        },
        settings: normalizeSettings(rawState.settings, {}),
        planner: normalizePlanner(rawState.planner),
        analytics: safeObject(rawState.analytics)
      };
    }

    if (rawState.assignments || rawState.exams || rawState.weeklyTasks || rawState.habits) {
      return migrateLegacyState(rawState);
    }

    return createSeedState();
  }

  function buildHeatmap(state) {
    const heatmap = {};

    Object.values(state.planner.assignments.byId).forEach((assignment) => {
      if (assignment.completedAt) {
        const key = getDateKey(startOfDay(new Date(assignment.completedAt)));
        heatmap[key] = (heatmap[key] || 0) + 1;
      }
    });

    Object.values(state.planner.habits.byId).forEach((habit) => {
      Object.entries(habit.history).forEach(([key, value]) => {
        if (value) {
          heatmap[key] = (heatmap[key] || 0) + 1;
        }
      });
    });

    safeArray(state.analytics.focusSessions && state.analytics.focusSessions.sessions).forEach((session) => {
      if (session.completedAt && session.mode === "work") {
        const key = getDateKey(startOfDay(new Date(session.completedAt)));
        heatmap[key] = (heatmap[key] || 0) + 1;
      }
    });

    return heatmap;
  }

  function buildWeeklyProgress(state) {
    const keys = getLastDateKeys(7);
    const focusSessions = safeArray(state.analytics.focusSessions && state.analytics.focusSessions.sessions);

    return {
      labels: keys.map((key) => key.slice(5)),
      assignments: keys.map((key) =>
        Object.values(state.planner.assignments.byId).filter((assignment) => {
          return assignment.completedAt && getDateKey(startOfDay(new Date(assignment.completedAt))) === key;
        }).length
      ),
      habits: keys.map((key) =>
        Object.values(state.planner.habits.byId).reduce((count, habit) => {
          return count + (habit.history[key] ? 1 : 0);
        }, 0)
      ),
      focusMinutes: keys.map((key) =>
        focusSessions
          .filter((session) => session.mode === "work" && getDateKey(startOfDay(new Date(session.completedAt))) === key)
          .reduce((sum, session) => sum + Number(session.minutes || 0), 0)
      )
    };
  }

  function buildStreaks(state) {
    const assignmentKeys = Object.values(state.planner.assignments.byId)
      .filter((assignment) => assignment.completedAt)
      .map((assignment) => getDateKey(startOfDay(new Date(assignment.completedAt))));
    const focusKeys = safeArray(state.analytics.focusSessions && state.analytics.focusSessions.sessions)
      .filter((session) => session.mode === "work")
      .map((session) => getDateKey(startOfDay(new Date(session.completedAt))));
    const habits = {};

    Object.values(state.planner.habits.byId).forEach((habit) => {
      habits[habit.id] = getStreakStatsFromKeys(Object.keys(habit.history).filter((key) => habit.history[key]));
    });

    return {
      assignments: getStreakStatsFromKeys(assignmentKeys),
      habits,
      focus: getStreakStatsFromKeys(focusKeys)
    };
  }

  function buildFocusSessions(state) {
    const sessions = safeArray(state.analytics.focusSessions && state.analytics.focusSessions.sessions).map(normalizeFocusSession);
    const todayKey = getTodayKey();
    const workSessions = sessions.filter((session) => session.mode === "work");

    return {
      sessions,
      totals: {
        completedSessions: workSessions.length,
        totalFocusMinutes: workSessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0),
        todayMinutes: workSessions
          .filter((session) => getDateKey(startOfDay(new Date(session.completedAt))) === todayKey)
          .reduce((sum, session) => sum + Number(session.minutes || 0), 0)
      }
    };
  }

  function rebuildAnalytics(state) {
    const draft = deepClone(state);
    const focusSessions = buildFocusSessions(draft);
    draft.analytics.focusSessions = focusSessions;

    return {
      heatmap: buildHeatmap(draft),
      weeklyProgress: buildWeeklyProgress(draft),
      streaks: buildStreaks(draft),
      focusSessions
    };
  }

  function saveState(nextState) {
    const normalized = normalizeState(nextState);
    normalized.meta.version = APP_VERSION;
    normalized.meta.lastUpdated = nowIso();
    normalized.analytics = rebuildAnalytics(normalized);
    writeStorage(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function loadState() {
    try {
      const current = readStorage(STORAGE_KEY);
      if (current) {
        return saveState(JSON.parse(current));
      }

      const legacy = readStorage(LEGACY_STORAGE_KEY);
      if (legacy) {
        return saveState(JSON.parse(legacy));
      }
    } catch (error) {
      console.warn("Unable to load saved dashboard state. Resetting.", error);
    }

    return saveState(createSeedState());
  }

  function mutateState(currentState, recipe) {
    const draft = deepClone(currentState);
    recipe(draft);
    return saveState(draft);
  }

  function importState(importedState) {
    return saveState(importedState);
  }

  function resetState() {
    return saveState(createSeedState());
  }

  function exportState(state) {
    return JSON.stringify(state, null, 2);
  }

  App.storage = {
    defaultFocusTimer,
    exportState,
    importState,
    loadState,
    mutateState,
    normalizeAssignment,
    normalizeExam,
    normalizeFocusSession,
    normalizeHabit,
    normalizeState,
    normalizeWeeklyTask,
    rebuildAnalytics,
    resetState,
    saveState
  };
})(window);
