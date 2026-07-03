(() => {
  'use strict';

  const HEADING = 'Tasks (from phone)';
  const TASKS_KEY = 'todo.tasks.v1';
  const SETTINGS_KEY = 'todo.settings.v1';
  const LAST_SYNC_KEY = 'todo.lastSync.v1';

  // ---------- storage ----------

  function loadTasks() {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
    catch { return []; }
  }
  function saveTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { baseUrl: '', apiKey: '' }; }
    catch { return { baseUrl: '', apiKey: '' }; }
  }
  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  function loadLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY) || null;
  }
  function saveLastSync(iso) {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  }

  let tasks = loadTasks();

  // ---------- date helpers ----------

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function timeStr(d = new Date()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function dayLabel(dayStr) {
    const today = todayStr();
    if (dayStr === today) return null;
    const [y, m, d] = dayStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ---------- DOM refs ----------

  const taskListEl = document.getElementById('taskList');
  const completedListEl = document.getElementById('completedList');
  const completedToggleEl = document.getElementById('completedToggle');
  const emptyStateEl = document.getElementById('emptyState');
  const dateHeadingEl = document.getElementById('dateHeading');
  const dateSubEl = document.getElementById('dateSub');
  const addForm = document.getElementById('addForm');
  const addInput = document.getElementById('addInput');
  const syncDotEl = document.getElementById('syncDot');

  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettings');
  const obsidianUrlInput = document.getElementById('obsidianUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const syncNowBtn = document.getElementById('syncNowBtn');
  const connectionStatusEl = document.getElementById('connectionStatus');
  const lastSyncedTextEl = document.getElementById('lastSyncedText');
  const pendingCountTextEl = document.getElementById('pendingCountText');

  let completedExpanded = false;

  // ---------- header date ----------

  function renderHeader() {
    const d = new Date();
    dateHeadingEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long' });
    dateSubEl.textContent = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // ---------- rendering ----------

  function pendingSyncCount() {
    return tasks.filter(t => !t.synced).length;
  }

  function updateSyncDot() {
    const { baseUrl, apiKey } = loadSettings();
    if (!baseUrl || !apiKey) {
      syncDotEl.className = 'sync-dot offline';
      syncDotEl.title = 'Obsidian sync not configured';
      return;
    }
    const pending = pendingSyncCount();
    if (pending === 0) {
      syncDotEl.className = 'sync-dot synced';
      syncDotEl.title = 'All synced to Obsidian';
    } else {
      syncDotEl.className = 'sync-dot pending';
      syncDotEl.title = `${pending} task${pending === 1 ? '' : 's'} waiting to sync`;
    }
  }

  function makeCheckIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '3');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M20 6L9 17l-5-5');
    svg.appendChild(path);
    return svg;
  }

  function buildRow(task) {
    const li = document.createElement('li');
    li.className = 'task-row' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    const del = document.createElement('button');
    del.className = 'task-row-delete';
    del.textContent = 'Delete';
    del.type = 'button';

    const inner = document.createElement('div');
    inner.className = 'task-row-inner';

    const checkbox = document.createElement('button');
    checkbox.className = 'task-checkbox';
    checkbox.type = 'button';
    checkbox.setAttribute('aria-label', 'Toggle done');
    checkbox.appendChild(makeCheckIcon());

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    inner.appendChild(checkbox);
    inner.appendChild(text);

    const label = dayLabel(task.day);
    if (label && !task.done) {
      const badge = document.createElement('span');
      badge.className = 'task-badge';
      badge.textContent = label;
      inner.appendChild(badge);
    }

    li.appendChild(del);
    li.appendChild(inner);
    attachSwipe(li, inner);
    return li;
  }

  function render() {
    const today = todayStr();
    const incomplete = tasks
      .filter(t => !t.done)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const completedToday = tasks
      .filter(t => t.done && t.doneAt && t.doneAt.slice(0, 10) === today)
      .sort((a, b) => b.doneAt.localeCompare(a.doneAt));

    taskListEl.innerHTML = '';
    incomplete.forEach(t => taskListEl.appendChild(buildRow(t)));

    completedListEl.innerHTML = '';
    completedToday.forEach(t => completedListEl.appendChild(buildRow(t)));

    if (completedToday.length > 0) {
      completedToggleEl.hidden = false;
      completedToggleEl.textContent = (completedExpanded ? '▾' : '▸') + ` Completed today (${completedToday.length})`;
      completedListEl.hidden = !completedExpanded;
    } else {
      completedToggleEl.hidden = true;
      completedListEl.hidden = true;
    }

    emptyStateEl.hidden = incomplete.length > 0 || completedToday.length > 0;

    updateSyncDot();
  }

  completedToggleEl.addEventListener('click', () => {
    completedExpanded = !completedExpanded;
    render();
  });

  // ---------- mutations ----------

  function persistAndRender() {
    saveTasks(tasks);
    render();
    scheduleSync();
  }

  function addTask(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    tasks.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      text: clean,
      done: false,
      day: todayStr(),
      createdAt: new Date().toISOString(),
      doneAt: null,
      synced: false,
      everSynced: false,
    });
    persistAndRender();
  }

  function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    t.synced = false;
    persistAndRender();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    persistAndRender();
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(addInput.value);
    addInput.value = '';
    addInput.focus();
  });

  // checkbox tap (event delegation across both lists)
  [taskListEl, completedListEl].forEach(list => {
    list.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.task-checkbox');
      if (!checkbox) return;
      const row = e.target.closest('.task-row');
      toggleTask(row.dataset.id);
    });
  });

  // ---------- swipe to delete ----------

  function attachSwipe(row, inner) {
    let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, isHorizontal = false;
    const OPEN_X = -88;

    function setX(x, animate) {
      inner.style.transition = animate ? 'transform 0.18s ease' : 'none';
      inner.style.transform = `translateX(${x}px)`;
    }

    function closeAllOthers() {
      document.querySelectorAll('.task-row-inner').forEach(el => {
        if (el !== inner) {
          el.style.transition = 'transform 0.18s ease';
          el.style.transform = 'translateX(0)';
        }
      });
    }

    inner.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      dragging = true;
      decided = false;
      isHorizontal = false;
      const current = inner.style.transform.match(/-?\d+/);
      inner._baseX = current ? parseInt(current[0], 10) : 0;
    });

    inner.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const moveX = e.clientX - startX;
      const moveY = e.clientY - startY;
      if (!decided) {
        if (Math.abs(moveX) > 6 || Math.abs(moveY) > 6) {
          decided = true;
          isHorizontal = Math.abs(moveX) > Math.abs(moveY);
          if (isHorizontal) inner.setPointerCapture(e.pointerId);
        } else {
          return;
        }
      }
      if (!isHorizontal) return;
      e.preventDefault();
      dx = moveX;
      let x = inner._baseX + dx;
      x = Math.max(OPEN_X, Math.min(0, x));
      setX(x, false);
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (!isHorizontal) return;
      const x = inner._baseX + dx;
      if (x < OPEN_X / 2) {
        closeAllOthers();
        setX(OPEN_X, true);
      } else {
        setX(0, true);
      }
    }

    inner.addEventListener('pointerup', endDrag);
    inner.addEventListener('pointercancel', endDrag);

    inner.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      const current = inner.style.transform.match(/-?\d+/);
      const x = current ? parseInt(current[0], 10) : 0;
      if (x < -10) {
        e.stopPropagation();
        setX(0, true);
      }
    });

    row.querySelector('.task-row-delete').addEventListener('click', () => {
      deleteTask(row.dataset.id);
    });
  }

  // ---------- settings UI ----------

  function normalizeBaseUrl(raw) {
    let url = raw.trim().replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    return url;
  }

  function openSettings() {
    const s = loadSettings();
    obsidianUrlInput.value = s.baseUrl || '';
    apiKeyInput.value = s.apiKey || '';
    connectionStatusEl.textContent = '';
    connectionStatusEl.className = 'connection-status';
    updateSyncMeta();
    settingsOverlay.hidden = false;
  }
  function closeSettings() {
    const baseUrl = normalizeBaseUrl(obsidianUrlInput.value);
    const apiKey = apiKeyInput.value.trim();
    saveSettings({ baseUrl, apiKey });
    settingsOverlay.hidden = true;
    render();
  }

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  toggleKeyVisibilityBtn.addEventListener('click', () => {
    const showing = apiKeyInput.type === 'text';
    apiKeyInput.type = showing ? 'password' : 'text';
    toggleKeyVisibilityBtn.textContent = showing ? 'Show' : 'Hide';
  });

  function updateSyncMeta() {
    const last = loadLastSync();
    lastSyncedTextEl.textContent = last
      ? `Last synced ${new Date(last).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}`
      : 'Never synced';
    const pending = pendingSyncCount();
    pendingCountTextEl.textContent = pending > 0 ? `${pending} pending` : 'Up to date';
  }

  function currentSettingsFromForm() {
    return {
      baseUrl: normalizeBaseUrl(obsidianUrlInput.value),
      apiKey: apiKeyInput.value.trim(),
    };
  }

  testConnectionBtn.addEventListener('click', async () => {
    const { baseUrl, apiKey } = currentSettingsFromForm();
    if (!baseUrl) {
      connectionStatusEl.textContent = 'Enter a base URL first.';
      connectionStatusEl.className = 'connection-status err';
      return;
    }
    connectionStatusEl.textContent = 'Testing…';
    connectionStatusEl.className = 'connection-status';
    try {
      const res = await fetchWithTimeout(`${baseUrl}/`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      }, 6000);
      const data = await res.json();
      if (data.authenticated) {
        connectionStatusEl.textContent = `Connected — Obsidian ${data.versions?.obsidian || ''} ✓`;
        connectionStatusEl.className = 'connection-status ok';
      } else {
        connectionStatusEl.textContent = 'Reached the server, but the API key was rejected.';
        connectionStatusEl.className = 'connection-status err';
      }
    } catch (err) {
      connectionStatusEl.textContent = `Could not reach Obsidian (${err.message || 'network error'}).`;
      connectionStatusEl.className = 'connection-status err';
    }
  });

  syncNowBtn.addEventListener('click', async () => {
    saveSettings(currentSettingsFromForm());
    connectionStatusEl.textContent = 'Syncing…';
    connectionStatusEl.className = 'connection-status';
    const result = await syncToObsidian();
    if (result.ok) {
      connectionStatusEl.textContent = result.synced > 0 ? `Synced ${result.synced} task(s).` : 'Already up to date.';
      connectionStatusEl.className = 'connection-status ok';
    } else {
      connectionStatusEl.textContent = result.message;
      connectionStatusEl.className = 'connection-status err';
    }
    updateSyncMeta();
    render();
  });

  // ---------- fetch with timeout ----------

  function fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  }

  // ---------- Obsidian sync ----------

  let syncInFlight = false;
  let syncTimer = null;

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncToObsidian(); }, 2500);
  }

  function buildLineForTask(t) {
    const time = timeStr(new Date(t.done ? t.doneAt : t.createdAt));
    if (t.done) {
      const verb = t.everSynced ? 'done' : 'done';
      return `- [x] ${t.text} _(${verb} ${time})_`;
    }
    const verb = t.everSynced ? 'updated' : 'added';
    return `- [ ] ${t.text} _(${verb} ${time})_`;
  }

  async function syncToObsidian() {
    if (syncInFlight) return { ok: false, message: 'Sync already in progress.' };
    const { baseUrl, apiKey } = loadSettings();
    if (!baseUrl || !apiKey) return { ok: false, message: 'Sync not configured.' };

    const pending = tasks.filter(t => !t.synced);
    if (pending.length === 0) {
      updateSyncDot();
      return { ok: true, synced: 0 };
    }

    syncInFlight = true;
    try {
      const body = pending.map(buildLineForTask).join('\n');

      let res = await fetchWithTimeout(`${baseUrl}/periodic/daily/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Operation: 'append',
          'Target-Type': 'heading',
          Target: encodeURIComponent(HEADING),
          'Content-Type': 'text/markdown',
        },
        body,
      }, 8000);

      if (!res.ok) {
        res = await fetchWithTimeout(`${baseUrl}/periodic/daily/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'text/markdown',
          },
          body: `\n## ${HEADING}\n${body}\n`,
        }, 8000);
      }

      if (!res.ok) {
        return { ok: false, message: `Obsidian returned an error (${res.status}).` };
      }

      pending.forEach(t => { t.synced = true; t.everSynced = true; });
      saveTasks(tasks);
      saveLastSync(new Date().toISOString());
      updateSyncDot();
      return { ok: true, synced: pending.length };
    } catch (err) {
      return { ok: false, message: err.name === 'AbortError' ? 'Timed out reaching Obsidian.' : 'Could not reach Obsidian — will retry.' };
    } finally {
      syncInFlight = false;
    }
  }

  window.addEventListener('online', () => syncToObsidian());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncToObsidian();
  });

  // ---------- service worker ----------

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---------- init ----------

  renderHeader();
  render();
  scheduleSync();
})();
