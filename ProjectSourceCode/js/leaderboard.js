// leaderboard.js — fetches top completions from /api/leaderboard and renders them

const BADGE_CLASSES = [
  'bg-warning text-dark', // 1st — gold
  'bg-secondary',         // 2nd — silver
  'bg-danger',            // 3rd — bronze
  'bg-primary',           // 4th
  'bg-success',           // 5th
];

function formatTime(totalSeconds) {
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

async function loadLeaderboard() {
  const listGroup = document.getElementById('leaderboard-list');

  listGroup.innerHTML = `
    <div class="list-group-item text-center text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading scores…
    </div>`;

  try {
    const res = await fetch('/api/leaderboard');

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const rows = await res.json();

    if (!rows.length) {
      listGroup.innerHTML = `
        <div class="list-group-item text-center text-muted">
          No completed puzzles yet — be the first!
        </div>`;
      return;
    }

    listGroup.innerHTML = rows.map((row, i) => {
      const rank     = i + 1;
      const badge    = BADGE_CLASSES[i] ?? 'bg-dark';
      const time     = formatTime(row.time_seconds);
      const date     = formatDate(row.completed_at);
      const username = row.username || 'Guest';

      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <strong>#${rank}</strong> ${username}
            <small class="text-muted ms-2">${date}</small>
          </span>
          <span class="badge ${badge} rounded-pill">${time}</span>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Leaderboard fetch failed:', err);
    listGroup.innerHTML = `
      <div class="list-group-item text-center text-danger">
        Could not load scores. Please try again later.
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadLeaderboard);