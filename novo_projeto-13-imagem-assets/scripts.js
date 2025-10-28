

const state = {
  data: null,
  words: [],
  wordsMap: new Map(),
  gridMatrix: [],
  bounds: null,
  activeWord: null,
  activeOrientation: null,
  activeIndex: 0,
  highlightedCells: [],
  activeCell: null,
  score: 0,
  behaviour: {},
  strings: {},
  timer: {
    seconds: 0,
    interval: null
  },
  isChecked: false,
  resizeFrame: null,
  isTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0
};

const elements = {
  app: document.querySelector(".app"),
  title: document.getElementById("app-title"),
  description: document.getElementById("task-description"),
  gridShell: document.querySelector(".grid-shell"),
  grid: document.getElementById("crossword-grid"),
  cluesList: document.getElementById("clues-list"),
  feedback: document.getElementById("feedback"),
  statTotal: document.getElementById("stat-total"),
  statScore: document.getElementById("stat-score"),
  timeLabel: document.getElementById("time-label"),
  timeValue: document.getElementById("time-value"),
  checkBtn: document.getElementById("check-btn"),
  showSolutionBtn: document.getElementById("show-solution-btn"),
  retryBtn: document.getElementById("retry-btn"),
  extraOverlay: document.getElementById("extra-clue-overlay"),
  extraBody: document.getElementById("extra-clue-body"),
  extraClose: document.getElementById("extra-clue-close"),
  keyboardOverlay: document.getElementById("keyboard-overlay"),
  keyboardBody: document.getElementById("keyboard-body"),
  keyboardClose: document.getElementById("keyboard-close")
};

const WORD_ID_PREFIX = "word-";
const KEYBOARD_ROWS = [
  ["A","B","C","D","E","F","G"],
  ["H","I","J","K","L","M","N"],
  ["O","P","Q","R","S","T","U"],
  ["V","W","X","Y","Z","Ç","-"],
  ["Á","Â","Ã","À","É","Ê"],
  ["Í","Ó","Ô","Õ","Ú","Ü"]
];
const KEYBOARD_ACTIONS = [
  { label: "⌫", action: "backspace" },
  { label: "Limpar", action: "clear" },
  { label: "Fechar", action: "close" }
];

init().catch((error) => {
  console.error(error);
  elements.app.dataset.state = "error";
  elements.feedback.textContent = "NÃ£o foi possÃ­vel carregar a atividade.";
});

async function init() {
  const data = await loadData();
  prepareState(data);
  generateLayout();
  renderTask();
  attachEvents();
  startTimer();
  elements.app.dataset.state = "ready";
}

async function loadData() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar data.json (${response.status})`);
  }
  return response.json();
}

function prepareState(data) {
  state.data = data;
  state.behaviour = data.behaviour || {};
  state.strings = {
    across: getText(data.l10n?.across, "Horizontal"),
    down: getText(data.l10n?.down, "Vertical"),
    check: getText(data.l10n?.checkAnswer, "Verificar"),
    tryAgain: getText(data.l10n?.tryAgain, "Tentar novamente"),
    showSolution: getText(data.l10n?.showSolution, "Mostrar solução"),
    extraClue: getText(data.l10n?.extraClue, "Pista extra"),
    feedbackTemplate: getText(
      data.accessibility?.yourResult,
      "Conseguiu @score de @total pontos."
    ),
    resultCorrect: getText(data.accessibility?.correct, "Correto"),
    resultWrong: getText(data.accessibility?.wrong, "Errado"),
    empty: getText(data.accessibility?.empty, "Vazio"),
    clueIntro: getText(data.accessibility?.resultFor, "Resultado para: @clue")
  };

  elements.title.textContent = getText(data.title, "Cruzadinha");
  if (data.taskDescription) {
    elements.description.innerHTML = data.taskDescription;
  } else {
    elements.description.textContent = "";
  }

  elements.checkBtn.querySelector(".btn__label").textContent = state.strings.check;
  elements.retryBtn.querySelector(".btn__label").textContent = state.strings.tryAgain;
  elements.showSolutionBtn.querySelector(".btn__label").textContent =
    state.strings.showSolution;
  elements.timeLabel.textContent = getText(data.l10n?.timeSpent, "Tempo");

  if (state.behaviour.enableSolutionsButton === false) {
    elements.showSolutionBtn.style.display = "none";
  }

  if (state.behaviour.enableRetry === false) {
    elements.retryBtn.style.display = "none";
  }

  const rawWords = Array.isArray(data.words) ? data.words : [];
  state.words = rawWords.map((item, index) => createWord(item, index));
  state.wordsMap = new Map(state.words.map((w) => [w.id, w]));
  elements.statTotal.textContent = String(state.words.length);
}

function createWord(item, index) {
  const sanitized = normalizeAnswer(item.answer);
  if (!sanitized) {
    throw new Error(`Resposta invÃ¡lida para a pista "${item.clue}"`);
  }

  return {
    id: `${WORD_ID_PREFIX}${index}`,
    clue: getText(item.clue, `Palavra ${index + 1}`),
    answer: item.answer,
    sanitized,
    length: sanitized.length,
    orientationPreference: item.orientation ? item.orientation.toLowerCase() : null,
    fixWord: Boolean(item.fixWord),
    fixedRow: toIndex(item.row),
    fixedCol: toIndex(item.column),
    extraImage: item.extraImage || null,
    cells: [],
    coords: [],
    orientation: null,
    startRow: null,
    startCol: null,
    number: null,
    status: "pending",
    clueElement: null
  };
}

function toIndex(value) {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.floor(num - 1));
}

function normalizeAnswer(text) {
  if (!text) return "";
  return text
    .toString()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function normalizeChar(char) {
  if (!char) return "";
  return normalizeAnswer(char).slice(0, 1);
}

function getText(value, fallback) {
  return value && typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function generateLayout() {
  const words = [...state.words].sort((a, b) => b.length - a.length);
  const grid = new Map();
  const charMap = new Map();
  let minRow = 0;
  let maxRow = 0;
  let minCol = 0;
  let maxCol = 0;

  const placeWordOnGrid = (word, startRow, startCol, orientation) => {
    word.orientation = orientation;
    word.startRow = startRow;
    word.startCol = startCol;
    word.coords = [];
    for (let i = 0; i < word.length; i += 1) {
      const letter = word.sanitized[i];
      const row = orientation === "down" ? startRow + i : startRow;
      const col = orientation === "across" ? startCol + i : startCol;
      const key = `${row},${col}`;

      let cell = grid.get(key);
      if (!cell) {
        cell = {
          row,
          col,
          letter,
          words: { across: null, down: null }
        };
        grid.set(key, cell);
      }
      cell.letter = letter;
      if (orientation === "across") {
        cell.words.across = { wordId: word.id, index: i };
      } else {
        cell.words.down = { wordId: word.id, index: i };
      }

      word.coords.push({ row, col, index: i });

      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);

      if (!charMap.has(letter)) {
        charMap.set(letter, []);
      }
      charMap.get(letter).push({ row, col });
    }
  };

  const canPlaceWord = (word, startRow, startCol, orientation) => {
    for (let i = 0; i < word.length; i += 1) {
      const letter = word.sanitized[i];
      const row = orientation === "down" ? startRow + i : startRow;
      const col = orientation === "across" ? startCol + i : startCol;
      const key = `${row},${col}`;
      const cell = grid.get(key);

      if (cell) {
        if (cell.letter !== letter) {
          return false;
        }
        if (orientation === "across" && cell.words.across && cell.words.across.wordId !== word.id) {
          return false;
        }
        if (orientation === "down" && cell.words.down && cell.words.down.wordId !== word.id) {
          return false;
        }
      } else {
        // rudimentary adjacency checks to avoid touching words side-by-side
        if (orientation === "across") {
          const up = grid.get(`${row - 1},${col}`);
          const down = grid.get(`${row + 1},${col}`);
          if (up && (!up.words.down || up.words.down.wordId === word.id)) {
            return false;
          }
          if (down && (!down.words.down || down.words.down.wordId === word.id)) {
            return false;
          }
        } else {
          const left = grid.get(`${row},${col - 1}`);
          const right = grid.get(`${row},${col + 1}`);
          if (left && (!left.words.across || left.words.across.wordId === word.id)) {
            return false;
          }
          if (right && (!right.words.across || right.words.across.wordId === word.id)) {
            return false;
          }
        }
      }
    }

    // ensure preceding/following cells are empty when creating new word
    if (orientation === "across") {
      const before = grid.get(`${startRow},${startCol - 1}`);
      const after = grid.get(`${startRow},${startCol + word.length}`);
      if (before && (!before.words.across || before.words.across.wordId !== word.id)) {
        return false;
      }
      if (after && (!after.words.across || after.words.across.wordId !== word.id)) {
        return false;
      }
    } else {
      const before = grid.get(`${startRow - 1},${startCol}`);
      const after = grid.get(`${startRow + word.length},${startCol}`);
      if (before && (!before.words.down || before.words.down.wordId !== word.id)) {
        return false;
      }
      if (after && (!after.words.down || after.words.down.wordId !== word.id)) {
        return false;
      }
    }

    return true;
  };

  const findBestPlacement = (word, orientations) => {
    let bestPlacement = null;
    let bestIntersections = -1;

    const letters = word.sanitized.split("");
    const candidateCells = letters
      .map((letter, index) => {
        const cells = charMap.get(letter) || [];
        return cells.map((cell) => ({ ...cell, index }));
      })
      .flat();

    orientations.forEach((orientation) => {
      candidateCells.forEach((candidate) => {
        const deltaRow = orientation === "down" ? candidate.index : 0;
        const deltaCol = orientation === "across" ? candidate.index : 0;
        const startRow = candidate.row - deltaRow;
        const startCol = candidate.col - deltaCol;

        if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
          return;
        }

        if (!canPlaceWord(word, startRow, startCol, orientation)) {
          return;
        }

        let intersections = 0;
        for (let i = 0; i < word.length; i += 1) {
          const row = orientation === "down" ? startRow + i : startRow;
          const col = orientation === "across" ? startCol + i : startCol;
          if (grid.has(`${row},${col}`)) {
            intersections += 1;
          }
        }

        if (intersections > bestIntersections) {
          bestIntersections = intersections;
          bestPlacement = { startRow, startCol, orientation };
        }
      });
    });

    return bestPlacement;
  };

  words.forEach((word, listIndex) => {
    let orientationOrder = ["across", "down"];
    if (word.orientationPreference === "down") {
      orientationOrder = ["down", "across"];
    } else if (word.orientationPreference === "across") {
      orientationOrder = ["across", "down"];
    }

    if (word.fixWord && Number.isFinite(word.fixedRow) && Number.isFinite(word.fixedCol)) {
      const fixedOrientation =
        word.orientationPreference && ["across", "down"].includes(word.orientationPreference)
          ? word.orientationPreference
          : "across";
      if (canPlaceWord(word, word.fixedRow, word.fixedCol, fixedOrientation)) {
        placeWordOnGrid(word, word.fixedRow, word.fixedCol, fixedOrientation);
        return;
      }
    }

    if (grid.size === 0) {
      const startRow = 0;
      const startCol = 0;
      placeWordOnGrid(word, startRow, startCol, orientationOrder[0]);
      return;
    }

    const placement = findBestPlacement(word, orientationOrder);
    if (placement) {
      placeWordOnGrid(word, placement.startRow, placement.startCol, placement.orientation);
      return;
    }

    // fallback: append word below existing grid
    const fallbackRow = maxRow + 2 + listIndex;
    placeWordOnGrid(word, fallbackRow, minCol, orientationOrder[0]);
  });

  state.bounds = { minRow, maxRow, minCol, maxCol };
  buildMatrixFromGrid(grid);
  assignNumbers();
}

function buildMatrixFromGrid(grid) {
  const { minRow, maxRow, minCol, maxCol } = state.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const matrix = new Array(rows).fill(null).map(() => new Array(cols).fill(null));

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const globalRow = minRow + r;
      const globalCol = minCol + c;
      const key = `${globalRow},${globalCol}`;
      const cell = grid.get(key);
      if (!cell) {
        matrix[r][c] = { isEmpty: true };
        continue;
      }

      const finalCell = {
        row: globalRow,
        col: globalCol,
        displayRow: r,
        displayCol: c,
        solutionChar: cell.letter,
        userChar: "",
        normalizedChar: "",
        number: null,
        element: null,
        words: {
          across: null,
          down: null
        }
      };

      if (cell.words.across) {
        const word = state.wordsMap.get(cell.words.across.wordId);
        if (word) {
          if (!Array.isArray(word.cells)) {
            word.cells = [];
          }
          word.cells[cell.words.across.index] = finalCell;
          finalCell.words.across = {
            word,
            index: cell.words.across.index
          };
        }
      }

      if (cell.words.down) {
        const word = state.wordsMap.get(cell.words.down.wordId);
        if (word) {
          if (!Array.isArray(word.cells)) {
            word.cells = [];
          }
          word.cells[cell.words.down.index] = finalCell;
          finalCell.words.down = {
            word,
            index: cell.words.down.index
          };
        }
      }

      matrix[r][c] = finalCell;
    }
  }

  state.gridMatrix = matrix;
}

function assignNumbers() {
  let counter = 1;
  const rows = state.gridMatrix.length;
  const cols = rows ? state.gridMatrix[0].length : 0;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = state.gridMatrix[r][c];
      if (!cell || cell.isEmpty) continue;

      let assignsNumber = false;

      if (cell.words.across && cell.words.across.index === 0) {
        const leftCell = c > 0 ? state.gridMatrix[r][c - 1] : null;
        if (!leftCell || leftCell.isEmpty || !leftCell.words.across) {
          assignsNumber = true;
          const word = cell.words.across.word;
          if (word && word.number === null) {
            word.number = counter;
          }
        }
      }

      if (cell.words.down && cell.words.down.index === 0) {
        const upCell = r > 0 ? state.gridMatrix[r - 1][c] : null;
        if (!upCell || upCell.isEmpty || !upCell.words.down) {
          assignsNumber = true;
          const word = cell.words.down.word;
          if (word && word.number === null) {
            word.number = counter;
          }
        }
      }

      if (assignsNumber) {
        cell.number = counter;
        counter += 1;
      } else if (cell.words.across && cell.words.across.index === 0) {
        cell.number = cell.words.across.word.number;
      } else if (cell.words.down && cell.words.down.index === 0) {
        cell.number = cell.words.down.word.number;
      }
    }
  }
}

function renderTask() {
  renderGrid();
  renderClues();
  updateFeedback("");
  updateScoreDisplay();
  if (state.words.length > 0) {
    selectWord(state.words[0], 0, state.words[0].orientation);
  }
}

function renderGrid() {
  const { minRow, maxRow, minCol, maxCol } = state.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  elements.grid.style.setProperty("--grid-cols", cols);
  elements.grid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = state.gridMatrix[r][c];
      if (!cell || cell.isEmpty) {
        const empty = document.createElement("div");
        empty.className = "grid__cell grid__cell--empty";
        fragment.appendChild(empty);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "grid__cell";
      button.dataset.row = String(cell.row);
      button.dataset.col = String(cell.col);
      button.setAttribute("aria-label", `Linha ${cell.row + 1}, coluna ${cell.col + 1}`);
      button.setAttribute("role", "gridcell");
      button.tabIndex = -1;

      if (cell.number) {
        const badge = document.createElement("span");
        badge.className = "grid__cell-index";
        badge.textContent = String(cell.number);
        button.appendChild(badge);
      }

      const letter = document.createElement("span");
      letter.className = "grid__cell-letter";
      letter.textContent = "";
      button.appendChild(letter);

      cell.element = button;
      cell.letterElement = letter;
      button.addEventListener("click", () => handleCellClick(cell));
      fragment.appendChild(button);
    }
  }

  elements.grid.appendChild(fragment);
  resizeGridShell();
}

function renderClues() {
  elements.cluesList.innerHTML = "";
  const items = state.words
    .slice()
    .sort((a, b) => {
      if (a.number === b.number) {
        if (a.orientation === b.orientation) {
          return a.clue.localeCompare(b.clue);
        }
        return a.orientation === "across" ? -1 : 1;
      }
      return a.number - b.number;
    })
    .map((word) => createClueItem(word));

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(item));
  elements.cluesList.appendChild(fragment);
}

function createClueItem(word) {
  const li = document.createElement("li");
  li.className = "clue";
  li.dataset.wordId = word.id;

  const header = document.createElement("div");
  header.className = "clue__header";

  const text = document.createElement("div");
  text.className = "clue__text";

  const meta = document.createElement("div");
  meta.className = "clue__meta";
  meta.textContent =
    word.orientation === "down" ? state.strings.down : state.strings.across;

  const label = document.createElement("p");
  label.className = "clue__label";
  label.textContent = `${word.number}. ${word.clue}`;

  text.append(meta, label);
  header.appendChild(text);

  if (word.extraImage && (word.extraImage.path || word.extraImage.dataUrl)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue__extra-btn";
    btn.textContent = state.strings.extraClue;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openExtraClue(word);
    });
    header.appendChild(btn);
  }

  li.appendChild(header);

  const status = document.createElement("div");
  status.className = "clue__status";
  status.textContent = "";
  li.appendChild(status);

  li.addEventListener("click", () => selectWord(word, 0, word.orientation));
  word.clueElement = li;
  word.statusElement = status;

  return li;
}

function attachEvents() {
  document.addEventListener("keydown", handleKeyDown);
  elements.checkBtn.addEventListener("click", handleCheck);
  elements.retryBtn.addEventListener("click", handleRetry);
  elements.showSolutionBtn.addEventListener("click", handleShowSolution);
  elements.extraClose.addEventListener("click", closeExtraClue);
  elements.extraOverlay.addEventListener("click", (event) => {
    if (event.target === elements.extraOverlay) {
      closeExtraClue();
    }
  });
  window.addEventListener("resize", handleWindowResize, { passive: true });
  if (elements.keyboardBody) {
    buildKeyboard();
  }
  if (elements.keyboardClose) {
    elements.keyboardClose.addEventListener("click", closeKeyboard);
  }
  if (elements.keyboardOverlay) {
    elements.keyboardOverlay.addEventListener("click", (event) => {
      if (event.target === elements.keyboardOverlay) {
        closeKeyboard();
      }
    });
  }
}

function handleCellClick(cell) {
  const orientations = [];
  if (cell.words.across) orientations.push("across");
  if (cell.words.down) orientations.push("down");
  if (orientations.length === 0) return;

  let orientation = orientations[0];
  if (
    state.activeCell === cell &&
    orientations.length > 1 &&
    state.activeOrientation === orientations[0]
  ) {
    orientation = orientations[1];
  } else if (orientations.includes(state.activeOrientation)) {
    orientation = state.activeOrientation;
  }

  const wordRef =
    orientation === "across" ? cell.words.across.word : cell.words.down.word;
  const index =
    orientation === "across" ? cell.words.across.index : cell.words.down.index;
  selectWord(wordRef, index, orientation);
}

function selectWord(word, index = 0, orientation = word.orientation) {
  if (!word) return;
  clearHighlights();

  state.activeWord = word;
  state.activeOrientation = orientation;
  state.activeIndex = index;
  state.highlightedCells = [...word.cells];

  word.cells.forEach((cell) => {
    if (!cell?.element) return;
    cell.element.classList.add("is-highlight");
  });

  if (word.clueElement) {
    word.clueElement.classList.add("is-active");
  }

  focusCell(word.cells[index]);
}

function focusCell(cell) {
  if (!cell || !cell.element) return;
  if (state.activeCell?.element) {
    state.activeCell.element.classList.remove("is-active");
  }
  state.activeCell = cell;
  cell.element.classList.add("is-active");
  cell.element.focus({ preventScroll: true });
  if (state.isTouch) {
    openKeyboard();
  }
}

function clearHighlights() {
  state.highlightedCells.forEach((cell) => cell?.element?.classList.remove("is-highlight"));
  if (state.activeCell?.element) {
    state.activeCell.element.classList.remove("is-active");
  }
  state.words.forEach((word) => {
    word.clueElement?.classList.remove("is-active");
  });
  state.highlightedCells = [];
  state.activeCell = null;
  if (state.isTouch) {
    closeKeyboard();
  }
}

function handleKeyDown(event) {
  if (!state.activeCell || !state.activeWord) {
    return;
  }

  const key = event.key;
  if (key.length === 1) {
    const normalized = normalizeChar(key);
    if (normalized) {
      event.preventDefault();
      setCellValue(state.activeCell, key);
      moveToNextCell();
      return;
    }
  }

  switch (key) {
    case "Backspace":
    case "Delete":
      event.preventDefault();
      if (state.activeCell.userChar) {
        setCellValue(state.activeCell, "");
      } else {
        moveToPreviousCell();
      }
      break;
    case "ArrowRight":
      event.preventDefault();
      if (state.activeOrientation === "across") {
        moveToNextCell();
      } else {
        moveInDirection(0, 1);
      }
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (state.activeOrientation === "across") {
        moveToPreviousCell();
      } else {
        moveInDirection(0, -1);
      }
      break;
    case "ArrowDown":
      event.preventDefault();
      if (state.activeOrientation === "down") {
        moveToNextCell();
      } else {
        moveInDirection(1, 0);
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (state.activeOrientation === "down") {
        moveToPreviousCell();
      } else {
        moveInDirection(-1, 0);
      }
      break;
    case " ":
    case "Spacebar":
      event.preventDefault();
      toggleOrientation();
      break;
    default:
      break;
  }
}

function moveToNextCell() {
  const word = state.activeWord;
  if (!word) return;
  const nextIndex = Math.min(word.cells.length - 1, state.activeIndex + 1);
  state.activeIndex = nextIndex;
  focusCell(word.cells[nextIndex]);
}

function moveToPreviousCell() {
  const word = state.activeWord;
  if (!word) return;
  const prevIndex = Math.max(0, state.activeIndex - 1);
  state.activeIndex = prevIndex;
  focusCell(word.cells[prevIndex]);
}

function moveInDirection(deltaRow, deltaCol) {
  const targetRow = state.activeCell.row + deltaRow;
  const targetCol = state.activeCell.col + deltaCol;
  const cell = findCellByCoords(targetRow, targetCol);
  if (cell && !cell.isEmpty) {
    const orientations = [];
    if (cell.words.across) orientations.push("across");
    if (cell.words.down) orientations.push("down");
    let orientation = orientations[0];
    if (orientations.includes(state.activeOrientation)) {
      orientation = state.activeOrientation;
    }
    const word =
      orientation === "across" ? cell.words.across.word : cell.words.down.word;
    const index =
      orientation === "across" ? cell.words.across.index : cell.words.down.index;
    selectWord(word, index, orientation);
  }
}

function toggleOrientation() {
  const cell = state.activeCell;
  if (!cell) return;
  if (cell.words.across && cell.words.down) {
    const newOrientation = state.activeOrientation === "across" ? "down" : "across";
    const word =
      newOrientation === "across" ? cell.words.across.word : cell.words.down.word;
    const index =
      newOrientation === "across" ? cell.words.across.index : cell.words.down.index;
    selectWord(word, index, newOrientation);
  }
}

function findCellByCoords(row, col) {
  const rIndex = row - state.bounds.minRow;
  const cIndex = col - state.bounds.minCol;
  if (
    rIndex < 0 ||
    cIndex < 0 ||
    rIndex >= state.gridMatrix.length ||
    cIndex >= state.gridMatrix[0].length
  ) {
    return null;
  }
  return state.gridMatrix[rIndex][cIndex];
}

function setCellValue(cell, value) {
  const normalized = normalizeChar(value);
  cell.userChar = normalized ? value.toUpperCase() : "";
  cell.normalizedChar = normalized;
  updateCellDisplay(cell);
  resetWordStatus(cell, true);
}

function updateCellDisplay(cell) {
  if (!cell.element) return;
  cell.letterElement.textContent = cell.userChar || "";
}

function resetWordStatus(cell, clearClasses) {
  ["across", "down"].forEach((orientation) => {
    const ref = cell.words[orientation];
    if (!ref) return;
    const word = ref.word;
    if (word.status !== "pending") {
      word.status = "pending";
      if (word.clueElement) {
        word.clueElement.classList.remove("is-correct", "is-wrong");
        if (word.statusElement) {
          word.statusElement.textContent = "";
        }
      }
      word.cells.forEach((wCell) => {
        if (!wCell?.element) return;
        wCell.element.classList.remove("is-correct", "is-wrong", "is-solution");
      });
    } else if (clearClasses) {
      word.cells.forEach((wCell) => {
        wCell?.element?.classList.remove("is-correct", "is-wrong", "is-solution");
      });
    }
  });
  state.isChecked = false;
  updateFeedback("");
  updateScoreDisplay();
}

function handleCheck() {
  let correctWords = 0;
  state.words.forEach((word) => {
    const input = word.cells.map((cell) => cell.normalizedChar || "").join("");
    const isCorrect = input.length === word.length && input === word.sanitized;
    word.status = isCorrect ? "correct" : "wrong";
    updateWordClasses(word, isCorrect);
    if (isCorrect) {
      correctWords += 1;
    }
  });

  state.score = correctWords;
  state.isChecked = true;
  updateScoreDisplay();
  updateFeedback(formatResultMessage(correctWords, state.words.length));
  if (state.isTouch) {
    closeKeyboard();
  }
}

function updateWordClasses(word, isCorrect) {
  const addClass = isCorrect ? "is-correct" : "is-wrong";
  const removeClass = isCorrect ? "is-wrong" : "is-correct";
  word.cells.forEach((cell) => {
    if (!cell?.element) return;
    cell.element.classList.remove(removeClass, "is-solution");
    cell.element.classList.add(addClass);
  });
  if (word.clueElement) {
    word.clueElement.classList.remove(removeClass);
    word.clueElement.classList.add(addClass);
  }
  if (word.statusElement) {
    word.statusElement.textContent = isCorrect ? state.strings.resultCorrect : state.strings.resultWrong;
  }
}

function handleShowSolution() {
  state.words.forEach((word) => {
    word.cells.forEach((cell, index) => {
      cell.userChar = word.sanitized[index];
      cell.normalizedChar = word.sanitized[index];
      if (cell.element) {
        cell.element.classList.remove("is-correct", "is-wrong");
        cell.element.classList.add("is-solution");
      }
      updateCellDisplay(cell);
    });
    word.status = "correct";
    if (word.clueElement) {
      word.clueElement.classList.remove("is-wrong");
      word.clueElement.classList.add("is-correct");
    }
    if (word.statusElement) {
      word.statusElement.textContent = state.strings.resultCorrect;
    }
  });

  state.score = state.words.length;
  state.isChecked = true;
  updateScoreDisplay();
  updateFeedback(formatResultMessage(state.score, state.words.length));
  if (state.isTouch) {
    closeKeyboard();
  }
}

function handleRetry() {
  state.words.forEach((word) => {
    word.status = "pending";
    word.cells.forEach((cell) => {
      cell.userChar = "";
      cell.normalizedChar = "";
      if (cell.element) {
        cell.element.classList.remove("is-correct", "is-wrong", "is-solution");
      }
      updateCellDisplay(cell);
    });
    if (word.clueElement) {
      word.clueElement.classList.remove("is-correct", "is-wrong");
    }
    if (word.statusElement) {
      word.statusElement.textContent = "";
    }
  });
  state.score = 0;
  state.isChecked = false;
  updateFeedback("");
  updateScoreDisplay();
  clearHighlights();
  resetTimer();
  startTimer();
  if (state.isTouch) {
    closeKeyboard();
  }
}

function updateScoreDisplay() {
  elements.statScore.textContent = String(state.score);
}

function updateFeedback(message) {
  elements.feedback.textContent = message;
}

function formatResultMessage(score, total) {
  return state.strings.feedbackTemplate
    .replace("@score", score)
    .replace("@total", total);
}

function startTimer() {
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
  }
  updateTimerDisplay();
  state.timer.interval = setInterval(() => {
    state.timer.seconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
  }
  state.timer.seconds = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(state.timer.seconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.timer.seconds % 60).toString().padStart(2, "0");
  elements.timeValue.textContent = `${minutes}:${seconds}`;
}

function openExtraClue(word) {
  if (!word.extraImage || (!word.extraImage.dataUrl && !word.extraImage.path)) return;
  elements.extraBody.innerHTML = "";
  const img = document.createElement("img");
  img.src = word.extraImage.path || word.extraImage.dataUrl;
  img.alt = word.extraImage.alt || "";
  elements.extraBody.appendChild(img);
  elements.extraOverlay.hidden = false;
  elements.extraClose.focus({ preventScroll: true });
}

function closeExtraClue() {
  elements.extraOverlay.hidden = true;
}

function buildKeyboard() {
  if (!elements.keyboardBody) return;
  elements.keyboardBody.innerHTML = "";

  KEYBOARD_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard__row";
    row.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "keyboard__key";
      btn.textContent = key;
      btn.dataset.key = key;
      btn.addEventListener("click", () => handleKeyboardKey(key));
      rowEl.appendChild(btn);
    });
    elements.keyboardBody.appendChild(rowEl);
  });

  const actionsRow = document.createElement("div");
  actionsRow.className = "keyboard__actions";
  KEYBOARD_ACTIONS.forEach(({ label, action }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "keyboard__key";
    btn.textContent = label;
    btn.dataset.action = action;
    btn.addEventListener("click", () => handleKeyboardAction(action));
    actionsRow.appendChild(btn);
  });
  elements.keyboardBody.appendChild(actionsRow);
}

function openKeyboard() {
  if (!state.isTouch || !elements.keyboardOverlay) return;
  elements.keyboardOverlay.hidden = false;
  elements.keyboardOverlay.setAttribute("aria-hidden", "false");
}

function closeKeyboard() {
  if (!elements.keyboardOverlay) return;
  elements.keyboardOverlay.hidden = true;
  elements.keyboardOverlay.setAttribute("aria-hidden", "true");
}

function handleKeyboardKey(key) {
  if (!state.activeCell) return;
  setCellValue(state.activeCell, key);
  moveToNextCell();
}

function handleKeyboardAction(action) {
  if (!state.activeCell) return;
  switch (action) {
    case "backspace":
      if (state.activeCell.userChar) {
        setCellValue(state.activeCell, "");
      } else {
        moveToPreviousCell();
      }
      break;
    case "clear":
      setCellValue(state.activeCell, "");
      break;
    case "close":
      closeKeyboard();
      break;
    default:
      break;
  }
}

function resizeGridShell() {
  if (!elements.gridShell || !elements.grid) {
    return;
  }

  const cell = elements.grid.querySelector(".grid__cell:not(.grid__cell--empty)");
  if (!cell) {
    return;
  }

  const rect = cell.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const gridStyles = getComputedStyle(elements.grid);
  const shellStyles = getComputedStyle(elements.gridShell);
  const gap = parseFloat(gridStyles.gap) || 0;
  const rows = state.gridMatrix.length;
  const cols = rows ? state.gridMatrix[0].length : 0;

  if (!rows || !cols) {
    return;
  }

  elements.gridShell.style.width = "100%";
  const shellRect = elements.gridShell.getBoundingClientRect();

  const paddingX =
    parseFloat(shellStyles.paddingLeft || "0") +
    parseFloat(shellStyles.paddingRight || "0");
  const paddingY =
    parseFloat(shellStyles.paddingTop || "0") +
    parseFloat(shellStyles.paddingBottom || "0");
  const borderX =
    parseFloat(shellStyles.borderLeftWidth || "0") +
    parseFloat(shellStyles.borderRightWidth || "0");
  const borderY =
    parseFloat(shellStyles.borderTopWidth || "0") +
    parseFloat(shellStyles.borderBottomWidth || "0");

  const innerMargin = Math.max(gap, 8);
  const availableWidth = shellRect.width - paddingX - borderX - innerMargin * 2;
  if (availableWidth <= 0) {
    return;
  }

  const cellStyles = getComputedStyle(cell);
  const borderXPerCell =
    parseFloat(cellStyles.borderLeftWidth || "0") +
    parseFloat(cellStyles.borderRightWidth || "0");
  const borderYPerCell =
    parseFloat(cellStyles.borderTopWidth || "0") +
    parseFloat(cellStyles.borderBottomWidth || "0");

  const minCell = 28;
  const maxCell = 84;
  const totalGapX = gap * Math.max(0, cols - 1);
  const computedCell = Math.max(
    minCell,
    Math.min(
      maxCell,
      (availableWidth - borderXPerCell * cols - totalGapX) / cols
    )
  );

  const cellTotalWidth = computedCell + borderXPerCell;
  const cellTotalHeight = computedCell + borderYPerCell;
  const gridWidth = cellTotalWidth * cols + totalGapX;
  const gridHeight = cellTotalHeight * rows + Math.max(0, rows - 1) * gap;

  elements.grid.style.setProperty("--cell-size", `${computedCell}px`);
  elements.grid.style.width = `${Math.ceil(gridWidth)}px`;
  elements.grid.style.margin = `${Math.ceil(innerMargin)}px auto`;
  const shellHeight = Math.ceil(gridHeight + paddingY + borderY + innerMargin * 2);
  elements.gridShell.style.height = `${shellHeight}px`;
}

function handleWindowResize() {
  if (state.resizeFrame) {
    cancelAnimationFrame(state.resizeFrame);
  }
  state.resizeFrame = requestAnimationFrame(() => {
    state.resizeFrame = null;
    resizeGridShell();
  });
}





