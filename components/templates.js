(function initializeTemplates(global) {
  const App = (global.StudentDashboard = global.StudentDashboard || {});
  const { escapeHtml } = App.helpers;
  const {
    formatCountdown,
    formatDate,
    formatDateTime,
    formatLongDate,
    formatRelativeDue
  } = App.dateUtils;
  const {
    ASSIGNMENT_STATUSES,
    DAYS,
    KEYBOARD_SHORTCUTS,
    SECTION_LABELS,
    SECTION_ORDER,
    THEMES
  } = App.constants;

  function toDateInputValue(value) {
    if (!value) {
      return "";
    }

    return String(value).slice(0, 10);
  }

  function renderEmptyState(title, message, actionLabel, actionName) {
    return `
      <div class="empty-state">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          ${actionLabel && actionName ? `<div class="panel-actions"><button type="button" class="button-primary" data-action="${escapeHtml(actionName)}">${escapeHtml(actionLabel)}</button></div>` : ""}
        </div>
      </div>
    `;
  }

  function renderSidebar(model) {
    return `
      <div class="sidebar-brand">
        <div class="brand-mark" aria-hidden="true">SPD</div>
        <div class="brand-copy">
          <p class="eyebrow">Portfolio build</p>
          <h1 class="brand-title">${escapeHtml(model.appName)}</h1>
          <p>${escapeHtml(model.tagline)}</p>
        </div>
      </div>

      <nav class="sidebar-nav">
        ${SECTION_ORDER.map((sectionKey) => {
          const active = model.activeSection === sectionKey ? "active" : "";
          return `
            <button type="button" class="nav-link ${active}" data-action="jump-section" data-target="section-${sectionKey}">
              <span class="nav-copy">${escapeHtml(SECTION_LABELS[sectionKey])}</span>
              <span class="toggle-state">${escapeHtml(model.sectionMeta[sectionKey] || "")}</span>
            </button>
          `;
        }).join("")}
      </nav>

      <div class="sidebar-mini">
        <article class="mini-stat">
          <span class="eyebrow">Pending</span>
          <strong>${model.pendingAssignments}</strong>
        </article>
        <article class="mini-stat">
          <span class="eyebrow">Focus</span>
          <strong>${model.focusMinutes}m</strong>
        </article>
      </div>

      <article class="sidebar-footer">
        <p class="eyebrow">Today</p>
        <p class="subtle">${escapeHtml(model.todayLine)}</p>
        <ul class="feature-list">
          <li>${escapeHtml(model.sidebarHintA)}</li>
          <li>${escapeHtml(model.sidebarHintB)}</li>
        </ul>
      </article>
    `;
  }

  function renderOverview(model) {
    const urgentItems = model.urgentAssignments.length
      ? `
        <ul class="bullet-list">
          ${model.urgentAssignments
            .map((item) => `
              <li>
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <p class="subtle">${escapeHtml(item.subject)} · ${escapeHtml(item.dueLabel)}</p>
                </div>
                <button type="button" class="mini-button" data-action="open-assignment-modal" data-id="${item.id}">Review</button>
              </li>
            `)
            .join("")}
        </ul>
      `
      : renderEmptyState("No urgent deadlines", "Your nearest assignments are under control right now.", "Add assignment", "new-assignment");

    return `
      <div class="section-head">
        <div class="section-copy">
          <p class="eyebrow">Student productivity workspace</p>
          <h2 class="hero-title" id="overviewTitle">Calm planning, better focus, stronger delivery.</h2>
          <p class="hero-copy">${escapeHtml(model.copy)}</p>
          <div class="tag-row">
            <span class="stat-pill">${escapeHtml(model.welcomeLabel)}</span>
            <span class="stat-pill">${escapeHtml(model.semesterLabel)}</span>
          </div>
          <div class="hero-actions">
            <button type="button" class="button-primary" data-action="new-assignment">New assignment</button>
            <button type="button" class="button-secondary" data-action="new-exam">Schedule exam</button>
            <button type="button" class="button-ghost" data-action="new-habit">Add habit</button>
            <button type="button" class="button-primary" data-action="open-semester-modal">View semester</button>
          </div>
        </div>
      </div>

      <div class="hero-layout">
        <article class="story-card">
          <p class="eyebrow">Today focus</p>
          <h3 class="card-title">${escapeHtml(model.focusHeadline)}</h3>
          <p class="subtle">${escapeHtml(model.focusMeta)}</p>

          <div class="quick-grid">
            <article class="quick-card">
              <p class="eyebrow">Urgent queue</p>
              ${urgentItems}
            </article>
            <article class="quick-card">
              <p class="eyebrow">Momentum note</p>
              <h3 class="card-title">${escapeHtml(model.quote)}</h3>
              <p class="subtle">${escapeHtml(model.summaryLine)}</p>
            </article>
          </div>
        </article>

        <article class="live-card" aria-live="polite">
          <p class="eyebrow">Live clock</p>
          <strong class="card-title" id="liveDate">${escapeHtml(model.liveDate)}</strong>
          <div class="timer-display" id="liveTime">${escapeHtml(model.liveTime)}</div>
          <p class="subtle">${escapeHtml(model.clockHint)}</p>
          <div class="tag-row">
            <span class="stat-pill">${escapeHtml(model.themeLabel)}</span>
            <span class="stat-pill">${escapeHtml(model.notificationLabel)}</span>
          </div>
        </article>
      </div>

      <div class="metric-grid">
        ${model.metrics
          .map((metric) => `
            <article class="metric-card">
              <span class="metric-label">${escapeHtml(metric.label)}</span>
              <strong class="metric-value">${escapeHtml(metric.value)}</strong>
              <p class="metric-hint">${escapeHtml(metric.hint)}</p>
            </article>
          `)
          .join("")}
      </div>
    `;
  }

  function renderSectionHead(title, subtitle, sectionKey, actionsMarkup, collapsed) {
    return `
      <div class="section-head">
        <div class="section-copy">
          <p class="eyebrow">${escapeHtml(SECTION_LABELS[sectionKey] || sectionKey)}</p>
          <h2 class="section-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="panel-actions">
          ${actionsMarkup}
          <button type="button" class="button-ghost" data-action="toggle-section" data-section="${escapeHtml(sectionKey)}">${collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>
    `;
  }

  function renderTagRow(tags) {
    if (!tags.length) {
      return "";
    }

    return `
      <div class="tag-list">
        ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  }

  function renderAssignmentCard(assignment) {
    const statusMeta = ASSIGNMENT_STATUSES[assignment.status] || ASSIGNMENT_STATUSES.todo;

    return `
      <article class="assignment-card" draggable="true" data-drag-assignment-id="${assignment.id}">
        <div class="card-top">
          <div>
            <span class="status-badge ${escapeHtml(assignment.statusBadgeClass)}">${escapeHtml(assignment.statusLabel || statusMeta.label)}</span>
            <h3 class="card-title">${escapeHtml(assignment.title)}</h3>
            <p class="subtle">${escapeHtml(assignment.subject)} · ${escapeHtml(assignment.dueLabel)}</p>
          </div>
          <span class="priority-badge priority-${escapeHtml(assignment.priority.level)}">${escapeHtml(assignment.priority.label)}</span>
        </div>
        ${assignment.description ? `<p class="subtle">${escapeHtml(assignment.description)}</p>` : ""}
        ${renderTagRow(assignment.tags)}
        <div class="meta-row">
          <span>${escapeHtml(assignment.attachmentLabel)}</span>
          <span>${escapeHtml(assignment.noteLabel)}</span>
          <span>${escapeHtml(assignment.createdLabel)}</span>
        </div>
        <div class="card-actions">
          <div class="action-group">
            ${assignment.status !== "completed" ? `<button type="button" class="mini-button" data-action="advance-assignment" data-id="${assignment.id}">${escapeHtml(assignment.advanceLabel)}</button>` : ""}
            <button type="button" class="mini-button" data-action="open-assignment-modal" data-id="${assignment.id}">Edit</button>
          </div>
          <div class="action-group">
            <button type="button" class="mini-button" data-action="toggle-assignment-complete" data-id="${assignment.id}">${escapeHtml(assignment.toggleLabel)}</button>
            ${assignment.status === "completed"
              ? `<button type="button" class="button-danger mini-button" data-action="delete-assignment" data-id="${assignment.id}">Delete task</button>`
              : ""}
          </div>
        </div>
      </article>
    `;
  }

  function renderPlanner(model) {
    const plannerTabs = App.constants.PLANNER_TABS
      .map((tabKey) => {
        const active = model.activeTab === tabKey ? "active" : "";
        let label = tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
        if (tabKey === "weekly") label = "30 days";
        return `<button type="button" class="tab-button ${active}" data-action="set-planner-tab" data-tab="${tabKey}">${escapeHtml(label)}</button>`;
      })
      .join("");

    let tabMarkup = "";

    if (model.activeTab === "assignments") {
      tabMarkup = `
        <div class="planner-meta">
          <article class="quick-card">
            <p class="eyebrow">Assignment controls</p>
            <div class="control-grid">
              <div class="field-inline">
                <label for="assignmentSearchInput">Search</label>
                <input id="assignmentSearchInput" type="search" value="${escapeHtml(model.filters.search)}" placeholder="Search assignments or tags" />
              </div>
              <div class="field-inline">
                <label for="assignmentStatusSelect">Status</label>
                <select id="assignmentStatusSelect">
                  <option value="all" ${model.filters.status === "all" ? "selected" : ""}>All statuses</option>
                  <option value="todo" ${model.filters.status === "todo" ? "selected" : ""}>To do</option>
                  <option value="in_progress" ${model.filters.status === "in_progress" ? "selected" : ""}>In progress</option>
                  <option value="completed" ${model.filters.status === "completed" ? "selected" : ""}>Completed</option>
                  <option value="overdue" ${model.filters.status === "overdue" ? "selected" : ""}>Overdue</option>
                </select>
              </div>
              <div class="field-inline">
                <label for="assignmentPrioritySelect">Priority</label>
                <select id="assignmentPrioritySelect">
                  <option value="all" ${model.filters.priority === "all" ? "selected" : ""}>All priorities</option>
                  <option value="high" ${model.filters.priority === "high" ? "selected" : ""}>High</option>
                  <option value="medium" ${model.filters.priority === "medium" ? "selected" : ""}>Medium</option>
                  <option value="low" ${model.filters.priority === "low" ? "selected" : ""}>Low</option>
                </select>
              </div>
              <div class="field-inline">
                <label for="assignmentSubjectInput">Subject</label>
                <input id="assignmentSubjectInput" type="text" value="${escapeHtml(model.filters.subject)}" placeholder="Filter by subject" />
              </div>
              <div class="field-inline">
                <label for="assignmentSortSelect">Sort</label>
                <select id="assignmentSortSelect">
                  <option value="dueSoon" ${model.filters.sort === "dueSoon" ? "selected" : ""}>Due soon</option>
                  <option value="priorityHigh" ${model.filters.sort === "priorityHigh" ? "selected" : ""}>Priority high</option>
                  <option value="alphabetical" ${model.filters.sort === "alphabetical" ? "selected" : ""}>Alphabetical</option>
                  <option value="newest" ${model.filters.sort === "newest" ? "selected" : ""}>Newest first</option>
                </select>
              </div>
            </div>
          </article>
          <article class="quick-card">
            <p class="eyebrow">Planner insight</p>
            <h3 class="card-title">${escapeHtml(model.assignmentInsight.title)}</h3>
            <p class="subtle">${escapeHtml(model.assignmentInsight.body)}</p>
            <div class="tag-row">
              <span class="stat-pill">${escapeHtml(model.assignmentInsight.statA)}</span>
              <span class="stat-pill">${escapeHtml(model.assignmentInsight.statB)}</span>
            </div>
          </article>
        </div>
        <div class="board-grid">
          ${model.columns
            .map((column) => `
              <section class="board-column" data-drop-status="${column.key}">
                <div class="column-head">
                  <div>
                    <p class="eyebrow">${escapeHtml(column.caption)}</p>
                    <h3 class="board-title">${escapeHtml(column.title)}</h3>
                  </div>
                  <span class="stat-pill">${column.items.length}</span>
                </div>
                <div class="board-list">
                  ${column.items.length
                    ? column.items.map(renderAssignmentCard).join("")
                    : renderEmptyState(column.emptyTitle, column.emptyMessage, "Add assignment", "new-assignment")}
                </div>
              </section>
            `)
            .join("")}
        </div>
      `;
    }

    if (model.activeTab === "exams") {
      tabMarkup = `
        <div class="planner-meta">
          <article class="quick-card">
            <p class="eyebrow">Exam readiness</p>
            <h3 class="card-title">${escapeHtml(model.examInsight.title)}</h3>
            <p class="subtle">${escapeHtml(model.examInsight.body)}</p>
          </article>
          <article class="quick-card">
            <p class="eyebrow">Reminder windows</p>
            <ul class="meta-list">
              <li>Automatic alerts for exam countdown windows.</li>
              <li>Live second-by-second countdowns on each exam card.</li>
              <li>Urgency styling for today, soon, and longer-term exams.</li>
            </ul>
          </article>
        </div>
        <div class="exam-grid">
          ${model.exams.length
            ? model.exams
                .map((exam) => `
                  <article class="exam-card">
                    <div class="countdown-row">
                      <div>
                        <p class="eyebrow">${escapeHtml(exam.subject)}</p>
                        <h3 class="card-title">${escapeHtml(exam.name)}</h3>
                      </div>
                      <span class="status-badge urgency-chip ${escapeHtml(exam.urgencyClass)}">${escapeHtml(exam.urgencyLabel)}</span>
                    </div>
                    <strong class="countdown-value" data-countdown-date="${escapeHtml(exam.date)}">${escapeHtml(formatCountdown(exam.date))}</strong>
                    <p class="subtle">${escapeHtml(formatLongDate(exam.date))}${exam.location ? ` · ${escapeHtml(exam.location)}` : ""}</p>
                    ${exam.notes ? `<p class="subtle">${escapeHtml(exam.notes)}</p>` : ""}
                    <div class="meta-row">
                      <span>${escapeHtml(exam.reminderLabel)}</span>
                      <span>Created ${escapeHtml(formatDate(exam.createdAt))}</span>
                    </div>
                    <div class="card-actions">
                      <div class="action-group">
                        <button type="button" class="mini-button" data-action="open-exam-modal" data-id="${exam.id}">Edit</button>
                      </div>
                      <div class="action-group">
                        <button type="button" class="button-danger mini-button" data-action="delete-exam" data-id="${exam.id}">Delete</button>
                      </div>
                    </div>
                  </article>
                `)
                .join("")
            : renderEmptyState("No exams yet", "Add your upcoming exams to unlock countdowns and reminders.", "Add exam", "new-exam")}
        </div>
      `;
    }

    if (model.activeTab === "weekly") {
      const calendarRows = model.calendarRows || [];
      tabMarkup = `
        <article class="quick-card month-nav-card">
          <div class="month-nav">
            <button type="button" class="button-ghost" data-action="prev-planner-month">Previous month</button>
            <div>
              <p class="eyebrow">Current month</p>
              <strong>${escapeHtml(model.currentMonthLabel)}</strong>
            </div>
            <button type="button" class="button-ghost" data-action="next-planner-month">Next month</button>
            <button type="button" class="button-primary" data-action="current-planner-month">Current month</button>
          </div>
          <p class="subtle">${escapeHtml(model.monthlyHint)}</p>
        </article>
        <div class="week-grid">
          ${calendarRows
            .map((row, rowIndex) => {
              if (rowIndex === 0) {
                return row
                  .map((day) => `
                    <div class="week-column week-header-column">
                      <div class="week-column-head">
                        <div>
                          <p class="eyebrow">${escapeHtml(day.label)}</p>
                          <h3 class="board-title">${escapeHtml(day.label)}</h3>
                        </div>
                      </div>
                    </div>
                  `)
                  .join("");
              }

              return row
                .map((day) => `
                  <section class="week-column ${day.isToday ? "today" : ""} ${day.isCurrentMonth ? "" : "outside-month"}" data-drop-date="${escapeHtml(day.key)}">
                    <div class="week-column-head">
                      <div>
                        <p class="eyebrow">${escapeHtml(day.dayLabel)}</p>
                        <h3 class="board-title">${escapeHtml(String(day.dayNumber))}</h3>
                      </div>
                      <span class="stat-pill">${day.tasks.length}</span>
                    </div>
                    <div class="week-task-list">
                      ${day.tasks.length
                        ? day.tasks
                            .map((task) => `
                              <article class="week-task" draggable="true" data-drag-weekly-id="${task.id}">
                                <strong>${escapeHtml(task.title)}</strong>
                                <p class="subtle">${escapeHtml(day.dayLabel)} • ${escapeHtml(day.monthLabel)} ${escapeHtml(String(day.dayNumber))}</p>
                                ${task.notes ? `<p class="subtle">${escapeHtml(task.notes)}</p>` : ""}
                                <div class="card-actions">
                                  <div class="action-group">
                                    <button type="button" class="mini-button" data-action="open-weekly-modal" data-id="${task.id}">Edit</button>
                                  </div>
                                  <div class="action-group">
                                    <button type="button" class="button-danger mini-button" data-action="delete-weekly" data-id="${task.id}">Delete</button>
                                  </div>
                                </div>
                              </article>
                            `)
                            .join("")
                        : `<p class="subtle">No tasks planned</p>`}
                    </div>
                  </section>
                `)
                .join("");
            })
            .join("")}
        </div>
      `;
    }

    const bodyHidden = model.collapsed ? "hidden" : "";

    return `
      ${renderSectionHead("Plan Center", "Assignments, exams, and monthly planning stay connected in one workspace.", "planner", `
        <button type="button" class="button-primary" data-action="new-${model.activeTab === "assignments" ? "assignment" : model.activeTab === "exams" ? "exam" : "weekly"}">Add ${model.activeTab === "weekly" ? "task" : model.activeTab.slice(0, -1)}</button>
      `, model.collapsed)}
      <div class="section-body" ${bodyHidden}>
        <div class="tab-bar">${plannerTabs}</div>
        ${tabMarkup}
      </div>
    `;
  }

  function renderHabitCard(habit) {
    return `
      <article class="habit-card">
        <div class="habit-card-head">
          <div>
            <p class="eyebrow">Daily habit</p>
            <h3 class="habit-title">${escapeHtml(habit.name)}</h3>
          </div>
          <span class="stat-pill">${escapeHtml(habit.monthLabel)}</span>
        </div>
        <div class="analytics-overview">
          <article class="metric-card">
            <span class="metric-label">Current streak</span>
            <strong class="metric-value">${habit.currentStreak}</strong>
            <p class="metric-hint">days in a row</p>
          </article>
          <article class="metric-card">
            <span class="metric-label">Longest streak</span>
            <strong class="metric-value">${habit.longestStreak}</strong>
            <p class="metric-hint">best run</p>
          </article>
        </div>
        <div class="history-row" aria-label="Last 14 days of habit history">
          ${habit.historyDays
            .map((day) => `<div class="history-day ${day.done ? "done" : ""}" title="${escapeHtml(day.label)}"></div>`)
            .join("")}
        </div>
        <div class="card-actions">
          <div class="action-group">
            <button type="button" class="mini-button" data-action="toggle-habit-today" data-id="${habit.id}">${escapeHtml(habit.toggleLabel)}</button>
            <button type="button" class="mini-button" data-action="open-habit-modal" data-id="${habit.id}">Edit</button>
          </div>
          <div class="action-group">
            <button type="button" class="button-danger mini-button" data-action="delete-habit" data-id="${habit.id}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderHabits(model) {
    const bodyHidden = model.collapsed ? "hidden" : "";

    return `
      ${renderSectionHead("Habit Engine", "History-based habit tracking with streaks, monthly coverage, and yearly-ready data.", "habits", `
        <button type="button" class="button-primary" data-action="new-habit">Add habit</button>
      `, model.collapsed)}
      <div class="section-body" ${bodyHidden}>
        <div class="analytics-overview">
          ${model.summaryCards
            .map((card) => `
              <article class="metric-card">
                <span class="metric-label">${escapeHtml(card.label)}</span>
                <strong class="metric-value">${escapeHtml(card.value)}</strong>
                <p class="metric-hint">${escapeHtml(card.hint)}</p>
              </article>
            `)
            .join("")}
        </div>
        <div class="habit-grid">
          ${model.habits.length
            ? model.habits.map(renderHabitCard).join("")
            : renderEmptyState("No habits yet", "Start with one small daily behavior and grow consistency from there.", "Add habit", "new-habit")}
        </div>
      </div>
    `;
  }

  function renderAnalytics(model) {
    const bodyHidden = model.collapsed ? "hidden" : "";

    return `
      ${renderSectionHead("Analytics Studio", "Track delivery quality, consistency, and deep work with structured frontend analytics.", "analytics", "", model.collapsed)}
      <div class="section-body" ${bodyHidden}>
        <div class="analytics-overview">
          ${model.cards
            .map((card) => `
              <article class="metric-card">
                <span class="metric-label">${escapeHtml(card.label)}</span>
                <strong class="stats-value">${escapeHtml(card.value)}</strong>
                <p class="metric-hint">${escapeHtml(card.hint)}</p>
              </article>
            `)
            .join("")}
        </div>

        <div class="focus-grid">
          <article class="chart-shell">
            <div class="card-head">
              <div>
                <p class="eyebrow">Weekly progress</p>
                <h3 class="card-title">Assignments, habits, and focus minutes</h3>
              </div>
            </div>
            <canvas id="analyticsChart" width="600" height="280" aria-label="Weekly productivity chart"></canvas>
          </article>

          <article class="heatmap-shell">
            <div class="card-head">
              <div>
                <p class="eyebrow">Activity heatmap</p>
                <h3 class="card-title">Last 35 days of completed work</h3>
              </div>
            </div>
            <div class="heatmap-grid">
              ${model.heatmapCells
                .map((cell) => `<div class="heatmap-cell ${escapeHtml(cell.levelClass)}" title="${escapeHtml(cell.label)}"></div>`)
                .join("")}
            </div>
            <div class="legend-row">
              <span class="subtle">Low</span>
              <span class="legend-chip heatmap-cell level-1"></span>
              <span class="legend-chip heatmap-cell level-2"></span>
              <span class="legend-chip heatmap-cell level-3"></span>
              <span class="legend-chip heatmap-cell level-4"></span>
              <span class="subtle">High</span>
            </div>
          </article>
        </div>
      </div>
    `;
  }

  function renderFocus(model) {
    const bodyHidden = model.collapsed ? "hidden" : "";

    return `
      ${renderSectionHead("Focus Lab", "Pomodoro timing, sound alerts, and structured focus session analytics.", "focus", `
        <button type="button" class="button-secondary ${model.focusMode ? "active" : ""}" data-action="toggle-focus-mode">${model.focusMode ? "Exit focus mode" : "Enter focus mode"}</button>
      `, model.collapsed)}
      <div class="section-body" ${bodyHidden}>
        <div class="focus-grid">
          <article class="pomodoro-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Pomodoro timer</p>
                <h3 class="card-title">${escapeHtml(model.timerLabel)}</h3>
                <p class="subtle">${escapeHtml(model.timerHint)}</p>
              </div>
              <div class="timer-display" id="pomodoroDisplay">${escapeHtml(model.timerDisplay)}</div>
            </div>
            <div class="tag-row">
              <span class="stat-pill">Mode: <strong>${escapeHtml(model.modeLabel)}</strong></span>
              <span class="stat-pill">Cycles: <strong id="pomodoroCycles">${escapeHtml(String(model.cycleCount))}</strong></span>
            </div>
            <div class="panel-actions">
              <button type="button" class="button-primary" data-action="toggle-pomodoro">${escapeHtml(model.primaryButtonLabel)}</button>
              <button type="button" class="button-secondary" data-action="reset-pomodoro">Reset</button>
              <button type="button" class="button-ghost" data-action="skip-pomodoro-mode">Skip mode</button>
            </div>
            <div class="preset-row">
              ${model.presets
                .map((preset) => `
                  <button type="button" class="tab-button ${preset.active ? "active" : ""}" data-action="set-preset" data-preset="${preset.id}">
                    ${escapeHtml(preset.label)}
                  </button>
                `)
                .join("")}
            </div>
          </article>

          <article class="session-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Session analytics</p>
                <h3 class="card-title">Recent focus sessions</h3>
              </div>
            </div>
            <div class="analytics-overview">
              ${model.focusStats
                .map((stat) => `
                  <article class="metric-card">
                    <span class="metric-label">${escapeHtml(stat.label)}</span>
                    <strong class="metric-value">${escapeHtml(stat.value)}</strong>
                    <p class="metric-hint">${escapeHtml(stat.hint)}</p>
                  </article>
                `)
                .join("")}
            </div>
            <ul class="session-list">
              ${model.sessions.length
                ? model.sessions
                    .map((session) => `
                      <li class="session-item">
                        <div>
                          <strong>${escapeHtml(session.label)}</strong>
                          <p>${escapeHtml(formatDateTime(session.completedAt))}</p>
                        </div>
                        <span class="stat-pill">${escapeHtml(session.minutes)}m</span>
                      </li>
                    `)
                    .join("")
                : `<li class="session-item"><p class="subtle">Complete your first work session to populate analytics.</p></li>`}
            </ul>
          </article>
        </div>
      </div>
    `;
  }

  function renderSettings(model) {
    const bodyHidden = model.collapsed ? "hidden" : "";

    return `
      ${renderSectionHead("Settings and Data", "Theme persistence, local export/import, notifications, sounds, and keyboard shortcuts.", "settings", `
        <button type="button" class="button-secondary" data-action="open-shortcuts">Shortcuts</button>
      `, model.collapsed)}
      <div class="section-body" ${bodyHidden}>
        <div class="settings-grid">
          <article class="setting-card">
            <div class="setting-card-head">
              <div>
                <p class="eyebrow">Profile</p>
                <h3 class="card-title">Student details</h3>
              </div>
            </div>
            <div class="profile-form">
              <div class="field-group">
                <label for="profileNameInput">Your name</label>
                <input id="profileNameInput" type="text" value="${escapeHtml(model.profileName)}" placeholder="Enter your name" />
              </div>
              <div class="field-group">
                <label for="profileSemesterInput">Current semester</label>
                <input id="profileSemesterInput" type="text" value="${escapeHtml(model.profileSemester)}" placeholder="Spring 2026" />
              </div>
              <div class="panel-actions">
                <button type="button" class="button-primary" data-action="save-profile">Save profile</button>
                <button type="button" class="button-ghost" data-action="clear-profile">Clear name</button>
              </div>
              <p class="subtle">Saved locally in your browser, and you can remove the name at any time.</p>
            </div>
          </article>

          <article class="setting-card">
            <div class="setting-card-head">
              <div>
                <p class="eyebrow">Appearance</p>
                <h3 class="card-title">Theme system</h3>
              </div>
            </div>
            <div class="theme-swatches">
              ${THEMES.map((theme) => `
                <button type="button" class="theme-swatch ${model.theme === theme.id ? "active" : ""}" data-action="set-theme" data-theme="${theme.id}">
                  <span><strong>${escapeHtml(theme.label)}</strong></span>
                  <span class="subtle">${escapeHtml(theme.note)}</span>
                </button>
              `).join("")}
            </div>
          </article>

          <article class="setting-card">
            <div class="setting-card-head">
              <div>
                <p class="eyebrow">Productivity controls</p>
                <h3 class="card-title">Runtime preferences</h3>
              </div>
            </div>
            <div class="toggle-grid">
              <button type="button" class="toggle-button ${model.notificationsEnabled ? "active" : ""}" data-action="toggle-notifications">
                <span>Notifications</span>
                <span class="toggle-state">${model.notificationsEnabled ? "On" : "Off"}</span>
              </button>
              <button type="button" class="toggle-button ${model.soundsEnabled ? "active" : ""}" data-action="toggle-sounds">
                <span>Sound alerts</span>
                <span class="toggle-state">${model.soundsEnabled ? "On" : "Off"}</span>
              </button>
              <button type="button" class="toggle-button ${model.focusMode ? "active" : ""}" data-action="toggle-focus-mode">
                <span>Focus mode</span>
                <span class="toggle-state">${model.focusMode ? "On" : "Off"}</span>
              </button>
              <button type="button" class="toggle-button ${model.sidebarCollapsed ? "active" : ""}" data-action="toggle-sidebar">
                <span>Compact sidebar</span>
                <span class="toggle-state">${model.sidebarCollapsed ? "On" : "Off"}</span>
              </button>
            </div>
          </article>

          <article class="setting-card">
            <div class="setting-card-head">
              <div>
                <p class="eyebrow">Data layer</p>
                <h3 class="card-title">Structured local storage</h3>
              </div>
            </div>
            <ul class="meta-list">
              <li>Version: ${escapeHtml(model.version)}</li>
              <li>Created: ${escapeHtml(formatDateTime(model.createdAt))}</li>
              <li>Last updated: ${escapeHtml(formatDateTime(model.lastUpdated))}</li>
            </ul>
            <p class="subtle">Plans are saved automatically after every change. Use Save now to force a local save immediately.</p>
            <div class="panel-actions">
              <button type="button" class="button-primary" data-action="save-now">Save now</button>
              <button type="button" class="button-primary" data-action="export-data">Export JSON</button>
              <button type="button" class="button-secondary" data-action="import-data">Import JSON</button>
              <button type="button" class="button-danger" data-action="reset-data">Reset demo data</button>
            </div>
          </article>

          <article class="setting-card">
            <div class="setting-card-head">
              <div>
                <p class="eyebrow">Deployment help</p>
                <h3 class="card-title">Production notes</h3>
              </div>
            </div>
            <ul class="feature-list">
              <li>Serve over http://localhost or HTTPS to enable service worker support.</li>
              <li>Notifications require browser permission before reminders can fire.</li>
              <li>Chart.js analytics update automatically as local state changes.</li>
            </ul>
          </article>
        </div>
      </div>
    `;
  }

  function renderAssignmentForm(item, mode) {
    const assignment = item || {};
    return `
      <form class="form-grid" data-form="assignment" data-mode="${mode}" data-id="${escapeHtml(assignment.id || "")}">
        <div class="field-group">
          <label for="assignmentTitleField">Title</label>
          <input id="assignmentTitleField" name="title" type="text" value="${escapeHtml(assignment.title || "")}" required />
        </div>
        <div class="field-group">
          <label for="assignmentDescriptionField">Description</label>
          <textarea id="assignmentDescriptionField" name="description" placeholder="What needs to be delivered?">${escapeHtml(assignment.description || "")}</textarea>
        </div>
        <div class="control-grid">
          <div class="field-group">
            <label for="assignmentSubjectField">Subject</label>
            <input id="assignmentSubjectField" name="subject" type="text" value="${escapeHtml(assignment.subject || "")}" />
          </div>
          <div class="field-group">
            <label for="assignmentTagsField">Tags</label>
            <input id="assignmentTagsField" name="tags" type="text" value="${escapeHtml((assignment.tags || []).join(", "))}" placeholder="lab, coding, revision" />
          </div>
          <div class="field-group">
            <label for="assignmentStatusField">Status</label>
            <select id="assignmentStatusField" name="status">
              ${Object.entries(ASSIGNMENT_STATUSES)
                .map(([key, meta]) => `<option value="${key}" ${(assignment.status || "todo") === key ? "selected" : ""}>${escapeHtml(meta.label)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field-group">
            <label for="assignmentPriorityField">Priority</label>
            <select id="assignmentPriorityField" name="priority">
              <option value="high" ${assignment.priority && assignment.priority.level === "high" ? "selected" : ""}>High</option>
              <option value="medium" ${!assignment.priority || assignment.priority.level === "medium" ? "selected" : ""}>Medium</option>
              <option value="low" ${assignment.priority && assignment.priority.level === "low" ? "selected" : ""}>Low</option>
            </select>
          </div>
          <div class="field-group">
            <label for="assignmentDueDateField">Due date</label>
            <input id="assignmentDueDateField" name="dueDate" type="date" value="${escapeHtml(toDateInputValue(assignment.dueDate))}" />
          </div>
        </div>
        <div class="field-group">
          <label for="assignmentAttachmentsField">Attachments</label>
          <input id="assignmentAttachmentsField" name="attachments" type="text" value="${escapeHtml((assignment.attachments || []).join(", "))}" placeholder="Drive link, PDF link" />
        </div>
        <div class="field-group">
          <label for="assignmentNotesField">Notes</label>
          <textarea id="assignmentNotesField" name="notes" placeholder="Extra context, rubric notes, checklist">${escapeHtml(assignment.notes || "")}</textarea>
        </div>
        <div class="modal-footer">
          <div class="panel-actions">
            ${mode === "edit" ? `<button type="button" class="button-danger" data-action="delete-assignment" data-id="${escapeHtml(assignment.id)}">Delete</button>` : ""}
          </div>
          <div class="panel-actions">
            <button type="button" class="button-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="button-primary">${mode === "edit" ? "Save assignment" : "Create assignment"}</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderExamForm(item, mode) {
    const exam = item || {};
    return `
      <form class="form-grid" data-form="exam" data-mode="${mode}" data-id="${escapeHtml(exam.id || "")}">
        <div class="field-group">
          <label for="examNameField">Exam name</label>
          <input id="examNameField" name="name" type="text" value="${escapeHtml(exam.name || "")}" required />
        </div>
        <div class="control-grid">
          <div class="field-group">
            <label for="examSubjectField">Subject</label>
            <input id="examSubjectField" name="subject" type="text" value="${escapeHtml(exam.subject || "")}" />
          </div>
          <div class="field-group">
            <label for="examDateField">Date and time</label>
            <input id="examDateField" name="date" type="date" value="${escapeHtml(toDateInputValue(exam.date))}" required />
          </div>
          <div class="field-group">
            <label for="examLocationField">Location</label>
            <input id="examLocationField" name="location" type="text" value="${escapeHtml(exam.location || "")}" />
          </div>
          <div class="field-group">
            <label for="examReminderField">Reminder days</label>
            <input id="examReminderField" name="reminderDays" type="text" value="${escapeHtml((exam.reminderDays || [7, 3, 1]).join(", "))}" placeholder="7, 3, 1" />
          </div>
        </div>
        <div class="field-group">
          <label for="examNotesField">Notes</label>
          <textarea id="examNotesField" name="notes">${escapeHtml(exam.notes || "")}</textarea>
        </div>
        <div class="modal-footer">
          <div class="panel-actions">
            ${mode === "edit" ? `<button type="button" class="button-danger" data-action="delete-exam" data-id="${escapeHtml(exam.id)}">Delete</button>` : ""}
          </div>
          <div class="panel-actions">
            <button type="button" class="button-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="button-primary">${mode === "edit" ? "Save exam" : "Create exam"}</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderHabitForm(item, mode) {
    const habit = item || {};
    return `
      <form class="form-grid" data-form="habit" data-mode="${mode}" data-id="${escapeHtml(habit.id || "")}">
        <div class="field-group">
          <label for="habitNameField">Habit name</label>
          <input id="habitNameField" name="name" type="text" value="${escapeHtml(habit.name || "")}" required />
        </div>
        <div class="control-grid">
          <div class="field-group">
            <label for="habitGoalField">Daily target</label>
            <input id="habitGoalField" name="goal" type="number" min="1" step="1" value="${escapeHtml(String((habit.target && habit.target.goal) || 1))}" />
          </div>
          <div class="field-group">
            <label for="habitFrequencyField">Frequency</label>
            <select id="habitFrequencyField" name="frequency">
              <option value="daily" ${(!habit.target || habit.target.frequency === "daily") ? "selected" : ""}>Daily</option>
              <option value="weekly" ${(habit.target && habit.target.frequency === "weekly") ? "selected" : ""}>Weekly</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <div class="panel-actions">
            ${mode === "edit" ? `<button type="button" class="button-danger" data-action="delete-habit" data-id="${escapeHtml(habit.id)}">Delete</button>` : ""}
          </div>
          <div class="panel-actions">
            <button type="button" class="button-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="button-primary">${mode === "edit" ? "Save habit" : "Create habit"}</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderWeeklyForm(item, mode) {
    const task = item || {};
    return `
      <form class="form-grid" data-form="weekly" data-mode="${mode}" data-id="${escapeHtml(task.id || "")}">
        <div class="field-group">
          <label for="weeklyTitleField">Task</label>
          <input id="weeklyTitleField" name="title" type="text" value="${escapeHtml(task.title || "")}" required />
        </div>
        <div class="control-grid">
          <div class="field-group">
            <label for="weeklyDateField">Date</label>
            <input id="weeklyDateField" name="date" type="date" value="${toDateInputValue(task.date || "")}" required />
          </div>
          <div class="field-group">
            <label for="weeklyNotesField">Notes</label>
            <input id="weeklyNotesField" name="notes" type="text" value="${escapeHtml(task.notes || "")}" />
          </div>
        </div>
        <div class="modal-footer">
          <div class="panel-actions">
            ${mode === "edit" ? `<button type="button" class="button-danger" data-action="delete-weekly" data-id="${escapeHtml(task.id)}">Delete</button>` : ""}
          </div>
          <div class="panel-actions">
            <button type="button" class="button-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="button-primary">${mode === "edit" ? "Save task" : "Create task"}</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderShortcuts() {
    return `
      <div class="shortcut-list">
        ${KEYBOARD_SHORTCUTS.map((shortcut) => `
          <div class="session-item">
            <div>
              <strong>${escapeHtml(shortcut.keys)}</strong>
              <p>${escapeHtml(shortcut.description)}</p>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="modal-footer">
        <div class="panel-actions">
          <button type="button" class="button-primary" data-action="close-modal">Close</button>
        </div>
      </div>
    `;
  }

  function renderSemesterPicker() {
    return `
      <div class="shortcut-list">
        <div class="session-item">
          <div>
            <strong>Semester 5</strong>
            <p>View your fifth-semester subjects and course plan.</p>
          </div>
          <button type="button" class="button-primary" data-action="select-semester" data-semester="5">Open</button>
        </div>
        <div class="session-item">
          <div>
            <strong>Semester 6</strong>
            <p>Review your sixth-semester subjects and credits.</p>
          </div>
          <button type="button" class="button-primary" data-action="select-semester" data-semester="6">Open</button>
        </div>
        <div class="session-item">
          <div>
            <strong>Semester 7</strong>
            <p>Check your seventh-semester electives and core courses.</p>
          </div>
          <button type="button" class="button-primary" data-action="select-semester" data-semester="7">Open</button>
        </div>
        <div class="session-item">
          <div>
            <strong>Semester 8</strong>
            <p>See your final-semester subjects, project work, and internship plan.</p>
          </div>
          <button type="button" class="button-primary" data-action="select-semester" data-semester="8">Open</button>
        </div>
      </div>
      <div class="modal-footer">
        <div class="panel-actions">
          <button type="button" class="button-ghost" data-action="close-modal">Close</button>
        </div>
      </div>
    `;
  }

  function renderSemesterSubjects(semester) {
    const semesterData = {
      5: [
        { code: "21MAB302T", title: "Discrete Mathematics", hours: "3-1-0", credits: 4 },
        { code: "21CSC301T", title: "Formal Language and Automata", hours: "3-0-0", credits: 3 },
        { code: "21CSC302T", title: "Computer Networks", hours: "3-0-0", credits: 3 },
        { code: "21CSC303T", title: "Security Risk Management Principles", hours: "3-0-0", credits: 3 },
        { code: "21GN301L", title: "Community Connect", hours: "0-0-2", credits: 1 },
        { code: "21PDM301L", title: "Analytical and Logical Thinking Skills", hours: "0-0-2", credits: 1 },
        { code: "21LEM301T", title: "Indian Art Form", hours: "0-0-2", credits: 1 }
      ],
      6: [
        { code: "21CSS303T", title: "Data Science", hours: "3-0-0", credits: 3 },
        { code: "21CSC303T", title: "Software Engineering and Project Management", hours: "2-0-0", credits: 2 },
        { code: "21CSC304T", title: "Malware Analysis", hours: "3-0-0", credits: 3 },
        { code: "21PDM302L", title: "MOOC", hours: "0-0-3", credits: 3 },
        { code: "21PDM303T", title: "Employability Skills and Practices", hours: "0-0-2", credits: 1 },
        { code: "21LEM302T", title: "Indian Traditional Knowledge", hours: "0-0-2", credits: 1 }
      ],
      7: [
        { code: "21PNH401T", title: "Behavioral Psychology", hours: "2-1-0", credits: 3 },
        { code: "Professional Elective – V", title: "Professional Elective – V", hours: "3-0-0", credits: 3 },
        { code: "Professional Elective – VI", title: "Professional Elective – VI", hours: "3-0-0", credits: 3 },
        { code: "Professional Elective – VII", title: "Professional Elective – VII", hours: "3-0-0", credits: 3 },
        { code: "Professional Elective – VIII", title: "Professional Elective – VIII", hours: "3-0-0", credits: 3 },
        { code: "Open Elective – III", title: "Open Elective – III", hours: "3-0-0", credits: 3 }
      ],
      8: [
        { code: "21CSS503T", title: "Security Service Management", hours: "3-0-0", credits: 3 },
        { code: "21CSC503T", title: "Android Malware Analysis", hours: "3-0-0", credits: 3 },
        { code: "21CSC502T", title: "Research Methodology", hours: "3-0-0", credits: 3 },
        { code: "21CSP401L", title: "Major Project", hours: "0-0-8", credits: 4 },
        { code: "21CSP402L", title: "Major Project", hours: "0-0-8", credits: 4 },
        { code: "21CSP403L", title: "Internship", hours: "0-0-15", credits: 10 }
      ]
    };

    const subjects = semesterData[semester] || [];

    return `
      <div class="shortcut-list">
        <div class="session-item">
          <div>
            <strong>Semester ${escapeHtml(semester)} subjects</strong>
            <p>These are the subjects currently mapped for this semester.</p>
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="subjects-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Course title</th>
              <th>Hours/week</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((subject) => `
              <tr>
                <td>${escapeHtml(subject.code)}</td>
                <td>${escapeHtml(subject.title)}</td>
                <td>${escapeHtml(subject.hours)}</td>
                <td>${escapeHtml(String(subject.credits))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <div class="panel-actions">
          <button type="button" class="button-primary" data-action="open-semester-modal">Back</button>
          <button type="button" class="button-ghost" data-action="close-modal">Close</button>
        </div>
      </div>
    `;
  }

  function renderModal(modal) {
    if (!modal) {
      return "";
    }

    let title = "";
    let body = "";

    if (modal.type === "assignment") {
      title = modal.mode === "edit" ? "Edit assignment" : "New assignment";
      body = renderAssignmentForm(modal.item, modal.mode);
    }

    if (modal.type === "exam") {
      title = modal.mode === "edit" ? "Edit exam" : "New exam";
      body = renderExamForm(modal.item, modal.mode);
    }

    if (modal.type === "habit") {
      title = modal.mode === "edit" ? "Edit habit" : "New habit";
      body = renderHabitForm(modal.item, modal.mode);
    }

    if (modal.type === "weekly") {
      title = modal.mode === "edit" ? "Edit monthly task" : "New monthly task";
      body = renderWeeklyForm(modal.item, modal.mode);
    }

    if (modal.type === "shortcuts") {
      title = "Keyboard shortcuts";
      body = renderShortcuts();
    }

    if (modal.type === "semester") {
      title = modal.semester ? `Semester ${escapeHtml(modal.semester)}` : "Select semester";
      body = modal.semester ? renderSemesterSubjects(modal.semester) : renderSemesterPicker();
    }

    return `
      <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-card">
          <div class="modal-header">
            <h2 class="modal-title" id="modalTitle">${escapeHtml(title)}</h2>
            <button type="button" class="modal-close" data-action="close-modal" aria-label="Close modal">X</button>
          </div>
          ${body}
        </div>
      </div>
    `;
  }

  App.templates = {
    renderAnalytics,
    renderEmptyState,
    renderFocus,
    renderHabits,
    renderModal,
    renderOverview,
    renderPlanner,
    renderSettings,
    renderSidebar
  };
})(window);
