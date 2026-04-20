// Board data is generated server-side and fetched on load.
// All rendering, interaction, and win logic lives here.

const checkButton = document.getElementById('checkButton');
const checkMenu   = document.getElementById('checkMenu');

checkButton.addEventListener('click', function (e) {
  e.stopPropagation();
  checkMenu.classList.toggle('show');
});
document.addEventListener('click', function (e) {
  if (!checkMenu.contains(e.target) && e.target !== checkButton && !checkButton.contains(e.target)) {
    checkMenu.classList.remove('show');
  }
});

// Timer
const timerElement = document.getElementById('timer');
let seconds        = 0;
let completionTime = null;

function formatTime(sec) {
  const hrs  = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return String(hrs).padStart(2,'0') + ':' +
         String(mins).padStart(2,'0') + ':' +
         String(secs).padStart(2,'0');
}

const timerInterval = setInterval(() => {
  seconds++;
  timerElement.textContent = formatTime(seconds);
}, 1000);

// Puzzle state
let SIZE         = 5;
let grid         = [];
let placedWords  = [];
let numbering    = [];
let selectedCell = null;
let selectedDir  = 'across';
const session_id = document.getElementById("session_id").textContent;

// Boot
async function init() {
  let puzzle;
  try {
    const res = await fetch(`/api/game-session/${session_id}`);
    if (!res.ok) {
      throw new Error("Bad response from server");
    }
    const json = await res.json();
    if (!json) {
      throw new Error("Empty response from server");
    }
    puzzle = json.puzzle_data

    if (!puzzle.grid) {
      throw new Error("Puzzle missing grid");
    }

    SIZE        = puzzle.size;
    grid        = puzzle.grid;
    placedWords = puzzle.placedWords;

    renderBoard();
    renderClues();

  } catch (err) {
    console.error('Could not load puzzle:', err);
  }
}
init();

// Compute numbering
function computeNumbering() {
  const nums = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  let n = 1;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === "") continue;

      const startsAcross =
        (c === 0 || grid[r][c - 1] === "") &&
        c + 1 < SIZE &&
        grid[r][c + 1] !== "";

      const startsDown =
        (r === 0 || grid[r - 1][c] === "") &&
        r + 1 < SIZE &&
        grid[r + 1][c] !== "";

      if (startsAcross || startsDown) nums[r][c] = n++;
    }
  }
  return nums;
}

// Render board
function renderBoard() {
  numbering = computeNumbering();

  const boardEl = document.querySelector(".board");
  boardEl.innerHTML = "";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.r = r;
      cell.dataset.c = c;

      if (grid[r][c] === "") {
        cell.classList.add("black");
      } else {
        if (numbering[r][c] > 0) {
          const num = document.createElement("span");
          num.classList.add("number");
          num.textContent = numbering[r][c];
          cell.appendChild(num);
        }

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.classList.add("cell-input");
        input.dataset.r = r;
        input.dataset.c = c;
        input.autocomplete = "off";
        cell.appendChild(input);

        cell.addEventListener("click", () => onCellClick(r, c));
        input.addEventListener("keydown", (e) => onKeyDown(e, r, c));
        input.addEventListener("input", (e) => onInput(e, r, c));
      }

      boardEl.appendChild(cell);
    }
  }
}

// Render clues
function renderClues() {
  const acrossClues = [];
  const downClues = [];

  for (const pw of placedWords) {
    const num = numbering[pw.row][pw.col];
    if (pw.dir === "across") {
      acrossClues.push({ num, clue: pw.clue });
    } else {
      downClues.push({ num, clue: pw.clue });
    }
  }

  acrossClues.sort((a, b) => a.num - b.num);
  downClues.sort((a, b) => a.num - b.num);

  const acrossList = document.querySelector(".clue-column:nth-child(1) ul");
  const downList   = document.querySelector(".clue-column:nth-child(2) ul");

  acrossList.innerHTML = acrossClues.map(({ num, clue }) =>
    `<li data-num="${num}" data-dir="across">
      <span class="clue-number">${num}</span>
      <span>${clue}</span>
    </li>`
  ).join("");

  downList.innerHTML = downClues.map(({ num, clue }) =>
    `<li data-num="${num}" data-dir="down">
      <span class="clue-number">${num}</span>
      <span>${clue}</span>
    </li>`
  ).join("");

  [...acrossList.querySelectorAll("li"), ...downList.querySelectorAll("li")]
    .forEach(li => {
      li.addEventListener("click", () => {
        const dir = li.dataset.dir;
        const num = parseInt(li.dataset.num);

        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (numbering[r][c] === num) {
              selectedDir = dir;
              selectCell(r, c);
              focusCell(r, c);
              return;
            }
          }
        }
      });
    });
}

// Helpers
function getWordCells(r, c, dir) {
  const cells = [];

  if (dir === "across") {
    let sc = c;
    while (sc > 0 && grid[r][sc - 1] !== "") sc--;
    while (sc < SIZE && grid[r][sc] !== "") cells.push({ r, c: sc++ });
  } else {
    let sr = r;
    while (sr > 0 && grid[sr - 1][c] !== "") sr--;
    while (sr < SIZE && grid[sr][c] !== "") cells.push({ r: sr++, c });
  }

  return cells;
}

function selectCell(r, c) {
  selectedCell = { r, c };
  highlightWord();
  highlightActiveClue();
}

function focusCell(r, c) {
  const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
  if (input) input.focus();
}

function highlightWord() {
  document.querySelectorAll(".cell").forEach(el =>
    el.classList.remove("highlight", "selected")
  );

  if (!selectedCell) return;

  const { r, c } = selectedCell;

  getWordCells(r, c, selectedDir).forEach(({ r: wr, c: wc }) => {
    const cell = document.querySelector(`.cell[data-r="${wr}"][data-c="${wc}"]`);
    if (cell) cell.classList.add("highlight");
  });

  const active = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (active) {
    active.classList.remove("highlight");
    active.classList.add("selected");
  }
}

function highlightActiveClue() {
  if (!selectedCell) return;

  const { r, c } = selectedCell;
  const wordCells = getWordCells(r, c, selectedDir);
  if (wordCells.length === 0) return;

  const { r: sr, c: sc } = wordCells[0];
  const num = numbering[sr][sc];

  document.querySelectorAll(".clue-column li").forEach(li => {
    li.classList.remove("active-clue-item");
    if (parseInt(li.dataset.num) === num && li.dataset.dir === selectedDir) {
      li.classList.add("active-clue-item");
      li.scrollIntoView({ block: "nearest" });
    }
  });
}

// Input handling
function onCellClick(r, c) {
  if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
    const toggled = selectedDir === "across" ? "down" : "across";
    if (getWordCells(r, c, toggled).length >= 2) {
      selectedDir = toggled;
    }
  }

  selectCell(r, c);
  focusCell(r, c);
}

function onInput(e, r, c) {
  const input = e.target;
  const val = input.value.toUpperCase().replace(/[^A-Z]/g, "");
  input.value = val ? val[val.length - 1] : "";

  checkWin();

  input.closest(".cell").classList.remove("correct", "incorrect");

  if (input.value) {
    const nr = selectedDir === "down" ? r + 1 : r;
    const nc = selectedDir === "across" ? c + 1 : c;

    if (nr < SIZE && nc < SIZE && grid[nr][nc] !== "") {
      selectCell(nr, nc);
      focusCell(nr, nc);
    }
  }
}

function onKeyDown(e, r, c) {
  if (e.key === "Backspace") {
    const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);

    if (input && input.value === "") {
      const pr = selectedDir === "down" ? r - 1 : r;
      const pc = selectedDir === "across" ? c - 1 : c;

      if (pr >= 0 && pc >= 0 && grid[pr][pc] !== "") {
        selectCell(pr, pc);
        focusCell(pr, pc);

        const prev = document.querySelector(`.cell-input[data-r="${pr}"][data-c="${pc}"]`);
        if (prev) {
          prev.value = "";
          prev.closest(".cell").classList.remove("correct", "incorrect");
        }
      }
    }
    return;
  }

  const moves = {
    ArrowRight: [0, 1],
    ArrowLeft:  [0, -1],
    ArrowDown:  [1, 0],
    ArrowUp:    [-1, 0]
  };

  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    const nr = r + dr, nc = c + dc;

    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] !== "") {
      selectedDir = (e.key === "ArrowLeft" || e.key === "ArrowRight") ? "across" : "down";
      selectCell(nr, nc);
      focusCell(nr, nc);
    }
  }
}

// Compare player input to the answer grid for the given scope
function checkPuzzle(scope) {
    let cellsToCheck = [];

    if (scope === "square" && selectedCell) {
        cellsToCheck = [selectedCell];
    } else if (scope === "word" && selectedCell) {
        cellsToCheck = getWordCells(selectedCell.r, selectedCell.c, selectedDir);
    } else if (scope === "puzzle") {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (grid[r][c] !== "") cellsToCheck.push({ r, c });
    }

    for (const { r, c } of cellsToCheck) {
        const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
        if (!input || !input.value) continue;
        const cell = input.closest(".cell");
        if (input.value === grid[r][c]) {
            cell.classList.add("correct");
            cell.classList.remove("incorrect");
        } else {
            cell.classList.add("incorrect");
            cell.classList.remove("correct");
        }
    }
}

// Clear cell
function eraseSelected() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
    if (input) {
        input.value = "";
        input.closest(".cell").classList.remove("correct", "incorrect");
    }
}

// Reveal the correct letter for cell
function revealHint() {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
    if (input) {
        input.value = grid[r][c];
        input.closest(".cell").classList.add("correct");
        input.closest(".cell").classList.remove("incorrect");
    }
}

// Check dropdown options to their scopes
document.querySelectorAll("#checkMenu button").forEach((btn, i) => {
    const scopes = ["square", "word", "puzzle"];
    btn.addEventListener("click", () => {
        checkPuzzle(scopes[i]);
        checkMenu.classList.remove("show");
    });
});

// Erase and Hint buttons
document.getElementById("eraseButton").addEventListener("click", eraseSelected);
document.getElementById("hintButton").addEventListener("click", () => { revealHint(); checkWin(); });

// Render board and clues
renderBoard();
renderClues();

// Check if every letter cell matches the answer grid
function checkWin() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (grid[r][c] === "") continue;
            const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
            if (!input || input.value !== grid[r][c]) return;
        }
    }

    clearInterval(timerInterval);
    completionTime = formatTime(seconds);

    // Serialize the randomly generated puzzle so it can be saved to the DB
    const puzzleData = {
        size: SIZE,
        grid: grid,
        words: placedWords.map(pw => ({
            answer: pw.answer,
            clue:   pw.clue,
            row:    pw.row,
            col:    pw.col,
            dir:    pw.dir,
        })),
    };

    // Save to DB, then show popup regardless of whether save succeeds
    fetch('/game-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_seconds: seconds, puzzle_data: puzzleData })
    })
    .catch(err => console.warn('Could not save session:', err))
    .finally(() => showWinPopup(completionTime));
}

// Show the win popup
function showWinPopup(time) {
    const overlay = document.createElement("div");
    overlay.id = "win-overlay";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000;
    `;

    const popup = document.createElement("div");
    popup.id = "win-popup";
    popup.style.cssText = `
        background: #1e1e1e;
        color: #fff;
        border: 2px solid #fff;
        border-radius: 12px;
        padding: 40px 50px;
        text-align: center;
        font-family: inherit;
        max-width: 360px;
        width: 90%;
    `;

    popup.innerHTML = `
        <h2 style="margin: 0 0 8px; font-size: 2rem; letter-spacing: 2px;">YOU WIN!</h2>
        <p style="margin: 0 0 24px; font-size: 1rem; opacity: 0.7;">Puzzle complete</p>
        <div style="font-size: 2.5rem; font-weight: bold; letter-spacing: 4px; margin-bottom: 32px;">${time}</div>
        <button id="win-close-btn" style="
            background: #fff; color: #1e1e1e;
            border: none; border-radius: 6px;
            padding: 10px 28px; font-size: 1rem;
            font-weight: bold; cursor: pointer; letter-spacing: 1px;
        ">CLOSE</button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById("win-close-btn").addEventListener("click", () => {
        overlay.remove();
    });
}