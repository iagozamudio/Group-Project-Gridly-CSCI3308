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
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));

// Shuffle helper function
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Filter words that fit in 5x5 and shuffle them
const words = shuffle(
    crosswordClues
    .map(c => c.answer.toUpperCase())
    .filter(w => w.length >= 2 && w.length <= SIZE)
);

// Place the first word in the middle of the grid
function placeFirstWord(word) {
    const row = Math.floor(SIZE / 2);
    const col = Math.floor((SIZE - word.length) / 2);

    for (let i = 0; i < word.length; i++) {
        grid[row][col + i] = word[i];
    }
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
function placeWord(word) {
    // Scan grid for Matching letters
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            for (let i = 0; i < word.length; i++) {
                if (grid[r][c] === word[i]) {
                    // Vertical Placement
                    let startRow = r - i;
                    if (canPlace(word, startRow, c, "down")) {
                        for (let j = 0; j < word.length; j++) {
                            grid[startRow + j][c] = word[j];
                        }
                        return true;
                    }

                    // Horizontal placement
                    let startCol = c - i;
                    if (canPlace(word, r, startCol, "across")) {
                        for (let j = 0; j < word.length; j++) {
                            grid[r][startCol + j] = word[j];
                        }
                        return true;
                    }
                }
            }
        }
    }

    // If cant place wors
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

    // Reshuffle
    shuffle(words);

    let placed = 1;

    // Place first word
    placeFirstWord(words[0]);

    // Place the rest of the words
    for (let i = 1; i < words.length; i++) {
        if (placeWord(words[i])) placed++;
    }

    return placed;
}

// Retry until at least 5 words
let attempts = 0;
while (buildGrid() < 5) {
    attempts++;
}

// Print the grid
console.log(`(Took ${attempts + 1} attempt(s))`);
console.log(grid.map(row => row.map(c => c === "" ? "." : c).join(" ")).join("\n"));