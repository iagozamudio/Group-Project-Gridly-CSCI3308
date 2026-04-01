const checkButton = document.getElementById('checkButton');
const checkMenu = document.getElementById('checkMenu');

checkButton.addEventListener('click', function (e) {
    e.stopPropagation();
    checkMenu.classList.toggle('show');
});

document.addEventListener('click', function (e) {
    if (!checkMenu.contains(e.target) && e.target !== checkButton && !checkButton.contains(e.target)) {
        checkMenu.classList.remove('show');
    }
});

const timerElement = document.getElementById('timer');
let seconds = 0;

function formatTime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

setInterval(function () {
    seconds++;
    timerElement.textContent = formatTime(seconds);
}, 1000);

// Crossword Logic

const crosswordClues = [
  { clue: "Declare publicly", answer: "AVOW" },
  { clue: "Opposite of yes", answer: "NO" },
  { clue: "Prefix meaning again", answer: "RE" },
  { clue: "Not off", answer: "ON" },
  { clue: "Consumed", answer: "ATE" },
  { clue: "Frozen water", answer: "ICE" },
  { clue: "Compass point", answer: "EAST" },
  { clue: "Negative reply", answer: "NAH" },
  { clue: "Before, poetically", answer: "ERE" },
  { clue: "Exist", answer: "ARE" },

  { clue: "Large body of water", answer: "SEA" },
  { clue: "Opposite of out", answer: "IN" },
  { clue: "Actor's role", answer: "PART" },
  { clue: "Quick bite", answer: "NOSH" },
  { clue: "Greet casually", answer: "HEY" },
  { clue: "Consumed food", answer: "EATEN" },
  { clue: "Feline pet", answer: "CAT" },
  { clue: "Canine pet", answer: "DOG" },
  { clue: "Bird's home", answer: "NEST" },
  { clue: "Ocean movement", answer: "TIDE" },

  { clue: "Make a mistake", answer: "ERR" },
  { clue: "Therefore", answer: "SO" },
  { clue: "Not old", answer: "NEW" },
  { clue: "Existence", answer: "BEING" },
  { clue: "Opposite of high", answer: "LOW" },
  { clue: "Unit of time", answer: "SEC" },
  { clue: "Musical pause", answer: "REST" },
  { clue: "Anger", answer: "IRE" },
  { clue: "Attempt", answer: "TRY" },
  { clue: "Before now", answer: "AGO" },

  { clue: "Mother", answer: "MA" },
  { clue: "Father", answer: "PA" },
  { clue: "Small child", answer: "TOT" },
  { clue: "Friend", answer: "PAL" },
  { clue: "Enemy", answer: "FOE" },
  { clue: "Hawaiian hello", answer: "ALOHA" },
  { clue: "Part of the eye", answer: "IRIS" },
  { clue: "Slightly wet", answer: "DAMP" },
  { clue: "Opposite of begin", answer: "END" },

  { clue: "Cut of meat", answer: "LOIN" },
  { clue: "Beverage holder", answer: "MUG" },
  { clue: "Writing tool", answer: "PEN" },
  { clue: "Not fast", answer: "SLOW" },
  { clue: "Shiny metal", answer: "TIN" },
  { clue: "Baby bed", answer: "CRIB" },
  { clue: "Make amends", answer: "ATONE" },
  { clue: "Sound of hesitation", answer: "UM" },
  { clue: "Affirmative vote", answer: "YEA" }
];

// Set grid size to 5x5
const SIZE = 5;
let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
let placedWords = []; // { answer, clue, row, col, dir }

// Shuffle helper function
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Filter words that fit in 5x5 and shuffle them
const cluePool = shuffle(
    crosswordClues
    .map(c => ({ clue: c.clue, answer: c.answer.toUpperCase() }))
    .filter(c => c.answer.length >= 2 && c.answer.length <= SIZE)
);

// Place the first word in the middle of the grid
function placeFirstWord(clueObj) {
    const word = clueObj.answer;
    const row = Math.floor(SIZE / 2);
    const col = Math.floor((SIZE - word.length) / 2);

    for (let i = 0; i < word.length; i++) {
        grid[row][col + i] = word[i];
    }

    placedWords.push({ answer: word, clue: clueObj.clue, row, col, dir: "across" });
}

// Check if a word can be placed at a position in a given direction
function canPlace(word, row, col, dir) {
    // Bounds check for the whole word up front
    if (dir === "across") {
        if (row < 0 || row >= SIZE || col < 0 || col + word.length > SIZE) return false;
    } else {
        if (col < 0 || col >= SIZE || row < 0 || row + word.length > SIZE) return false;
    }

    // No letter immediately before or after the word
    if (dir === "across") {
        if (col > 0 && grid[row][col - 1] !== "") return false;
        if (col + word.length < SIZE && grid[row][col + word.length] !== "") return false;
    } else {
        if (row > 0 && grid[row - 1][col] !== "") return false;
        if (row + word.length < SIZE && grid[row + word.length][col] !== "") return false;
    }

    let intersects = false;

    for (let i = 0; i < word.length; i++) {
        const r = dir === "across" ? row : row + i;
        const c = dir === "across" ? col + i : col;

        if (grid[r][c] !== "") {
            // Existing letter must match
            if (grid[r][c] !== word[i]) return false;
            intersects = true;
        } else {
            // Empty cell: only check perpendicular neighbors
            // (prevents parallel words from running side-by-side)
            if (dir === "across") {
                if (r > 0 && grid[r - 1][c] !== "") return false;
                if (r < SIZE - 1 && grid[r + 1][c] !== "") return false;
            } else {
                if (c > 0 && grid[r][c - 1] !== "") return false;
                if (c < SIZE - 1 && grid[r][c + 1] !== "") return false;
            }
        }
    }

    // Word must cross at least one existing letter to connect to the grid
    return intersects;
}

// Place a word on the grid if possible
function placeWord(clueObj) {
    const word = clueObj.answer;

    // Scan grid for matching letters
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            for (let i = 0; i < word.length; i++) {
                if (grid[r][c] === word[i]) {
                    // Vertical placement
                    let startRow = r - i;
                    if (canPlace(word, startRow, c, "down")) {
                        for (let j = 0; j < word.length; j++) {
                            grid[startRow + j][c] = word[j];
                        }
                        placedWords.push({ answer: word, clue: clueObj.clue, row: startRow, col: c, dir: "down" });
                        return true;
                    }

                    // Horizontal placement
                    let startCol = c - i;
                    if (canPlace(word, r, startCol, "across")) {
                        for (let j = 0; j < word.length; j++) {
                            grid[r][startCol + j] = word[j];
                        }
                        placedWords.push({ answer: word, clue: clueObj.clue, row: r, col: startCol, dir: "across" });
                        return true;
                    }
                }
            }
        }
    }

    // If cant place word
    return false;
}

// Keep trying until at least 5 words are placed
function buildGrid() {
    // Reset grid
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            grid[r][c] = "";
        }
    }

    // Reset placed words
    placedWords = [];

    // Reshuffle
    shuffle(cluePool);

    let placed = 1;

    // Place first word
    placeFirstWord(cluePool[0]);

    // Place the rest of the words
    for (let i = 1; i < cluePool.length; i++) {
        if (placeWord(cluePool[i])) placed++;
    }

    return placed;
}

// Retry until at least 5 words
let attempts = 0;
while (buildGrid() < 5) {
    attempts++;
}

// Print the grid to console
console.log(`(Took ${attempts + 1} attempt(s))`);
console.log(grid.map(row => row.map(c => c === "" ? "." : c).join(" ")).join("\n"));

// Logic for converting the grid elements into DOM

// Returns a 2D array where each cell holds its clue number (0 = no number)
function computeNumbering() {
    const nums = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    let n = 1;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (grid[r][c] === "") continue;
            const startsAcross = (c === 0 || grid[r][c - 1] === "") && c + 1 < SIZE && grid[r][c + 1] !== "";
            const startsDown   = (r === 0 || grid[r - 1][c] === "") && r + 1 < SIZE && grid[r + 1][c] !== "";
            if (startsAcross || startsDown) nums[r][c] = n++;
        }
    }
    return nums;
}

// Selection state
let numbering = [];
let selectedCell = null; // { r, c }
let selectedDir = "across";

// Builds the 5x5 grid in the DOM from the generated grid array
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
                // Black (blocked) cell
                cell.classList.add("black");
            } else {
                // Number label if this cell starts a word
                if (numbering[r][c] > 0) {
                    const num = document.createElement("span");
                    num.classList.add("number");
                    num.textContent = numbering[r][c];
                    cell.appendChild(num);
                }

                // Input for the player's answer
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

// Builds the across and down clue lists from placed words
function renderClues() {
    const acrossClues = [];
    const downClues = [];

    for (const pw of placedWords) {
        const num = numbering[pw.row][pw.col];
        if (pw.dir === "across") acrossClues.push({ num, clue: pw.clue });
        else downClues.push({ num, clue: pw.clue });
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

    // Click a clue to jump to that word on the board
    [...acrossList.querySelectorAll("li"), ...downList.querySelectorAll("li")].forEach(li => {
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

// Returns all cells belonging to the word at (r, c) in the given direction
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

// Highlights the active word and marks the selected cell
function highlightWord() {
    document.querySelectorAll(".cell").forEach(el => el.classList.remove("highlight", "selected"));

    if (!selectedCell) return;
    const { r, c } = selectedCell;

    getWordCells(r, c, selectedDir).forEach(({ r: wr, c: wc }) => {
        const cell = document.querySelector(`.cell[data-r="${wr}"][data-c="${wc}"]`);
        if (cell) cell.classList.add("highlight");
    });

    // The cursor cell gets "selected" instead of "highlight"
    const active = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (active) {
        active.classList.remove("highlight");
        active.classList.add("selected");
    }
}

// Marks the matching clue item as active and scrolls it into view
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

// Handle a cell click — second click on same cell toggles direction
function onCellClick(r, c) {
    if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        const toggled = selectedDir === "across" ? "down" : "across";
        // Only toggle if there's actually a word in the new direction
        if (getWordCells(r, c, toggled).length >= 2) selectedDir = toggled;
    }
    selectCell(r, c);
    focusCell(r, c);
}

// Typing a letter fills the cell and advances to the next one
function onInput(e, r, c) {
    const input = e.target;
    const val = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    input.value = val ? val[val.length - 1] : "";

    // Clear any prior check styling on this cell
    input.closest(".cell").classList.remove("correct", "incorrect");

    if (input.value) {
        // Move cursor to next cell in the selected direction
        const nr = selectedDir === "down"   ? r + 1 : r;
        const nc = selectedDir === "across" ? c + 1 : c;
        if (nr < SIZE && nc < SIZE && grid[nr][nc] !== "") {
            selectCell(nr, nc);
            focusCell(nr, nc);
        }
    }
}

// Backspace moves back and clears and arrow keys navigate
function onKeyDown(e, r, c) {
    if (e.key === "Backspace") {
        const input = document.querySelector(`.cell-input[data-r="${r}"][data-c="${c}"]`);
        if (input && input.value === "") {
            // Cell already empty — step back and clear the previous cell
            const pr = selectedDir === "down"   ? r - 1 : r;
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

    // Arrow key navigation
    const moves = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (moves[e.key]) {
        e.preventDefault();
        const [dr, dc] = moves[e.key];
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] !== "") {
            // Arrow direction sets the selection direction too
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
document.getElementById("hintButton").addEventListener("click", revealHint);

// Render board and clues
renderBoard();
renderClues();