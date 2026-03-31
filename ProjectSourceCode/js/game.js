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
  { clue: "Large snake", answer: "ANACONDA" },
  { clue: "Hawaiian hello", answer: "ALOHA" },
  { clue: "Part of the eye", answer: "IRIS" },
  { clue: "Slightly wet", answer: "DAMP" },
  { clue: "Opposite of begin", answer: "END" },

  { clue: "Cut of meat", answer: "LOIN" },
  { clue: "Beverage holder", answer: "MUG" },
  { clue: "Writing tool", answer: "PEN" },
  { clue: "Not fast", answer: "SLOW" },
  { clue: "Shiny metal", answer: "TIN" },
  { clue: "Opposite of left", answer: "RIGHT" },
  { clue: "Baby bed", answer: "CRIB" },
  { clue: "Make amends", answer: "ATONE" },
  { clue: "Sound of hesitation", answer: "UM" },
  { clue: "Affirmative vote", answer: "YEA" }
];

// Set grid size to 5x5
const SIZE = 5;
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));

// Filter words that fit in 5x5 and sort longest first
const words = crosswordClues
    .map(c => c.answer.toUpperCase())
    .filter(w => w.length <= SIZE) // only words that fit
    .sort((a, b) => b.length - a.length);

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
    for (let i = 0; i < word.length; i++) {
        let r = dir === "across" ? row : row + i;
        let c = dir === "across" ? col + i : col;

        // Bounds check
        if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;

        // Check clash with existing letters
        if (grid[r][c] !== "" && grid[r][c] !== word[i]) return false;

        // Prevent letters touching incorrectly
        if (dir === "across") {
            if ((c > 0 && grid[r][c-1] !== "" && i === 0) || (c < SIZE-1 && grid[r][c+1] !== "" && i === word.length-1)) return false;
            if (r > 0 && grid[r-1][c] !== "") return false;
            if (r < SIZE-1 && grid[r+1][c] !== "") return false;
        } else {
            if ((r > 0 && grid[r-1][c] !== "" && i === 0) || (r < SIZE-1 && grid[r+1][c] !== "" && i === word.length-1)) return false;
            if (c > 0 && grid[r][c-1] !== "") return false;
            if (c < SIZE-1 && grid[r][c+1] !== "") return false;
        }
    }
    return true;
}

// Place a word on the grid if possible
function placeWord(word) {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            for (let i = 0; i < word.length; i++) {
                if (grid[r][c] === word[i]) {
                    // Try vertical placement
                    let startRow = r - i;
                    if (canPlace(word, startRow, c, "down")) {
                        for (let j = 0; j < word.length; j++) {
                            grid[startRow + j][c] = word[j];
                        }
                        return true;
                    }

                    // Try horizontal placement
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

    // Fallback: try to place anywhere horizontal/vertical
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (canPlace(word, r, c, "across")) {
                for (let j = 0; j < word.length; j++) {
                    grid[r][c + j] = word[j];
                }
                return true;
            }
            if (canPlace(word, r, c, "down")) {
                for (let j = 0; j < word.length; j++) {
                    grid[r + j][c] = word[j];
                }
                return true;
            }
        }
    }

    return false; // Could not place word
}

// =====================
// TEST CODE
// =====================

// Place first word in the middle
placeFirstWord(words[0]);

// Place the rest of the words
for (let i = 1; i < words.length; i++) {
    placeWord(words[i]);
}

// Print the grid to console with dots for empty cells
console.log(grid.map(row => row.map(c => c === "" ? "." : c).join(" ")).join("\n"));