const BADGE_CLASSES = [
  'bg-warning text-dark',
  'bg-secondary',
  'bg-danger',
  'bg-primary',
  'bg-success',
];

function formatTime(totalSeconds) {
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderSpinner(containerId) {
  document.getElementById(containerId).innerHTML = `
    <div class="list-group-item text-center text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading…
    </div>`;
}

function renderEmpty(containerId, msg) {
  document.getElementById(containerId).innerHTML =
    `<div class="list-group-item text-center text-muted">${msg}</div>`;
}

function renderError(containerId) {
  document.getElementById(containerId).innerHTML =
    `<div class="list-group-item text-center text-danger">Could not load scores. Please try again later.</div>`;
}

// ── Tab 1 & 2: Single-player (original behaviour + new time tab) ─────────────
async function loadSinglePlayer() {
  renderSpinner('leaderboard-list');
  renderSpinner('sp-time-list');
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error(`${res.status}`);
    const rows = await res.json();

    if (!rows.length) {
      renderEmpty('leaderboard-list', 'No completed puzzles yet — be the first!');
      renderEmpty('sp-time-list',     'No completed puzzles yet — be the first!');
      return;
    }

    // Tab 1 — original score display (fastest times, same as before)
    document.getElementById('leaderboard-list').innerHTML = rows.map((row, i) => {
      const badge = BADGE_CLASSES[i] ?? 'bg-dark';
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <strong>#${i + 1}</strong> ${row.username || 'Guest'}
            <small class="text-muted ms-2">${formatDate(row.completed_at)}</small>
          </span>
          <span class="badge ${badge} rounded-pill">${formatTime(row.time_seconds)}</span>
        </div>`;
    }).join('');

    // Tab 2 — same data, same ordering, slightly different label emphasis
    document.getElementById('sp-time-list').innerHTML = rows.map((row, i) => {
      const badge = BADGE_CLASSES[i] ?? 'bg-dark';
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <strong>#${i + 1}</strong> ${row.username || 'Guest'}
            <small class="text-muted ms-2">${formatDate(row.completed_at)}</small>
          </span>
          <span class="badge ${badge} rounded-pill">⏱ ${formatTime(row.time_seconds)}</span>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('SP leaderboard fetch failed:', err);
    renderError('leaderboard-list');
    renderError('sp-time-list');
  }
}

// ── Tab 3: Two-player cumulative scores ──────────────────────────────────────
async function loadTwoPlayer() {
  renderSpinner('tp-list');
  try {
    const res = await fetch('/api/leaderboard/twoplayer');
    if (!res.ok) throw new Error(`${res.status}`);
    const rows = await res.json();

    if (!rows.length) {
      renderEmpty('tp-list', 'No two-player games recorded yet.');
      return;
    }

    document.getElementById('tp-list').innerHTML = rows.map((row, i) => {
      const badge = BADGE_CLASSES[i] ?? 'bg-dark';
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <strong>#${i + 1}</strong> ${row.username || 'Guest'}
            <small class="text-muted ms-2">${row.games_played} game${row.games_played !== 1 ? 's' : ''} · ${row.wins} W</small>
          </span>
          <span class="badge ${badge} rounded-pill">${row.total_score} pts</span>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('TP leaderboard fetch failed:', err);
    renderError('tp-list');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSinglePlayer();

  // Lazy-load tab 3 the first time the user clicks it
  const tpTab = document.getElementById('tp-tab');
  let tpLoaded = false;
  tpTab.addEventListener('shown.bs.tab', () => {
    if (!tpLoaded) { tpLoaded = true; loadTwoPlayer(); }
  });
});