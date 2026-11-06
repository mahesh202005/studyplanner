(function initializeConstants(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});

  App.constants = {
    APP_NAME: "Student Productivity Dashboard",
    APP_VERSION: "1.0.0",
    STORAGE_KEY: "studentProductivityDashboard.v1",
    LEGACY_STORAGE_KEY: "studentPlannerProData",
    LEGACY_THEME_KEY: "studentPlannerProTheme",
    LEGACY_NOTIFICATION_KEY: "studentPlannerProNotifications",
    SECTION_ORDER: ["overview", "planner", "habits", "analytics", "focus", "settings"],
    SECTION_LABELS: {
      overview: "Overview",
      planner: "Planner",
      habits: "Habits",
      analytics: "Analytics",
      focus: "Focus Lab",
      settings: "Settings"
    },
    PLANNER_TABS: ["assignments", "exams", "weekly"],
    DAYS: [
      { index: 0, short: "Mon", long: "Monday" },
      { index: 1, short: "Tue", long: "Tuesday" },
      { index: 2, short: "Wed", long: "Wednesday" },
      { index: 3, short: "Thu", long: "Thursday" },
      { index: 4, short: "Fri", long: "Friday" },
      { index: 5, short: "Sat", long: "Saturday" },
      { index: 6, short: "Sun", long: "Sunday" }
    ],
    THEMES: [
      { id: "midnight", label: "Midnight", note: "Deep glass dashboard" },
      { id: "daylight", label: "Daylight", note: "Bright and airy" },
      { id: "ember", label: "Ember", note: "Warm study late nights" },
      { id: "ocean", label: "Ocean", note: "Cool and calm" }
    ],
    ASSIGNMENT_STATUSES: {
      todo: { label: "To do", accent: "status-todo" },
      in_progress: { label: "In progress", accent: "status-in_progress" },
      completed: { label: "Completed", accent: "status-completed" }
    },
    PRIORITY_OPTIONS: {
      low: { level: "low", label: "Low", score: 1 },
      medium: { level: "medium", label: "Medium", score: 2 },
      high: { level: "high", label: "High", score: 3 }
    },
    POMODORO_PRESETS: {
      focus25: { id: "focus25", label: "25 / 5", mode: "work", durationSeconds: 25 * 60, nextMode: "shortBreak" },
      shortBreak: { id: "shortBreak", label: "Short break", mode: "shortBreak", durationSeconds: 5 * 60, nextMode: "work" },
      longBreak: { id: "longBreak", label: "Long break", mode: "longBreak", durationSeconds: 15 * 60, nextMode: "work" }
    },
    QUOTES: [
      "Small study systems beat dramatic last-minute effort.",
      "Clarity lowers stress. A visible plan creates calm momentum.",
      "Protect your attention first. Productivity follows.",
      "One focused session today is worth more than vague guilt all week.",
      "Consistency compounds faster than motivation."
    ],
    KEYBOARD_SHORTCUTS: [
      { keys: "?", description: "Open shortcut help" },
      { keys: "N", description: "New assignment" },
      { keys: "E", description: "New exam" },
      { keys: "H", description: "New habit" },
      { keys: "T", description: "New weekly task" },
      { keys: "P", description: "Start or pause pomodoro" },
      { keys: "F", description: "Toggle focus mode" },
      { keys: "/", description: "Jump to assignment search" }
    ],
    DEFAULT_COLLAPSED_SECTIONS: {
      planner: true,
      habits: true,
      analytics: true,
      focus: true,
      settings: true
    }
  };
})(window);
