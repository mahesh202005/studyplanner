(function initializeDateUtils(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});
  const { DAYS } = App.constants;

  function toDate(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getTodayKey() {
    return getDateKey(new Date());
  }

  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function daysUntil(value) {
    const target = toDate(value);
    if (!target) {
      return null;
    }

    const today = startOfDay(new Date());
    const compareDate = startOfDay(target);
    return Math.round((compareDate - today) / 86400000);
  }

  function formatDate(value, options) {
    const parsed = toDate(value);
    if (!parsed) {
      return "No date";
    }

    return parsed.toLocaleDateString("en-GB", options || {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    const parsed = toDate(value);
    if (!parsed) {
      return "No date";
    }

    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatLongDate(value) {
    const parsed = toDate(value);
    if (!parsed) {
      return "No date";
    }

    return parsed.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatTime(value) {
    const parsed = toDate(value);
    const target = parsed || new Date();
    return target.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatRelativeDue(dueDate, status) {
    const diff = daysUntil(dueDate);

    if (status === "completed") {
      return "Completed";
    }

    if (diff === null) {
      return "No due date";
    }

    if (diff < 0) {
      return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
    }

    if (diff === 0) {
      return "Due today";
    }

    return `${diff} day${diff === 1 ? "" : "s"} left`;
  }

  function getCountdownParts(value) {
    const target = toDate(value);
    if (!target) {
      return null;
    }

    const diffMs = target.getTime() - Date.now();
    const absoluteMs = Math.max(diffMs, 0);
    const totalSeconds = Math.floor(absoluteMs / 1000);

    return {
      expired: diffMs <= 0,
      totalSeconds,
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }

  function formatCountdown(value) {
    const countdown = getCountdownParts(value);
    if (!countdown) {
      return "--";
    }

    if (countdown.expired) {
      return "Live now";
    }

    return `${String(countdown.days).padStart(2, "0")}d ${String(countdown.hours).padStart(2, "0")}h ${String(countdown.minutes).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s`;
  }

  function getWeekDays(referenceDate) {
    const reference = startOfDay(referenceDate || new Date());
    const dayIndex = (reference.getDay() + 6) % 7;
    const monday = addDays(reference, -dayIndex);

    return DAYS.map((day, index) => {
      const actualDate = addDays(monday, index);
      return {
        ...day,
        key: getDateKey(actualDate),
        date: actualDate,
        isToday: getDateKey(actualDate) === getTodayKey()
      };
    });
  }

  function getLastDateKeys(amount) {
    const today = startOfDay(new Date());
    return Array.from({ length: amount }, (_, index) => getDateKey(addDays(today, index - (amount - 1))));
  }

  function getMonthProgress(history, referenceDate) {
    const reference = referenceDate ? new Date(referenceDate) : new Date();
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let completed = 0;

    Object.keys(history || {}).forEach((key) => {
      const parsed = toDate(key);
      if (!parsed) {
        return;
      }

      if (parsed.getFullYear() === year && parsed.getMonth() === month && history[key]) {
        completed += 1;
      }
    });

    return {
      completed,
      total: daysInMonth,
      percentage: daysInMonth ? Math.round((completed / daysInMonth) * 100) : 0
    };
  }

  function getStreakStatsFromKeys(keys) {
    const uniqueKeys = [...new Set((keys || []).filter(Boolean))].sort();
    if (!uniqueKeys.length) {
      return { current: 0, longest: 0 };
    }

    let longest = 1;
    let running = 1;

    for (let index = 1; index < uniqueKeys.length; index += 1) {
      const previous = startOfDay(new Date(`${uniqueKeys[index - 1]}T00:00:00`));
      const current = startOfDay(new Date(`${uniqueKeys[index]}T00:00:00`));
      const diff = Math.round((current - previous) / 86400000);
      if (diff === 1) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 1;
      }
    }

    let current = 0;
    let cursor = startOfDay(new Date());
    const keySet = new Set(uniqueKeys);

    while (keySet.has(getDateKey(cursor))) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    return { current, longest };
  }

  function isOverdue(dueDate, status) {
    const diff = daysUntil(dueDate);
    return status !== "completed" && typeof diff === "number" && diff < 0;
  }

  App.dateUtils = {
    addDays,
    daysUntil,
    formatCountdown,
    formatDate,
    formatDateTime,
    formatLongDate,
    formatRelativeDue,
    formatTime,
    getCountdownParts,
    getDateKey,
    getLastDateKeys,
    getMonthProgress,
    getStreakStatsFromKeys,
    getTodayKey,
    getWeekDays,
    isOverdue,
    startOfDay,
    toDate
  };
})(window);
