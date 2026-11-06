(function initializeDashboardApp(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});
  const { templates, storage, helpers, dateUtils, constants } = App;
  const {
    APP_NAME,
    APP_VERSION,
    ASSIGNMENT_STATUSES,
    DAYS,
    POMODORO_PRESETS,
    PRIORITY_OPTIONS,
    QUOTES,
    THEMES
  } = constants;
  const {
    clamp,
    deepClone,
    downloadJson,
    isTypingTarget,
    nowIso,
    parseCsvList,
    playTone,
    readFileAsText
  } = helpers;
  const {
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
    startOfDay
  } = dateUtils;

  const dom = {};
  const runtime = {
    chart: null,
    initialized: false,
    liveInterval: null,
    reminderInterval: null,
    modal: null,
    dragAssignmentId: null,
    dragWeeklyId: null
  };

  let state = null;

  function cacheDom() {
    dom.sidebarContent = document.getElementById("sidebarContent");
    dom.sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    dom.jumpPlannerBtn = document.getElementById("jumpPlannerBtn");
    dom.focusModeBtn = document.getElementById("focusModeBtn");
    dom.notificationBtn = document.getElementById("notificationBtn");
    dom.themeCycleBtn = document.getElementById("themeCycleBtn");
    dom.exportBtn = document.getElementById("exportBtn");
    dom.importBtn = document.getElementById("importBtn");
    dom.accountChip = document.getElementById("accountChip");
    dom.logoutBtn = document.getElementById("logoutBtn");
    dom.importInput = document.getElementById("importInput");
    dom.overviewPanel = document.getElementById("section-overview");
    dom.plannerPanel = document.getElementById("section-planner");
    dom.habitsPanel = document.getElementById("section-habits");
    dom.analyticsPanel = document.getElementById("section-analytics");
    dom.focusPanel = document.getElementById("section-focus");
    dom.settingsPanel = document.getElementById("section-settings");
    dom.modalRoot = document.getElementById("modalRoot");
    dom.toastRoot = document.getElementById("toastRoot");
  }

  function collectionValues(collection) {
    return collection.allIds.map((id) => collection.byId[id]).filter(Boolean);
  }

  function findById(collection, id) {
    return collection.byId[id] || null;
  }

  function setCollectionItem(collection, item) {
    collection.byId[item.id] = item;
    if (!collection.allIds.includes(item.id)) {
      collection.allIds.unshift(item.id);
    }
  }

  function removeCollectionItem(collection, id) {
    delete collection.byId[id];
    collection.allIds = collection.allIds.filter((entryId) => entryId !== id);
  }

  function getQuote() {
    const index = new Date().getDate() % QUOTES.length;
    return QUOTES[index];
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    dom.toastRoot.appendChild(toast);
    global.setTimeout(() => toast.remove(), 2600);
  }

  function confirmAction(message) {
    return global.confirm(message);
  }

  function syncBodyClasses() {
    document.body.classList.remove("theme-midnight", "theme-daylight", "theme-ember", "theme-ocean");
    document.body.classList.add(`theme-${state.settings.theme}`);
    document.body.classList.toggle("sidebar-collapsed", state.settings.preferences.sidebarCollapsed);
    document.body.classList.toggle("focus-mode", state.settings.preferences.focusMode);
    document.body.classList.remove("is-booting");
  }

  function updateTopbarButtons() {
    dom.focusModeBtn.textContent = state.settings.preferences.focusMode ? "Exit focus mode" : "Focus mode";
    dom.notificationBtn.textContent = state.settings.notifications.enabled ? "Notifications on" : "Notifications";
    dom.themeCycleBtn.textContent = `Theme: ${THEMES.find((theme) => theme.id === state.settings.theme).label}`;
    if (dom.accountChip && App.auth && typeof App.auth.getCurrentUser === "function") {
      const currentUser = App.auth.getCurrentUser();
      dom.accountChip.textContent = currentUser ? currentUser.email : "Guest";
    }
  }

  function computeOnTimeRate(assignments) {
    const completed = assignments.filter((assignment) => assignment.status === "completed" && assignment.completedAt);
    if (!completed.length) {
      return 0;
    }

    const onTime = completed.filter((assignment) => {
      if (!assignment.dueDate) {
        return true;
      }
      const dueKey = String(assignment.dueDate).slice(0, 10);
      const completedKey = getDateKey(startOfDay(new Date(assignment.completedAt)));
      return completedKey <= dueKey;
    }).length;

    return Math.round((onTime / completed.length) * 100);
  }

  function getTimerSnapshot() {
    const timer = state.planner.focusTimer;
    let remainingSeconds = Number(timer.durationSeconds || POMODORO_PRESETS.focus25.durationSeconds);

    if (timer.running && timer.endsAt) {
      remainingSeconds = Math.max(0, Math.round((new Date(timer.endsAt).getTime() - Date.now()) / 1000));
    }

    const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
    const seconds = String(remainingSeconds % 60).padStart(2, "0");
    const preset = POMODORO_PRESETS[timer.presetId] || POMODORO_PRESETS.focus25;
    const labelMap = {
      work: "Work session",
      shortBreak: "Short break",
      longBreak: "Long break"
    };

    return {
      ...timer,
      preset,
      remainingSeconds,
      display: `${minutes}:${seconds}`,
      modeLabel: labelMap[timer.mode] || "Work session",
      primaryButtonLabel: timer.running ? "Pause session" : "Start session"
    };
  }

  function computeProductivityScore(summary) {
    const assignmentScore = summary.totalAssignments
      ? Math.round((summary.completedAssignments / summary.totalAssignments) * 45)
      : 0;
    const habitScore = summary.habitsTotal
      ? Math.round((summary.habitsCompletedToday / summary.habitsTotal) * 25)
      : 0;
    const focusScore = clamp(Math.round(summary.focusMinutesToday / 3), 0, 30);
    return clamp(assignmentScore + habitScore + focusScore, 0, 100);
  }

  function buildSummary() {
    const assignments = collectionValues(state.planner.assignments);
    const exams = collectionValues(state.planner.exams).sort((left, right) => new Date(left.date) - new Date(right.date));
    const habits = collectionValues(state.planner.habits);
    const weeklyTasks = collectionValues(state.planner.weeklyTasks);
    const todayKey = getTodayKey();
    const pendingAssignments = assignments.filter((assignment) => assignment.status !== "completed");
    const overdueAssignments = pendingAssignments.filter((assignment) => isOverdue(assignment.dueDate, assignment.status));
    const nextExam = exams.find((exam) => daysUntil(exam.date) !== null && daysUntil(exam.date) >= 0) || null;
    const focusTotals = state.analytics.focusSessions.totals;
    const habitsCompletedToday = habits.filter((habit) => habit.history[todayKey]).length;
    const habitStreaks = Object.values(state.analytics.streaks.habits || {});
    const bestHabitStreak = habitStreaks.length ? Math.max(...habitStreaks.map((streak) => streak.longest)) : 0;
    const focusHeadline = pendingAssignments
      .slice()
      .sort((left, right) => {
        const leftDate = left.dueDate || "9999-12-31";
        const rightDate = right.dueDate || "9999-12-31";
        return leftDate.localeCompare(rightDate);
      })[0];

    const summary = {
      assignments,
      exams,
      habits,
      weeklyTasks,
      pendingAssignments,
      overdueAssignments,
      nextExam,
      habitsCompletedToday,
      habitsTotal: habits.length,
      totalAssignments: assignments.length,
      completedAssignments: assignments.filter((assignment) => assignment.status === "completed").length,
      focusMinutesToday: focusTotals.todayMinutes,
      onTimeRate: computeOnTimeRate(assignments),
      assignmentStreak: state.analytics.streaks.assignments.current || 0,
      focusStreak: state.analytics.streaks.focus.current || 0,
      bestHabitStreak,
      topAssignment: focusHeadline || null,
      productivityScore: 0
    };

    summary.productivityScore = computeProductivityScore(summary);
    return summary;
  }

  function getAssignmentFilters() {
    return {
      search: state.settings.preferences.assignmentSearch,
      status: state.settings.preferences.assignmentStatusFilter === "completed" ? "all" : state.settings.preferences.assignmentStatusFilter,
      priority: state.settings.preferences.assignmentPriorityFilter,
      subject: state.settings.preferences.assignmentSubjectFilter,
      sort: state.settings.preferences.assignmentSort
    };
  }

  function getPlannerMonthKey() {
    const monthKey = state.settings.preferences.currentPlannerMonthKey;
    if (typeof monthKey === "string" && monthKey.trim()) {
      return monthKey.trim();
    }

    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }

  function parsePlannerMonthKey(monthKey) {
    const [year, month] = String(monthKey || "").split("-").map(Number);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      const fallback = new Date();
      return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
    }

    return new Date(year, month - 1, 1);
  }

  function getPlannerCalendarDays(monthKey) {
    const monthDate = parsePlannerMonthKey(monthKey);
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const key = getDateKey(date);
      return {
        key,
        date,
        dayNumber: date.getDate(),
        monthLabel: date.toLocaleDateString("en-GB", { month: "short" }),
        dayLabel: date.toLocaleDateString("en-GB", { weekday: "short" }),
        isCurrentMonth: date.getMonth() === monthDate.getMonth(),
        isToday: key === getTodayKey()
      };
    });
  }

  function sortAssignments(assignments, sortKey) {
    const items = [...assignments];
    const priorityValue = { high: 3, medium: 2, low: 1 };

    items.sort((left, right) => {
      if (sortKey === "alphabetical") {
        return left.title.localeCompare(right.title);
      }

      if (sortKey === "priorityHigh") {
        return priorityValue[right.priority.level] - priorityValue[left.priority.level];
      }

      if (sortKey === "newest") {
        return new Date(right.createdAt) - new Date(left.createdAt);
      }

      const leftDate = left.dueDate || "9999-12-31";
      const rightDate = right.dueDate || "9999-12-31";
      return leftDate.localeCompare(rightDate);
    });

    return items;
  }

  function buildAssignmentColumns(summary) {
    const filters = getAssignmentFilters();
    const normalizedStatus = filters.status === "completed" ? "all" : filters.status;
    const normalizedSearch = filters.search.trim().toLowerCase();
    const normalizedSubject = filters.subject.trim().toLowerCase();
    const filtered = sortAssignments(summary.assignments, filters.sort).filter((assignment) => {
      const searchTarget = `${assignment.title} ${assignment.subject} ${assignment.tags.join(" ")}`.toLowerCase();
      const matchesSearch = !normalizedSearch || searchTarget.includes(normalizedSearch);
      const matchesSubject = !normalizedSubject || assignment.subject.toLowerCase().includes(normalizedSubject);
      const matchesPriority = filters.priority === "all" || assignment.priority.level === filters.priority;
      const matchesStatus =
        normalizedStatus === "all" ||
        (normalizedStatus === "overdue" && isOverdue(assignment.dueDate, assignment.status)) ||
        assignment.status === normalizedStatus;

      return matchesSearch && matchesSubject && matchesPriority && matchesStatus;
    });

    const decorated = filtered
      .filter((assignment) => assignment.status !== "completed")
      .map((assignment) => {
        const overdue = isOverdue(assignment.dueDate, assignment.status);
        let statusLabel = ASSIGNMENT_STATUSES[assignment.status].label;
        let statusBadgeClass = `status-${assignment.status}`;

        if (overdue) {
          statusLabel = "Overdue";
          statusBadgeClass = "status-overdue";
        }

        return {
          ...assignment,
          dueLabel: formatRelativeDue(assignment.dueDate, assignment.status),
          statusLabel,
          statusBadgeClass,
          attachmentLabel: `${assignment.attachments.length} attachment${assignment.attachments.length === 1 ? "" : "s"}`,
          noteLabel: assignment.notes ? "Notes saved" : "No notes",
          createdLabel: `Created ${formatDate(assignment.createdAt)}`,
          toggleLabel: assignment.status === "completed" ? "Mark active" : "Complete",
          advanceLabel: assignment.status === "todo" ? "Start work" : "Move forward"
        };
      });

    const columns = [
      {
        key: "todo",
        title: "To do",
        caption: "Backlog",
        items: decorated.filter((assignment) => assignment.status === "todo"),
        emptyTitle: "Inbox is clear",
        emptyMessage: "New assignments will land here."
      },
      {
        key: "in_progress",
        title: "In progress",
        caption: "Active",
        items: decorated.filter((assignment) => assignment.status === "in_progress"),
        emptyTitle: "No active builds",
        emptyMessage: "Move a task here when you start working."
      }
    ];

    return { filters, columns, filteredCount: decorated.length };
  }

  function buildSidebarModel(summary) {
    const nextExamLine = summary.nextExam ? `${summary.nextExam.name} in ${Math.max(daysUntil(summary.nextExam.date), 0)} days` : "No exam countdown active";

    return {
      activeSection: state.settings.preferences.activeSection,
      appName: APP_NAME,
      tagline: "Production-grade study operating system",
      sectionMeta: {
        overview: `${summary.productivityScore}%`,
        planner: `${summary.pendingAssignments.length}`,
        habits: `${summary.habitsCompletedToday}/${summary.habitsTotal || 0}`,
        analytics: `${summary.onTimeRate}%`,
        focus: `${summary.focusMinutesToday}m`,
        settings: APP_VERSION
      },
      pendingAssignments: summary.pendingAssignments.length,
      focusMinutes: summary.focusMinutesToday,
      todayLine: nextExamLine,
      sidebarHintA: summary.topAssignment ? `Next task: ${summary.topAssignment.title}` : "No urgent assignment blocking you.",
      sidebarHintB: `Focus streak: ${summary.focusStreak} day${summary.focusStreak === 1 ? "" : "s"}`
    };
  }

  function buildOverviewModel(summary) {
    const urgentAssignments = summary.pendingAssignments
      .slice()
      .sort((left, right) => {
        const leftDate = left.dueDate || "9999-12-31";
        const rightDate = right.dueDate || "9999-12-31";
        return leftDate.localeCompare(rightDate);
      })
      .slice(0, 3)
      .map((assignment) => ({
        ...assignment,
        dueLabel: formatRelativeDue(assignment.dueDate, assignment.status)
      }));
    const themeLabel = THEMES.find((theme) => theme.id === state.settings.theme).label;
    const profile = state.settings.profile || { name: "", semester: "" };

    return {
      copy: "A premium student workflow with normalized local data, richer analytics, and calmer study decisions.",
      welcomeLabel: profile.name ? `Welcome, ${profile.name}` : "Welcome back",
      semesterLabel: profile.semester ? `Semester: ${profile.semester}` : "Semester not set",
      focusHeadline: summary.topAssignment ? `Start with ${summary.topAssignment.title}` : "Use this dashboard to lock in one important study win today.",
      focusMeta: summary.topAssignment
        ? `${summary.topAssignment.subject} is your nearest meaningful deliverable.`
        : "No pending assignment is urgent, so you can invest in revision, planning, or recovery.",
      liveDate: formatLongDate(new Date()),
      liveTime: formatTime(new Date()),
      clockHint: "Live browser time with second-by-second updates.",
      themeLabel: `Theme: ${themeLabel}`,
      notificationLabel: state.settings.notifications.enabled ? "Alerts enabled" : "Alerts off",
      urgentAssignments,
      quote: getQuote(),
      summaryLine: `On-time delivery is ${summary.onTimeRate}% and today has ${summary.focusMinutesToday} focus minutes logged.`,
      metrics: [
        {
          label: "Pending assignments",
          value: String(summary.pendingAssignments.length),
          hint: summary.pendingAssignments.length ? `${summary.overdueAssignments.length} overdue` : "Inbox clear"
        },
        {
          label: "Next exam",
          value: summary.nextExam ? `${Math.max(daysUntil(summary.nextExam.date), 0)} days` : "None",
          hint: summary.nextExam ? summary.nextExam.name : "Add an exam countdown"
        },
        {
          label: "Habits today",
          value: `${summary.habitsCompletedToday} / ${summary.habitsTotal || 0}`,
          hint: summary.bestHabitStreak ? `Best streak ${summary.bestHabitStreak} days` : "No streaks yet"
        },
        {
          label: "Productivity score",
          value: `${summary.productivityScore}%`,
          hint: `${summary.focusMinutesToday} focus minutes today`
        }
      ]
    };
  }

  function buildPlannerModel(summary) {
    const { filters, columns } = buildAssignmentColumns(summary);
    const monthlyTasks = collectionValues(state.planner.weeklyTasks);
    const selectedMonthKey = getPlannerMonthKey();
    const calendarDays = getPlannerCalendarDays(selectedMonthKey);
    const groupedTasks = calendarDays.map((day) => ({
      ...day,
      tasks: monthlyTasks.filter((task) => task.date === day.key)
    }));
    const exams = summary.exams
      .filter((exam) => daysUntil(exam.date) !== null && daysUntil(exam.date) >= 0)
      .map((exam) => {
        const diff = daysUntil(exam.date);
        let urgencyClass = "urgency-steady";
        let urgencyLabel = "Upcoming";
        if (diff !== null && diff <= 0) {
          urgencyClass = "urgency-now";
          urgencyLabel = "Today";
        } else if (diff !== null && diff <= 3) {
          urgencyClass = "urgency-soon";
          urgencyLabel = "Soon";
        }

        return {
          ...exam,
          urgencyClass,
          urgencyLabel,
          reminderLabel: `Alerts: ${(exam.reminderDays || []).join(", ")} day windows`
        };
      });
    const nextPending = summary.pendingAssignments
      .slice()
      .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"))[0];

    return {
      activeTab: state.settings.preferences.activePlannerTab,
      collapsed: state.settings.preferences.collapsedSections.planner,
      filters: {
        search: filters.search,
        status: filters.status,
        priority: filters.priority,
        subject: filters.subject,
        sort: filters.sort
      },
      columns,
      exams,
      calendarRows: [
        DAYS.map((day) => ({
          label: day.short,
          index: day.index
        }))
      ].concat(
        groupedTasks.reduce((rows, day, index) => {
          if (index % 7 === 0) {
            rows.push([]);
          }
          rows[rows.length - 1].push(day);
          return rows;
        }, [])
      ),
      currentMonthLabel: new Date(parsePlannerMonthKey(selectedMonthKey)).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric"
      }),
      monthlyHint: "Drag tasks across the calendar to move them to a different day, or edit them to update the date.",
      assignmentInsight: {
        title: nextPending ? `${nextPending.title} is the next delivery point.` : "Your assignment board is under control.",
        body: nextPending
          ? `${nextPending.subject} is currently ${formatRelativeDue(nextPending.dueDate, nextPending.status).toLowerCase()}.`
          : "Use the board to sort future work by priority and progress.",
        statA: `${summary.pendingAssignments.length} open`,
        statB: `${summary.overdueAssignments.length} overdue`
      },
      examInsight: {
        title: summary.nextExam ? `${summary.nextExam.name} is your nearest exam window.` : "Build an exam roadmap before revision pressure ramps up.",
        body: summary.nextExam
          ? `${summary.nextExam.subject} lands on ${formatLongDate(summary.nextExam.date)}.`
          : "Add upcoming tests to unlock countdowns, urgency badges, and reminders."
      }
    };
  }

  function buildHabitModel(summary) {
    const keys = getLastDateKeys(14);
    const habits = summary.habits.map((habit) => {
      const streak = state.analytics.streaks.habits[habit.id] || { current: 0, longest: 0 };
      const month = getMonthProgress(habit.history);

      return {
        ...habit,
        currentStreak: streak.current,
        longestStreak: streak.longest,
        monthLabel: `${month.percentage}% month`,
        toggleLabel: habit.history[getTodayKey()] ? "Undo today" : "Mark today",
        historyDays: keys.map((key) => ({ label: key, done: Boolean(habit.history[key]) }))
      };
    });

    return {
      collapsed: state.settings.preferences.collapsedSections.habits,
      habits,
      summaryCards: [
        {
          label: "Today completion",
          value: `${summary.habitsCompletedToday} / ${summary.habitsTotal || 0}`,
          hint: "Daily habits logged today"
        },
        {
          label: "Best streak",
          value: `${summary.bestHabitStreak}`,
          hint: "Longest run across all habits"
        },
        {
          label: "Focus streak",
          value: `${summary.focusStreak}`,
          hint: "Consecutive focused days"
        },
        {
          label: "Assignment streak",
          value: `${summary.assignmentStreak}`,
          hint: "Days with completed assignments"
        }
      ]
    };
  }

  function buildAnalyticsModel(summary) {
    const heatmap = state.analytics.heatmap || {};
    const heatmapCells = getLastDateKeys(35).map((key) => {
      const value = heatmap[key] || 0;
      let levelClass = "";
      if (value >= 4) levelClass = "level-4";
      else if (value === 3) levelClass = "level-3";
      else if (value === 2) levelClass = "level-2";
      else if (value === 1) levelClass = "level-1";

      return {
        key,
        levelClass,
        label: `${key}: ${value} completed events`
      };
    });

    return {
      collapsed: state.settings.preferences.collapsedSections.analytics,
      heatmapCells,
      cards: [
        {
          label: "On-time rate",
          value: `${summary.onTimeRate}%`,
          hint: "Completed assignments delivered on time"
        },
        {
          label: "Completed assignments",
          value: String(summary.completedAssignments),
          hint: "Finished work tracked in storage"
        },
        {
          label: "Total focus minutes",
          value: `${state.analytics.focusSessions.totals.totalFocusMinutes}m`,
          hint: "Work sessions completed so far"
        },
        {
          label: "Overdue count",
          value: String(summary.overdueAssignments.length),
          hint: "Assignments needing recovery attention"
        }
      ]
    };
  }

  function buildFocusModel() {
    const snapshot = getTimerSnapshot();
    const recentSessions = state.analytics.focusSessions.sessions.slice(-6).reverse();

    return {
      collapsed: state.settings.preferences.collapsedSections.focus,
      focusMode: state.settings.preferences.focusMode,
      timerLabel: snapshot.activeLabel,
      timerHint: snapshot.running ? `Ends at ${formatTime(snapshot.endsAt)}` : "Work and break modes persist across refreshes.",
      timerDisplay: snapshot.display,
      modeLabel: snapshot.modeLabel,
      cycleCount: snapshot.cycleCount,
      primaryButtonLabel: snapshot.primaryButtonLabel,
      presets: Object.values(POMODORO_PRESETS).map((preset) => ({
        ...preset,
        active: snapshot.presetId === preset.id
      })),
      focusStats: [
        {
          label: "Sessions completed",
          value: String(state.analytics.focusSessions.totals.completedSessions),
          hint: "Completed work sessions"
        },
        {
          label: "Today focus",
          value: `${state.analytics.focusSessions.totals.todayMinutes}m`,
          hint: "Minutes logged today"
        },
        {
          label: "Current streak",
          value: String(state.analytics.streaks.focus.current || 0),
          hint: "Focused days in a row"
        },
        {
          label: "Sound alerts",
          value: state.settings.sounds.enabled ? "On" : "Off",
          hint: "Audio cues at timer completion"
        }
      ],
      sessions: recentSessions
    };
  }

  function buildSettingsModel() {
    return {
      collapsed: state.settings.preferences.collapsedSections.settings,
      theme: state.settings.theme,
      profileName: state.settings.profile.name,
      profileSemester: state.settings.profile.semester,
      notificationsEnabled: state.settings.notifications.enabled,
      soundsEnabled: state.settings.sounds.enabled,
      focusMode: state.settings.preferences.focusMode,
      sidebarCollapsed: state.settings.preferences.sidebarCollapsed,
      version: state.meta.version,
      createdAt: state.meta.createdAt,
      lastUpdated: state.meta.lastUpdated
    };
  }

  function renderModal() {
    dom.modalRoot.innerHTML = templates.renderModal(runtime.modal);
    dom.modalRoot.hidden = !runtime.modal;
  }

  function renderApp() {
    const summary = buildSummary();
    dom.sidebarContent.innerHTML = templates.renderSidebar(buildSidebarModel(summary));
    dom.overviewPanel.innerHTML = templates.renderOverview(buildOverviewModel(summary));
    dom.plannerPanel.innerHTML = templates.renderPlanner(buildPlannerModel(summary));
    dom.habitsPanel.innerHTML = templates.renderHabits(buildHabitModel(summary));
    dom.analyticsPanel.innerHTML = templates.renderAnalytics(buildAnalyticsModel(summary));
    dom.focusPanel.innerHTML = templates.renderFocus(buildFocusModel(summary));
    dom.settingsPanel.innerHTML = templates.renderSettings(buildSettingsModel());

    syncBodyClasses();
    updateTopbarButtons();
    renderModal();
    refreshChart();
    updateLiveUi();
  }

  function refreshChart() {
    const canvas = document.getElementById("analyticsChart");
    if (!canvas || typeof global.Chart === "undefined") {
      return;
    }

    if (runtime.chart) {
      runtime.chart.destroy();
      runtime.chart = null;
    }

    const styles = global.getComputedStyle(document.body);
    const chartData = state.analytics.weeklyProgress;
    const ratio = global.devicePixelRatio || 1;
    const chartHeight = 280;

    canvas.width = Math.max(480, Math.floor(canvas.clientWidth * ratio || 480));
    canvas.height = Math.floor(chartHeight * ratio);
    canvas.style.height = `${chartHeight}px`;
    canvas.style.width = "100%";

    runtime.chart = new global.Chart(canvas, {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [
          {
            type: "bar",
            label: "Assignments done",
            data: chartData.assignments,
            borderRadius: 12,
            backgroundColor: "rgba(82, 225, 178, 0.72)"
          },
          {
            type: "bar",
            label: "Habit check-ins",
            data: chartData.habits,
            borderRadius: 12,
            backgroundColor: "rgba(110, 199, 255, 0.52)"
          },
          {
            type: "line",
            label: "Focus minutes",
            data: chartData.focusMinutes,
            tension: 0.34,
            borderWidth: 2,
            borderColor: styles.getPropertyValue("--warning").trim(),
            pointBackgroundColor: styles.getPropertyValue("--warning").trim(),
            yAxisID: "focus"
          }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: styles.getPropertyValue("--text-muted").trim()
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255,255,255,0.05)"
            },
            ticks: {
              color: styles.getPropertyValue("--text-muted").trim()
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255,255,255,0.05)"
            },
            ticks: {
              color: styles.getPropertyValue("--text-muted").trim()
            }
          },
          focus: {
            position: "right",
            beginAtZero: true,
            grid: {
              display: false
            },
            ticks: {
              color: styles.getPropertyValue("--text-muted").trim()
            }
          }
        }
      }
    });

    runtime.chart.resize();
  }

  function updateLiveUi() {
    const liveDate = document.getElementById("liveDate");
    const liveTime = document.getElementById("liveTime");
    if (liveDate) {
      liveDate.textContent = formatLongDate(new Date());
    }
    if (liveTime) {
      liveTime.textContent = formatTime(new Date());
    }

    document.querySelectorAll("[data-countdown-date]").forEach((element) => {
      element.textContent = formatCountdown(element.getAttribute("data-countdown-date"));
    });

    const timerDisplay = document.getElementById("pomodoroDisplay");
    const pomodoroCycles = document.getElementById("pomodoroCycles");
    if (timerDisplay || pomodoroCycles) {
      const snapshot = getTimerSnapshot();
      if (timerDisplay) {
        timerDisplay.textContent = snapshot.display;
      }
      if (pomodoroCycles) {
        pomodoroCycles.textContent = String(snapshot.cycleCount);
      }
    }
  }

  function notifyBrowser(title, body) {
    if (!("Notification" in global) || global.Notification.permission !== "granted") {
      return;
    }

    new global.Notification(title, { body });
  }

  function playCompletionSound() {
    if (!state.settings.sounds.enabled) {
      return;
    }

    playTone(880, 140, state.settings.sounds.volume);
    global.setTimeout(() => playTone(660, 180, state.settings.sounds.volume), 170);
  }

  function getNextPresetIdForMode(mode, cycleCount) {
    if (mode === "work") {
      return cycleCount > 0 && cycleCount % 4 === 0 ? "longBreak" : "shortBreak";
    }

    return "focus25";
  }

  function completePomodoro() {
    const previousTimer = deepClone(state.planner.focusTimer);
    const completedMinutes = Math.round((Number(previousTimer.durationSeconds || 0) || 0) / 60);
    const nextPresetId = getNextPresetIdForMode(previousTimer.mode, previousTimer.cycleCount + (previousTimer.mode === "work" ? 1 : 0));
    const nextPreset = POMODORO_PRESETS[nextPresetId];

    state = storage.mutateState(state, (draft) => {
      const timer = draft.planner.focusTimer;
      const nextCycleCount = timer.mode === "work" ? timer.cycleCount + 1 : timer.cycleCount;

      if (timer.mode === "work") {
        draft.analytics.focusSessions.sessions.push(
          storage.normalizeFocusSession({
            mode: "work",
            minutes: completedMinutes,
            label: "Completed focus session",
            startedAt: timer.startedAt || nowIso(),
            completedAt: nowIso()
          })
        );
      }

      draft.planner.focusTimer = {
        ...timer,
        presetId: nextPreset.id,
        mode: nextPreset.mode,
        durationSeconds: nextPreset.durationSeconds,
        running: false,
        endsAt: null,
        startedAt: null,
        cycleCount: nextCycleCount,
        activeLabel: timer.mode === "work" ? "Nice work. Take a break." : "Break complete. Back to focused work."
      };
    });

    renderApp();
    showToast(previousTimer.mode === "work" ? "Focus session completed." : "Break completed.");
    notifyBrowser("Pomodoro complete", previousTimer.mode === "work" ? "Time to recover for a moment." : "Break finished. Ready for your next focus block.");
    playCompletionSound();
  }

  function reconcileFocusTimer() {
    const timer = state.planner.focusTimer;
    if (!timer.running || !timer.endsAt) {
      return;
    }

    const countdown = getCountdownParts(timer.endsAt);
    if (countdown && countdown.expired) {
      completePomodoro();
    }
  }

  function startIntervals() {
    if (runtime.liveInterval) {
      global.clearInterval(runtime.liveInterval);
    }

    runtime.liveInterval = global.setInterval(() => {
      reconcileFocusTimer();
      updateLiveUi();
    }, 1000);

    if (runtime.reminderInterval) {
      global.clearInterval(runtime.reminderInterval);
    }

    runtime.reminderInterval = global.setInterval(sendDueReminders, 5 * 60 * 1000);
  }

  function updatePreference(preferenceKey, value) {
    state = storage.mutateState(state, (draft) => {
      draft.settings.preferences[preferenceKey] = value;
    });
    renderApp();
  }

  function updateAssignmentFilters(partial) {
    state = storage.mutateState(state, (draft) => {
      const preferences = draft.settings.preferences;
      if (Object.prototype.hasOwnProperty.call(partial, "search")) preferences.assignmentSearch = partial.search;
      if (Object.prototype.hasOwnProperty.call(partial, "status")) preferences.assignmentStatusFilter = partial.status;
      if (Object.prototype.hasOwnProperty.call(partial, "priority")) preferences.assignmentPriorityFilter = partial.priority;
      if (Object.prototype.hasOwnProperty.call(partial, "subject")) preferences.assignmentSubjectFilter = partial.subject;
      if (Object.prototype.hasOwnProperty.call(partial, "sort")) preferences.assignmentSort = partial.sort;
    });
    renderApp();
  }

  function saveProfile() {
    const nameInput = document.getElementById("profileNameInput");
    const semesterInput = document.getElementById("profileSemesterInput");

    state = storage.mutateState(state, (draft) => {
      draft.settings.profile.name = nameInput ? nameInput.value.trim() : "";
      draft.settings.profile.semester = semesterInput ? semesterInput.value.trim() : "";
    });

    renderApp();
    showToast("Profile updated.");
  }

  function clearProfile() {
    state = storage.mutateState(state, (draft) => {
      draft.settings.profile.name = "";
    });

    renderApp();
    showToast("Name cleared.");
  }

  function openModal(type, id) {
    let item = null;
    if (id) {
      if (type === "assignment") item = findById(state.planner.assignments, id);
      if (type === "exam") item = findById(state.planner.exams, id);
      if (type === "habit") item = findById(state.planner.habits, id);
      if (type === "weekly") item = findById(state.planner.weeklyTasks, id);
    }

    runtime.modal = { type, mode: id ? "edit" : "create", item };
    renderModal();
  }

  function closeModal() {
    runtime.modal = null;
    renderModal();
  }

  function upsertAssignment(form, mode, id) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.title || "").trim()) {
      showToast("Assignment title is required.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const existing = id ? findById(draft.planner.assignments, id) : null;
      const nextStatus = data.status || "todo";
      const assignment = storage.normalizeAssignment({
        ...(existing || {}),
        id: existing ? existing.id : undefined,
        title: data.title,
        description: data.description,
        subject: data.subject,
        tags: parseCsvList(data.tags),
        status: nextStatus,
        priority: data.priority,
        dueDate: data.dueDate,
        createdAt: existing ? existing.createdAt : nowIso(),
        completedAt: nextStatus === "completed" ? (existing && existing.completedAt) || nowIso() : null,
        attachments: parseCsvList(data.attachments),
        notes: data.notes
      });

      setCollectionItem(draft.planner.assignments, assignment);
    });

    closeModal();
    renderApp();
    showToast(mode === "edit" ? "Assignment updated." : "Assignment created.");
  }

  function upsertExam(form, mode, id) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.name || "").trim() || !String(data.date || "").trim() || !String(data.time || "").trim()) {
      showToast("Exam name, date, and start time are required.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const existing = id ? findById(draft.planner.exams, id) : null;
      const dateValue = data.date ? new Date(`${data.date}T${data.time}:00`).toISOString() : "";
      const exam = storage.normalizeExam({
        ...(existing || {}),
        id: existing ? existing.id : undefined,
        name: data.name,
        subject: data.subject,
        date: dateValue,
        location: data.location,
        reminderDays: parseCsvList(data.reminderDays).map((item) => Number(item)).filter((item) => !Number.isNaN(item)),
        notes: data.notes,
        createdAt: existing ? existing.createdAt : nowIso()
      });

      setCollectionItem(draft.planner.exams, exam);
    });

    closeModal();
    renderApp();
    showToast(mode === "edit" ? "Exam updated." : "Exam created.");
  }

  function upsertHabit(form, mode, id) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.name || "").trim()) {
      showToast("Habit name is required.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const existing = id ? findById(draft.planner.habits, id) : null;
      const habit = storage.normalizeHabit({
        ...(existing || {}),
        id: existing ? existing.id : undefined,
        name: data.name,
        target: {
          frequency: data.frequency || "daily",
          goal: Number(data.goal || 1)
        },
        history: existing ? existing.history : {},
        createdAt: existing ? existing.createdAt : nowIso()
      });

      setCollectionItem(draft.planner.habits, habit);
    });

    closeModal();
    renderApp();
    showToast(mode === "edit" ? "Habit updated." : "Habit created.");
  }

  function upsertWeeklyTask(form, mode, id) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.title || "").trim()) {
      showToast("Monthly task title is required.");
      return;
    }

    if (!String(data.date || "").trim()) {
      showToast("A task date is required.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const existing = id ? findById(draft.planner.weeklyTasks, id) : null;
      const task = storage.normalizeWeeklyTask({
        ...(existing || {}),
        id: existing ? existing.id : undefined,
        title: data.title,
        date: String(data.date).slice(0, 10),
        startTime: String(data.startTime || ""),
        notes: data.notes,
        createdAt: existing ? existing.createdAt : nowIso()
      });

      setCollectionItem(draft.planner.weeklyTasks, task);
    });

    closeModal();
    renderApp();
    showToast(mode === "edit" ? "Monthly task updated." : "Monthly task created.");
  }

  function deleteAssignmentById(id) {
    state = storage.mutateState(state, (draft) => {
      removeCollectionItem(draft.planner.assignments, id);
    });
  }

  function deleteAssignment(id) {
    const assignment = findById(state.planner.assignments, id);
    if (!assignment || !confirmAction(`Delete assignment "${assignment.title}"?`)) {
      return;
    }

    deleteAssignmentById(id);
    closeModal();
    renderApp();
    showToast("Assignment deleted.");
  }

  function deleteExam(id) {
    const exam = findById(state.planner.exams, id);
    if (!exam || !confirmAction(`Delete exam "${exam.name}"?`)) {
      return;
    }

    state = storage.mutateState(state, (draft) => {
      removeCollectionItem(draft.planner.exams, id);
    });
    closeModal();
    renderApp();
    showToast("Exam deleted.");
  }

  function deleteHabit(id) {
    const habit = findById(state.planner.habits, id);
    if (!habit || !confirmAction(`Delete habit "${habit.name}"?`)) {
      return;
    }

    state = storage.mutateState(state, (draft) => {
      removeCollectionItem(draft.planner.habits, id);
    });
    closeModal();
    renderApp();
    showToast("Habit deleted.");
  }

  function deleteWeeklyTask(id) {
    const task = findById(state.planner.weeklyTasks, id);
    if (!task || !confirmAction(`Delete task "${task.title}"?`)) {
      return;
    }

    state = storage.mutateState(state, (draft) => {
      removeCollectionItem(draft.planner.weeklyTasks, id);
    });
    closeModal();
    renderApp();
    showToast("Monthly task deleted.");
  }

  function setAssignmentStatus(id, status) {
    state = storage.mutateState(state, (draft) => {
      const assignment = findById(draft.planner.assignments, id);
      if (!assignment) {
        return;
      }

      assignment.status = status;
      assignment.completedAt = status === "completed" ? assignment.completedAt || nowIso() : null;
    });

    renderApp();
  }

  function advanceAssignment(id) {
    const assignment = findById(state.planner.assignments, id);
    if (!assignment) {
      return;
    }

    const nextStatus = assignment.status === "todo" ? "in_progress" : "completed";
    setAssignmentStatus(id, nextStatus);
    showToast(nextStatus === "completed" ? "Assignment completed." : "Assignment moved to in progress.");
  }

  function toggleAssignmentComplete(id) {
    const assignment = findById(state.planner.assignments, id);
    if (!assignment) {
      return;
    }

    const nextStatus = assignment.status === "completed" ? "todo" : "completed";

    if (nextStatus === "completed" && confirmAction("This task is completed. Do you want to delete it now?")) {
      deleteAssignmentById(id);
      closeModal();
      renderApp();
      showToast("Assignment deleted.");
      return;
    }

    setAssignmentStatus(id, nextStatus);
    showToast(nextStatus === "completed" ? "Assignment completed." : "Assignment marked active.");
  }

  function toggleHabitToday(id) {
    state = storage.mutateState(state, (draft) => {
      const habit = findById(draft.planner.habits, id);
      if (!habit) {
        return;
      }

      const todayKey = getTodayKey();
      if (habit.history[todayKey]) {
        delete habit.history[todayKey];
      } else {
        habit.history[todayKey] = true;
      }
    });

    renderApp();
    showToast("Habit updated.");
  }

  function moveWeeklyTask(id, date) {
    state = storage.mutateState(state, (draft) => {
      const task = findById(draft.planner.weeklyTasks, id);
      if (!task) {
        return;
      }

      task.date = String(date || "").slice(0, 10);
    });
    renderApp();
    showToast("Monthly task moved.");
  }

  function toggleSidebar() {
    updatePreference("sidebarCollapsed", !state.settings.preferences.sidebarCollapsed);
  }

  function cycleTheme() {
    const currentIndex = THEMES.findIndex((theme) => theme.id === state.settings.theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    setTheme(nextTheme.id);
  }

  function setTheme(themeId) {
    state = storage.mutateState(state, (draft) => {
      draft.settings.theme = themeId;
    });
    renderApp();
  }

  async function toggleNotifications() {
    if (!("Notification" in global)) {
      showToast("Notifications are not supported in this browser.");
      return;
    }

    if (!state.settings.notifications.enabled) {
      const permission = await global.Notification.requestPermission();
      state = storage.mutateState(state, (draft) => {
        draft.settings.notifications.permission = permission;
        draft.settings.notifications.enabled = permission === "granted";
      });
      renderApp();
      showToast(permission === "granted" ? "Notifications enabled." : "Notification permission was not granted.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      draft.settings.notifications.enabled = false;
    });
    renderApp();
    showToast("Notifications turned off.");
  }

  function toggleSounds() {
    state = storage.mutateState(state, (draft) => {
      draft.settings.sounds.enabled = !draft.settings.sounds.enabled;
    });
    renderApp();
    showToast(state.settings.sounds.enabled ? "Sound alerts enabled." : "Sound alerts muted.");
  }

  function toggleFocusMode() {
    state = storage.mutateState(state, (draft) => {
      draft.settings.preferences.focusMode = !draft.settings.preferences.focusMode;
    });
    renderApp();
    if (state.settings.preferences.focusMode) {
      document.getElementById("section-focus").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleSection(sectionKey) {
    state = storage.mutateState(state, (draft) => {
      const collapsed = draft.settings.preferences.collapsedSections;
      collapsed[sectionKey] = !collapsed[sectionKey];
    });
    renderApp();
  }

  function jumpToSection(targetId) {
    const sectionKey = String(targetId || "").replace("section-", "");
    state = storage.mutateState(state, (draft) => {
      draft.settings.preferences.activeSection = sectionKey;
    });
    renderApp();
    const section = document.getElementById(targetId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setPlannerTab(tabKey) {
    updatePreference("activePlannerTab", tabKey);
  }

  function changePlannerMonth(delta) {
    const current = parsePlannerMonthKey(getPlannerMonthKey());
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

    state = storage.mutateState(state, (draft) => {
      draft.settings.preferences.currentPlannerMonthKey = nextKey;
    });
    renderApp();
  }

  function resetPlannerMonth() {
    const today = new Date();
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    state = storage.mutateState(state, (draft) => {
      draft.settings.preferences.currentPlannerMonthKey = currentKey;
    });
    renderApp();
  }

  function setPomodoroPreset(presetId) {
    const preset = POMODORO_PRESETS[presetId];
    if (!preset) {
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const timer = draft.planner.focusTimer;
      draft.planner.focusTimer = {
        ...timer,
        presetId: preset.id,
        mode: preset.mode,
        durationSeconds: preset.durationSeconds,
        running: false,
        endsAt: null,
        startedAt: null,
        activeLabel: `Preset ready: ${preset.label}`
      };
    });
    renderApp();
  }

  function togglePomodoro() {
    const timer = state.planner.focusTimer;

    if (timer.running && timer.endsAt) {
      const remainingSeconds = Math.max(0, Math.round((new Date(timer.endsAt).getTime() - Date.now()) / 1000));
      state = storage.mutateState(state, (draft) => {
        draft.planner.focusTimer.running = false;
        draft.planner.focusTimer.endsAt = null;
        draft.planner.focusTimer.durationSeconds = remainingSeconds;
        draft.planner.focusTimer.activeLabel = "Session paused";
      });
      renderApp();
      showToast("Pomodoro paused.");
      return;
    }

    state = storage.mutateState(state, (draft) => {
      const draftTimer = draft.planner.focusTimer;
      draftTimer.running = true;
      draftTimer.startedAt = nowIso();
      draftTimer.endsAt = new Date(Date.now() + draftTimer.durationSeconds * 1000).toISOString();
      draftTimer.activeLabel = draftTimer.mode === "work" ? "Stay locked in." : "Recover before the next round.";
    });
    renderApp();
    showToast("Pomodoro started.");
  }

  function resetPomodoro() {
    const preset = POMODORO_PRESETS[state.planner.focusTimer.presetId] || POMODORO_PRESETS.focus25;
    state = storage.mutateState(state, (draft) => {
      draft.planner.focusTimer = {
        ...draft.planner.focusTimer,
        running: false,
        endsAt: null,
        startedAt: null,
        durationSeconds: preset.durationSeconds,
        mode: preset.mode,
        activeLabel: "Timer reset"
      };
    });
    renderApp();
    showToast("Pomodoro reset.");
  }

  function skipPomodoroMode() {
    const nextPresetId = getNextPresetIdForMode(state.planner.focusTimer.mode, state.planner.focusTimer.cycleCount + 1);
    const preset = POMODORO_PRESETS[nextPresetId];
    state = storage.mutateState(state, (draft) => {
      draft.planner.focusTimer = {
        ...draft.planner.focusTimer,
        presetId: preset.id,
        mode: preset.mode,
        durationSeconds: preset.durationSeconds,
        running: false,
        endsAt: null,
        startedAt: null,
        activeLabel: `Mode changed to ${preset.label}`
      };
    });
    renderApp();
    showToast("Pomodoro mode skipped.");
  }

  function sendDueReminders() {
    if (!state.settings.notifications.enabled || !("Notification" in global) || global.Notification.permission !== "granted") {
      return;
    }

    const notificationHistory = state.settings.notifications.history || {};
    const assignments = collectionValues(state.planner.assignments).filter((assignment) => assignment.status !== "completed");
    const exams = collectionValues(state.planner.exams);

    let nextState = state;
    let didNotify = false;

    function maybeRecordAndNotify(key, title, body) {
      if (notificationHistory[key]) {
        return;
      }

      notifyBrowser(title, body);
      didNotify = true;
      nextState = storage.mutateState(nextState, (draft) => {
        draft.settings.notifications.history[key] = nowIso();
      });
    }

    assignments.forEach((assignment) => {
      const diff = daysUntil(assignment.dueDate);
      if (typeof diff !== "number") {
        return;
      }

      state.settings.notifications.reminderWindows.assignments.forEach((windowDay) => {
        if (diff === windowDay) {
          maybeRecordAndNotify(
            `assignment-${assignment.id}-${windowDay}`,
            "Assignment reminder",
            `${assignment.title} is due ${windowDay === 0 ? "today" : `in ${windowDay} day${windowDay === 1 ? "" : "s"}`}.`
          );
        }
      });
    });

    exams.forEach((exam) => {
      const diff = daysUntil(exam.date);
      if (typeof diff !== "number") {
        return;
      }

      state.settings.notifications.reminderWindows.exams.forEach((windowDay) => {
        if (diff === windowDay) {
          maybeRecordAndNotify(
            `exam-${exam.id}-${windowDay}`,
            "Exam reminder",
            `${exam.name} is ${windowDay === 0 ? "today" : `in ${windowDay} day${windowDay === 1 ? "" : "s"}`}.`
          );
        }
      });
    });

    if (didNotify) {
      state = nextState;
      renderApp();
    }
  }

  function exportData() {
    downloadJson("student-productivity-dashboard.json", storage.exportState(state));
    showToast("Dashboard data exported.");
  }

  function saveNow() {
    state = storage.saveState(state);
    renderApp();
    showToast("Data saved locally.");
  }

  function importData() {
    dom.importInput.value = "";
    dom.importInput.click();
  }

  async function handleImportChange(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      const text = await readFileAsText(file);
      state = storage.importState(JSON.parse(text));
      closeModal();
      renderApp();
      showToast("Dashboard data imported.");
    } catch (error) {
      console.error(error);
      showToast("That JSON file could not be imported.");
    }
  }

  function resetData() {
    if (!confirmAction("Reset the dashboard back to its demo data?")) {
      return;
    }

    state = storage.resetState();
    closeModal();
    renderApp();
    showToast("Dashboard reset to demo data.");
  }

  function handleAction(action, dataset) {
    if (action === "jump-section") jumpToSection(dataset.target);
    if (action === "toggle-sidebar") toggleSidebar();
    if (action === "toggle-focus-mode") toggleFocusMode();
    if (action === "toggle-notifications") toggleNotifications();
    if (action === "toggle-sounds") toggleSounds();
    if (action === "set-theme") setTheme(dataset.theme);
    if (action === "toggle-section") toggleSection(dataset.section);
    if (action === "set-planner-tab") setPlannerTab(dataset.tab);
    if (action === "show-30-days") setPlannerTab("weekly");
    if (action === "prev-planner-month") changePlannerMonth(-1);
    if (action === "next-planner-month") changePlannerMonth(1);
    if (action === "current-planner-month") resetPlannerMonth();
    if (action === "new-assignment") openModal("assignment");
    if (action === "new-exam") openModal("exam");
    if (action === "new-habit") openModal("habit");
    if (action === "new-weekly") openModal("weekly");
    if (action === "open-assignment-modal") openModal("assignment", dataset.id);
    if (action === "open-exam-modal") openModal("exam", dataset.id);
    if (action === "open-habit-modal") openModal("habit", dataset.id);
    if (action === "open-weekly-modal") openModal("weekly", dataset.id);
    if (action === "delete-assignment") deleteAssignment(dataset.id);
    if (action === "delete-exam") deleteExam(dataset.id);
    if (action === "delete-habit") deleteHabit(dataset.id);
    if (action === "delete-weekly") deleteWeeklyTask(dataset.id);
    if (action === "toggle-assignment-complete") toggleAssignmentComplete(dataset.id);
    if (action === "advance-assignment") advanceAssignment(dataset.id);
    if (action === "toggle-habit-today") toggleHabitToday(dataset.id);
    if (action === "save-profile") saveProfile();
    if (action === "clear-profile") clearProfile();
    if (action === "toggle-pomodoro") togglePomodoro();
    if (action === "reset-pomodoro") resetPomodoro();
    if (action === "skip-pomodoro-mode") skipPomodoroMode();
    if (action === "set-preset") setPomodoroPreset(dataset.preset);
    if (action === "save-now") saveNow();
    if (action === "export-data") exportData();
    if (action === "import-data") importData();
    if (action === "reset-data") resetData();
    if (action === "open-semester-modal") {
      runtime.modal = { type: "semester", semester: null };
      renderModal();
    }
    if (action === "select-semester") {
      runtime.modal = { type: "semester", semester: dataset.semester };
      renderModal();
    }
    if (action === "close-modal") closeModal();
    if (action === "open-shortcuts") {
      runtime.modal = { type: "shortcuts", mode: "view", item: null };
      renderModal();
    }
  }

  function handleDocumentClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      handleAction(actionTarget.dataset.action, actionTarget.dataset);
      return;
    }

    if (event.target === dom.modalRoot) {
      closeModal();
    }
  }

  function handleFormSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) {
      return;
    }

    event.preventDefault();

    const formName = form.dataset.form;
    const mode = form.dataset.mode;
    const id = form.dataset.id || "";

    if (formName === "assignment") upsertAssignment(form, mode, id);
    if (formName === "exam") upsertExam(form, mode, id);
    if (formName === "habit") upsertHabit(form, mode, id);
    if (formName === "weekly") upsertWeeklyTask(form, mode, id);
  }

  function handleFilterInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : null;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : null;

    if (target.id === "assignmentSearchInput") updateAssignmentFilters({ search: target.value });
    if (target.id === "assignmentSubjectInput") updateAssignmentFilters({ subject: target.value });
    if (target.id === "assignmentStatusSelect") updateAssignmentFilters({ status: target.value });
    if (target.id === "assignmentPrioritySelect") updateAssignmentFilters({ priority: target.value });
    if (target.id === "assignmentSortSelect") updateAssignmentFilters({ sort: target.value });

    if (target.id === "assignmentSearchInput" || target.id === "assignmentSubjectInput") {
      global.requestAnimationFrame(() => {
        const replacement = document.getElementById(target.id);
        if (!replacement) {
          return;
        }

        replacement.focus();
        if (typeof replacement.selectionStart === "number" && selectionStart !== null) {
          replacement.selectionStart = selectionStart;
          replacement.selectionEnd = selectionEnd;
        }
      });
    }
  }

  function handleKeyboardShortcuts(event) {
    if (isTypingTarget(event.target)) {
      if (event.key === "Escape" && runtime.modal) {
        closeModal();
      }
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "?") {
      event.preventDefault();
      runtime.modal = { type: "shortcuts", mode: "view", item: null };
      renderModal();
    }

    if (key === "n") openModal("assignment");
    if (key === "e") openModal("exam");
    if (key === "h") openModal("habit");
    if (key === "t") openModal("weekly");
    if (key === "f") toggleFocusMode();
    if (key === "p") togglePomodoro();
    if (key === "/") {
      event.preventDefault();
      const input = document.getElementById("assignmentSearchInput");
      if (input) {
        input.focus();
      }
    }
    if (event.key === "Escape" && runtime.modal) {
      closeModal();
    }
  }

  function handleDragStart(event) {
    const assignmentCard = event.target.closest("[data-drag-assignment-id]");
    if (assignmentCard) {
      runtime.dragAssignmentId = assignmentCard.dataset.dragAssignmentId;
      assignmentCard.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      return;
    }

    const weeklyCard = event.target.closest("[data-drag-weekly-id]");
    if (weeklyCard) {
      runtime.dragWeeklyId = weeklyCard.dataset.dragWeeklyId;
      weeklyCard.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragEnd(event) {
    const dragTarget = event.target.closest("[data-drag-assignment-id], [data-drag-weekly-id]");
    if (dragTarget) {
      dragTarget.classList.remove("dragging");
    }

    document.querySelectorAll(".drag-active").forEach((element) => element.classList.remove("drag-active"));
    runtime.dragAssignmentId = null;
    runtime.dragWeeklyId = null;
  }

  function handleDragOver(event) {
    const column = event.target.closest("[data-drop-status], [data-drop-date]");
    if (!column) {
      return;
    }

    event.preventDefault();
    column.classList.add("drag-active");
  }

  function handleDragLeave(event) {
    const column = event.target.closest("[data-drop-status], [data-drop-date]");
    if (!column) {
      return;
    }

    column.classList.remove("drag-active");
  }

  function handleDrop(event) {
    const assignmentColumn = event.target.closest("[data-drop-status]");
    if (assignmentColumn && runtime.dragAssignmentId) {
      event.preventDefault();
      assignmentColumn.classList.remove("drag-active");
      setAssignmentStatus(runtime.dragAssignmentId, assignmentColumn.dataset.dropStatus);
      showToast("Assignment status updated.");
      return;
    }

    const weeklyColumn = event.target.closest("[data-drop-date]");
    if (weeklyColumn && runtime.dragWeeklyId) {
      event.preventDefault();
      weeklyColumn.classList.remove("drag-active");
      moveWeeklyTask(runtime.dragWeeklyId, weeklyColumn.dataset.dropDate);
    }
  }

  function bindEvents() {
    dom.sidebarToggleBtn.addEventListener("click", toggleSidebar);
    dom.jumpPlannerBtn.addEventListener("click", () => {
      setPlannerTab("weekly");
      openModal("weekly");
      jumpToSection("section-planner");
    });
    dom.focusModeBtn.addEventListener("click", toggleFocusMode);
    dom.notificationBtn.addEventListener("click", toggleNotifications);
    dom.themeCycleBtn.addEventListener("click", cycleTheme);
    dom.exportBtn.addEventListener("click", exportData);
    dom.importBtn.addEventListener("click", importData);
    dom.importInput.addEventListener("change", handleImportChange);

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("submit", handleFormSubmit);
    document.addEventListener("input", handleFilterInput);
    document.addEventListener("change", handleFilterInput);
    document.addEventListener("keydown", handleKeyboardShortcuts);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
  }

  function reconcileRecoveredTimer() {
    const timer = state.planner.focusTimer;
    if (!timer.running || !timer.endsAt) {
      return;
    }

    const parts = getCountdownParts(timer.endsAt);
    if (parts && parts.expired) {
      completePomodoro();
    }
  }

  function init() {
    if (runtime.initialized) {
      renderApp();
      return;
    }

    cacheDom();
    state = storage.loadState();
    bindEvents();
    reconcileRecoveredTimer();
    renderApp();
    startIntervals();
    sendDueReminders();
    runtime.initialized = true;
  }

  App.app = {
    init
  };
})(window);
