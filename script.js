// 網格尺寸
const N = 9;
// 數獨網格 (9x9)
let grid = Array.from({ length: N }, () => Array(N).fill(0));
// 當前謎題（給定值）；用於恢復與重渲染
let currentPuzzle = Array.from({ length: N }, () => Array(N).fill(0));
// 使用者輸入追蹤 (9x9)
let userInput = Array.from({ length: N }, () => Array(N).fill(0));
// 候選數字追蹤 (9x9，每格是 Set)
let candidates = Array.from({ length: N }, () => Array(N).fill(null).map(() => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])));
// 本地儲存鍵與版本
const STORAGE_KEY = 'sudoku-progress-v1';
const DIFFICULTY_KEY = 'sudoku-difficulty';
let globalBestPuzzle = null;
let globalBestRemoved = 0;
const DIFFICULTIES = {
    intro: { removals: 46 },
    easy: { removals: 50 },
    medium: { removals: 52 },
    hard: { removals: 54 },
    expert: { removals: 58 }
};
let lastSavedElapsed = null; // 用於節流計時器自動保存

// DOM 元素
const gridContainer = document.getElementById('sudoku-grid');
const statusSpan = document.getElementById('status');
const errorCountSpan = document.getElementById('error-count');
const timerSpan = document.getElementById('timer');
const consoleToast = document.getElementById('console-toast');
const pauseBtn = document.getElementById('pause-btn');

// 集中遊戲狀態
const state = {
    selectedCell: null, // { row, col }
    candidateMode: false,
    errorCount: 0,
    gameOver: false,
    hintsUsed: 0,
    hintCells: new Set(),
    gameStartTime: null,
    timerInterval: null,
    isPaused: false,
    pauseOverlay: null,
    pauseStartTime: null,
    totalPausedTime: 0,
    toastTimeout: null,
    currentDifficulty: null
};

function showToast(message) {
    console.log(message); // 保留原本的 console.log
    if (state.toastTimeout) {
        clearTimeout(state.toastTimeout);
    }
    consoleToast.textContent = message;
    consoleToast.classList.add('show');
    state.toastTimeout = setTimeout(() => {
        consoleToast.classList.remove('show');
    }, 8000);
}

// 難度設定：載入、切換、更新 UI 樣式
function loadSavedDifficulty() {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    if (saved && DIFFICULTIES[saved]) return saved;
    return 'intro';
}

function updateDifficultyButtons() {
    // Difficulty buttons are now only in pause overlay, no static buttons to update
}

function setDifficulty(level) {
    if (!DIFFICULTIES[level]) return;
    state.currentDifficulty = level;
    try {
        localStorage.setItem(DIFFICULTY_KEY, level);
    } catch (err) {
        console.warn(i18n.t('difficultyFailed'), err);
    }
    updateDifficultyButtons();
}

// 初始化當前難度（第一次使用預設為 easy）
state.currentDifficulty = loadSavedDifficulty();

// 已集中於 state 物件，移除未用全域變數

// --- 核心工具函數 ---

function isSafe(row, col, num) {
    for (let c = 0; c < N; c++) if (grid[row][c] === num) return false;
    for (let r = 0; r < N; r++) if (grid[r][col] === num) return false;
    const sr = Math.floor(row / 3) * 3;
    const sc = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (grid[sr + r][sc + c] === num) return false;
    return true;
}

function fillGrid(row = 0, col = 0) {
    if (row === N - 1 && col === N) return true;
    if (col === N) { row++; col = 0; }

    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    for (const num of nums) {
        if (isSafe(row, col, num)) {
            grid[row][col] = num;
            if (fillGrid(row, col + 1)) return true;
            grid[row][col] = 0;
        }
    }
    return false;
}

// 在任意 puzzle 上檢查合法性（不使用全域 grid）
function isSafeIn(puzzle, row, col, num) {
    for (let c = 0; c < N; c++) if (puzzle[row][c] === num) return false;
    for (let r = 0; r < N; r++) if (puzzle[r][col] === num) return false;
    const sr = Math.floor(row / 3) * 3;
    const sc = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (puzzle[sr + r][sc + c] === num) return false;
    return true;
}

// 計算 puzzle 的解的數量，上限 limit 可以提早停止以節省時間
function countSolutions(puzzle, limit = 2) {
    let count = 0;

    function backtrack() {
        if (count >= limit) return;
        let found = false, row = -1, col = -1;
        for (let r = 0; r < N && !found; r++) {
            for (let c = 0; c < N; c++) {
                if (puzzle[r][c] === 0) { row = r; col = c; found = true; break; }
            }
        }
        if (!found) { count++; return; }
        for (let num = 1; num <= 9 && count < limit; num++) {
            if (isSafeIn(puzzle, row, col, num)) {
                puzzle[row][col] = num;
                backtrack();
                puzzle[row][col] = 0;
            }
        }
    }

    backtrack();
    return count;
}

/**
 * 計算謎題的難度分數（基於解題所需技巧）
 * @param {Array} puzzle 要評估的謎題
 * @returns {number} 難度分數（越高越難）
 */
function evaluatePuzzleDifficulty(puzzle) {
    let score = 0;
    const tempCandidates = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );

    // 初始化候選數字
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (puzzle[r][c] !== 0) {
                tempCandidates[r][c].clear();
            } else {
                for (let i = 0; i < N; i++) {
                    if (puzzle[r][i] !== 0) tempCandidates[r][c].delete(puzzle[r][i]);
                    if (puzzle[i][c] !== 0) tempCandidates[r][c].delete(puzzle[i][c]);
                }
                const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
                for (let dr = 0; dr < 3; dr++) {
                    for (let dc = 0; dc < 3; dc++) {
                        if (puzzle[br + dr][bc + dc] !== 0) {
                            tempCandidates[r][c].delete(puzzle[br + dr][bc + dc]);
                        }
                    }
                }
            }
        }
    }

    // 統計候選數字分佈
    let nakedSingleCount = 0; // 只有1個候選數字的格子數量
    let twoOrThreeCount = 0;  // 有2-3個候選數字的格子數量
    let fourPlusCount = 0;     // 有4+個候選數字的格子數量
    let minCandidateCount = 9;
    let totalCandidates = 0, emptyCells = 0;

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (puzzle[r][c] === 0 && tempCandidates[r][c].size > 0) {
                const size = tempCandidates[r][c].size;
                emptyCells++;
                totalCandidates += size;
                minCandidateCount = Math.min(minCandidateCount, size);

                if (size === 1) nakedSingleCount++;
                else if (size <= 3) twoOrThreeCount++;
                else fourPlusCount++;
            }
        }
    }

    // 核心難度指標：Naked Single 越少越難（重點懲罰）
    // 如果有太多 Naked Single，大幅降低分數
    if (nakedSingleCount > 0) {
        score -= nakedSingleCount * 50; // 每個 Naked Single 扣 50 分
    }

    // 最小候選數越大越難（獎勵）
    score += (minCandidateCount - 1) * 30;

    // 2-3 個候選數字的格子越多越好（適度難度）
    score += twoOrThreeCount * 10;

    // 4+ 個候選數字的格子給予額外獎勵
    score += fourPlusCount * 15;

    // 平均候選數越多越難
    if (emptyCells > 0) {
        const avgCandidates = totalCandidates / emptyCells;
        score += Math.floor(avgCandidates * 8);
    }

    // 移除的格子數量獎勵（更多空格）
    score += emptyCells * 2;

    return score;
}

/**
 * 從完整的網格中移除數字以創建謎題
 * @param {number} targetRemovals 要移除的目標格數
 * @param {boolean} ensureUnique 是否檢查並保證唯一解
 * @param {number} retryCount 重試次數（防守用）
 */
function createPuzzle(targetRemovals, ensureUnique = true, retryCount = 0) {
    // 首次呼叫重置全域追蹤
    if (retryCount === 0) {
        globalBestPuzzle = null;
        globalBestRemoved = 0;
    }

    targetRemovals = Math.min(Math.max(Math.floor(targetRemovals || 45), 0), 81);
    let bestPuzzle = grid.map(row => [...row]);
    let bestRemoved = 0;
    const maxAttempts = 15;
    let actualAttempts = 0;

    if (retryCount > 5) {
        console.warn(i18n.t('retryExceeded', globalBestRemoved, targetRemovals));
        return globalBestPuzzle || grid.map(row => [...row]);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        actualAttempts++;
        let currentPuzzle = grid.map(row => [...row]);
        let currentRemoved = 0;

        const positions = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                positions.push([r, c]);
            }
        }

        if (attempt % 2 === 0) {
            positions.sort((a, b) => {
                const distA = Math.abs(a[0] - 4) + Math.abs(a[1] - 4);
                const distB = Math.abs(b[0] - 4) + Math.abs(b[1] - 4);
                return distA - distB;
            });
        } else {
            for (let i = positions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
        }

        for (const [r, c] of positions) {
            if (currentPuzzle[r][c] === 0) continue;
            if (currentRemoved >= targetRemovals) break;

            const value = currentPuzzle[r][c];
            currentPuzzle[r][c] = 0;

            if (ensureUnique) {
                const solutions = countSolutions(currentPuzzle.map(row => [...row]), 2);
                if (solutions === 1) {
                    currentRemoved++;
                } else {
                    currentPuzzle[r][c] = value;
                }
            } else {
                currentRemoved++;
            }
        }

        if (currentRemoved > bestRemoved) {
            bestRemoved = currentRemoved;
            bestPuzzle = currentPuzzle.map(row => [...row]);

            // 追蹤全域最佳結果
            if (currentRemoved > globalBestRemoved) {
                globalBestRemoved = currentRemoved;
                globalBestPuzzle = currentPuzzle.map(row => [...row]);
            }

            // 達到目標移除格數，提前結束
            if (currentRemoved >= targetRemovals) {
                break;
            }
        }
    }

    // 更新全域最佳結果
    if (bestRemoved > globalBestRemoved) {
        globalBestRemoved = bestRemoved;
        globalBestPuzzle = bestPuzzle.map(row => [...row]);
    }

    // 如果未達到目標移除格數，重新生成新的完整網格並再次嘗試
    if (bestRemoved < targetRemovals) {
        console.log(i18n.t('puzzleBelowTarget', bestRemoved, targetRemovals));
        grid = Array.from({ length: N }, () => Array(N).fill(0));
        fillGrid(0, 0);
        return createPuzzle(targetRemovals, ensureUnique, retryCount + 1);
    }

    console.log(i18n.t('puzzleComplete', bestRemoved, targetRemovals, actualAttempts));
    return bestPuzzle;
}

// --- 介面操作函數 ---
function renderGrid(puzzle) {
    gridContainer.innerHTML = '';
    // 初始化使用者輸入陣列
    userInput = Array.from({ length: N }, () => Array(N).fill(0));
    // 將謎題中給定的數字複製到 userInput（這樣 isNumberComplete 才能正確計算）
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (puzzle[r][c] !== 0) {
                userInput[r][c] = puzzle[r][c];
            }
        }
    }
    candidates = Array.from({ length: N }, () => Array(N).fill(null).map(() => new Set()));

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            const value = puzzle[r][c];

            if (value !== 0) {
                // 給定的提示數字
                cell.textContent = value;
                cell.classList.add('given');
                cell.addEventListener('click', () => selectCell(r, c));
            } else {
                // 空白格：顯示候選數字區域或輸入值
                const notesDiv = document.createElement('div');
                notesDiv.className = 'notes-container';

                // 建立 1-9 候選數字，預設隱藏
                for (let num = 1; num <= 9; num++) {
                    const noteCell = document.createElement('div');
                    noteCell.className = 'note-cell hidden';
                    noteCell.textContent = num;
                    noteCell.dataset.num = num;
                    notesDiv.appendChild(noteCell);
                }

                cell.appendChild(notesDiv);
                cell.addEventListener('click', () => selectCell(r, c));

                // Double click 時，如果只有一個候選數字，直接輸入
                cell.addEventListener('dblclick', () => {
                    if (candidates[r][c].size === 1) {
                        const num = Array.from(candidates[r][c])[0];
                        inputNumber(num);
                    }
                });
            }

            gridContainer.appendChild(cell);
        }
    }
}

// 選擇格子
function selectCell(row, col, keepHints = false) {
    // 移除前一個選擇的高亮
    if (state.selectedCell) {
        const prevCell = gridContainer.querySelector(`[data-row="${state.selectedCell.row}"][data-col="${state.selectedCell.col}"]`);
        if (prevCell) prevCell.classList.remove('selected');
    }

    // 移除所有提示邊框和相關提示（點選其他格子時）
    // 但如果是提示功能調用，則保留提示樣式
    if (!keepHints) {
        document.querySelectorAll('.cell.hint-border').forEach(c => c.classList.remove('hint-border'));
        document.querySelectorAll('.cell.hint-related').forEach(c => c.classList.remove('hint-related'));
    }

    // 設置新選擇
    state.selectedCell = { row, col };
    const newCell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (newCell) {
        newCell.classList.add('selected');
        updateCellDisplay(row, col);
    }
    updateHighlights();

    // 更新候選按鈕的樣式
    updateCandidateButtonStyles(row, col);
}

// 更新候選按鈕的樣式根據選定格子的候選數字
function updateCandidateButtonStyles(row, col) {
    // 先移除所有按鈕的 active 類（包括答案按鈕和候選按鈕）
    document.querySelectorAll('.answer-btn, .candidate-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 如果選定的格子沒有輸入值（即有候選數字），則高亮相關按鈕
    if (userInput[row][col] === 0 && candidates[row][col]) {
        candidates[row][col].forEach(num => {
            // 同時高亮答案按鈕和候選按鈕
            const answerBtn = document.querySelector(`.answer-btn[data-num="${num}"]`);
            const candidateBtn = document.querySelector(`.candidate-btn[data-num="${num}"]`);
            if (answerBtn) answerBtn.classList.add('active');
            if (candidateBtn) candidateBtn.classList.add('active');
        });
    }
}

// 高亮：同行、同列、同區塊；若已輸入數值則高亮相同數字與候選
function updateHighlights() {
    const cells = gridContainer.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('highlight-related', 'highlight-same');
    });
    const noteCells = gridContainer.querySelectorAll('.note-cell');
    noteCells.forEach(n => {
        n.classList.remove('highlight-same-candidate');
    });

    if (!state.selectedCell) {
        // 點選清除時，重新更新所有候選顯示
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                updateCellDisplay(r, c);
            }
        }
        return;
    }
    const { row: sRow, col: sCol } = state.selectedCell;
    const selectedCellEl = gridContainer.querySelector(`[data-row="${sRow}"][data-col="${sCol}"]`);
    const selectedValue = selectedCellEl && (selectedCellEl.classList.contains('given') ? grid[sRow][sCol] : userInput[sRow][sCol]);

    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        // 行列區塊高亮
        const sameBox = (Math.floor(r / 3) === Math.floor(sRow / 3) && Math.floor(c / 3) === Math.floor(sCol / 3));
        if (r === sRow || c === sCol || sameBox) {
            cell.classList.add('highlight-related');
        }

        if (selectedValue && selectedValue > 0) {
            const cellValue = cell.classList.contains('given') ? grid[r][c] : userInput[r][c];
            if (cellValue === selectedValue) {
                cell.classList.add('highlight-same');
            }
        }
    });

    if (selectedValue && selectedValue > 0) {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (candidates[r][c] && candidates[r][c].has(selectedValue)) {
                    const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    const notesDiv = cell && cell.querySelector('.notes-container');
                    if (notesDiv) {
                        const note = notesDiv.querySelector(`.note-cell[data-num="${selectedValue}"]`);
                        if (note) {
                            note.classList.add('highlight-same-candidate');
                        }
                    }
                }
            }
        }
    }
    // 只有當選中的格子有數值時，才重新更新所有候選顯示
    if (selectedValue && selectedValue > 0) {
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                updateCellDisplay(r, c);
            }
        }
    }
}

// 更新格子顯示（根據候選模式和輸入值）
function updateCellDisplay(row, col) {
    const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cell || cell.classList.contains('given')) return;

    let notesDiv = cell.querySelector('.notes-container');
    if (!notesDiv) {
        // 若 notesDiv 不存在，重新建立
        notesDiv = document.createElement('div');
        notesDiv.className = 'notes-container';
        for (let n = 1; n <= 9; n++) {
            const noteCell = document.createElement('div');
            noteCell.className = 'note-cell';
            noteCell.dataset.num = n;
            noteCell.textContent = n;
            notesDiv.appendChild(noteCell);
        }
        cell.appendChild(notesDiv);
    }
    // ...existing code...

    const value = userInput[row][col];

    // 新邏輯：有主答案時只顯示主答案，沒主答案時永遠顯示 notes-container
    // 先清除 cell 內所有純文字節點（只保留 notesDiv）
    Array.from(cell.childNodes).forEach(node => {
        if (node !== notesDiv && node.nodeType === 3) cell.removeChild(node);
    });
    if (value !== 0) {
        // 有主答案，隱藏 notesDiv，顯示主答案
        notesDiv.classList.add('hidden');
        if (!cell.contains(notesDiv)) {
            cell.appendChild(notesDiv);
        }
        cell.insertBefore(document.createTextNode(value), notesDiv);
    } else {
        // 沒主答案，永遠顯示 notesDiv
        notesDiv.classList.remove('hidden');
        if (!cell.contains(notesDiv)) {
            cell.appendChild(notesDiv);
        }
        const noteCells = notesDiv.querySelectorAll('.note-cell');
        noteCells.forEach(noteCell => {
            const num = parseInt(noteCell.dataset.num);
            const isCandidate = candidates[row][col].has(num);
            noteCell.classList.remove('hidden');
            noteCell.classList.toggle('active-candidate', isCandidate);
            noteCell.classList.toggle('inactive', !isCandidate);
        });
    }
}

// 驗證輸入的數字是否正確
function validateInput(row, col, num) {
    return grid[row][col] === num;
}

// 更新錯誤計數器顯示
function updateErrorDisplay() {
    if (errorCountSpan) {
        errorCountSpan.textContent = state.errorCount;
        // 有錯誤時顯示為紅字
        if (state.errorCount > 0) {
            errorCountSpan.classList.add('has-error');
        } else {
            errorCountSpan.classList.remove('has-error');
        }
    }
    if (state.errorCount >= 3 && !state.gameOver) {
        state.gameOver = true;
        setTimeout(() => showGameOverDialog(), 500);
    }
}

// 輸入數字
function inputNumber(num) {
    if (!state.selectedCell || state.gameOver) return;
    const { row, col } = state.selectedCell;

    if (state.candidateMode) {
        // 候選模式：切換候選數字
        if (candidates[row][col].has(num)) {
            candidates[row][col].delete(num);
        } else {
            candidates[row][col].add(num);
        }
        updateCellDisplay(row, col);
        updateCandidateButtonStyles(row, col); // 更新按鈕樣式
        saveGame();
    } else {
        // 普通模式：設置值（清空候選數字）

        // 如果格子已經有值，忽略再次輸入，避免誤操作增加錯誤次數
        if (userInput[row][col] !== 0) {
            return;
        }

        // 保存原始的候選數字集合（還原用）
        const originalCandidates = new Set(candidates[row][col]);

        userInput[row][col] = num;
        candidates[row][col].clear();

        // 驗證輸入是否正確
        if (!validateInput(row, col, num)) {
            // 錯誤：整個方框閃紅色，計數器 +1，然後自動還原
            state.errorCount++;
            updateErrorDisplay();

            // 讓整個方框閃紅色
            gridContainer.style.backgroundColor = '#ff6b6b';
            gridContainer.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.8)';

            // 自動還原上一步（移除這次的輸入，恢復候選數字）
            setTimeout(() => {
                userInput[row][col] = 0;
                candidates[row][col] = originalCandidates;
                updateCellDisplay(row, col);
                updateHighlights();
                updateButtonStates();
                updateCandidateButtonStyles(row, col); // 更新候選按鈕樣式
                // 清除紅色背景
                gridContainer.style.backgroundColor = '';
                gridContainer.style.boxShadow = '';
                saveGame();
            }, 800);
            return;
        }

        // 正確：移除所有提示邊框和相關提示（輸入正確數值時）
        document.querySelectorAll('.cell.hint-border').forEach(c => c.classList.remove('hint-border'));
        document.querySelectorAll('.cell.hint-related').forEach(c => c.classList.remove('hint-related'));

        // 自動移除同列/同行的候選數字
        removeRelatedCandidates(row, col, num);
        updateCellDisplay(row, col);
        updateHighlights();
        updateButtonStates(); // 檢查是否有數字已完成

        // 清除候選按鈕的高亮（因為該格子已有值，不再有候選數字）
        updateCandidateButtonStyles(row, col);

        saveGame();

        checkCompletion();
    }
}

function getSelectedDifficulty() {
    const key = state.currentDifficulty && DIFFICULTIES[state.currentDifficulty] ? state.currentDifficulty : 'intro';
    return DIFFICULTIES[key].removals;
}

// 檢查遊戲是否完成（所有空白格都已填完）
function isGameComplete() {
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            // 如果有空白位置或輸入與解不符，遊戲未完成
            if (userInput[r][c] !== grid[r][c]) {
                return false;
            }
        }
    }
    return true;
}

// 集中處理完成檢查，避免漏掉提示自動填入等情境
function checkCompletion() {
    if (state.gameOver) return;
    if (isGameComplete()) {
        state.gameOver = true;
        setTimeout(() => showGameCompleteDialog(), 500);
    }
}

// 顯示遊戲結束對話框（失敗）
function showGameOverDialog() {
    stopTimer();

    const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const message = i18n.t('gameOverMessage', timeStr, state.hintsUsed, 3);
    if (confirm(message)) {
        generateNewSudoku(getSelectedDifficulty());
    } else {
        // User cancelled, keep game over state and timer stopped
        state.gameOver = true;
    }
}

// 顯示遊戲完成對話框（成功）
function showGameCompleteDialog() {
    stopTimer();

    const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const message = i18n.t('gameCompleteMessage', timeStr, state.hintsUsed, state.errorCount);
    if (confirm(message)) {
        generateNewSudoku(getSelectedDifficulty());
    } else {
        // User cancelled, keep game over state and timer stopped
        state.gameOver = true;
    }
}

// 檢查某個數字是否已由玩家填完（只計算玩家需要輸入的部分）
// 邏輯：計算該數字在謎題中缺少的個數，若玩家已全部輸入則為完成
function isNumberComplete(num) {
    let playerCompleted = 0; // 玩家已正確輸入該數字的個數
    let needsToFill = 0; // 玩家還需要輸入該數字的個數

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            // 如果完整解中該位置是 num，則玩家需要在此處輸入（或已輸入）
            if (grid[r][c] === num) {
                if (userInput[r][c] === num) {
                    // 玩家已正確輸入
                    playerCompleted++;
                } else if (userInput[r][c] === 0) {
                    // 玩家還未輸入
                    needsToFill++;
                }
            }
        }
    }

    // 該數字完成的條件：玩家已輸入所有需要的該數字，且沒有還需要填的
    return needsToFill === 0 && playerCompleted > 0;
}

// 更新按鈕的 disabled 狀態
function updateButtonStates() {
    for (let num = 1; num <= 9; num++) {
        const isComplete = isNumberComplete(num);
        // 答案按鈕
        const answerBtn = document.querySelector(`.answer-btn[data-num="${num}"]`);
        if (answerBtn) answerBtn.disabled = isComplete;
        // 候選按鈕
        const candidateBtn = document.querySelector(`.candidate-btn[data-num="${num}"]`);
        if (candidateBtn) candidateBtn.disabled = isComplete;
    }
}

// 計時器函數
function startTimer(initialElapsedSeconds = 0) {
    stopTimer();
    const elapsedMs = initialElapsedSeconds * 1000;
    // gameStartTime 往前推算，確保重載時計時器能延續原本累積時間
    state.gameStartTime = Date.now() - elapsedMs - state.totalPausedTime;
    state.timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// 更新提示計數器並禁用提示按鈕
function updateHintCounter() {
    state.hintsUsed++;
    if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
    if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
}

// 從 template 建立暫停菜單
function createPauseOverlay() {
    const template = document.getElementById('pause-menu-template');
    const element = template.content.cloneNode(true).firstElementChild;
    updatePauseOverlayText(element);
    return element;
}

// 更新暫停菜單文字為當前語言
function updatePauseOverlayText(element) {
    element.querySelectorAll('[data-i18n-text]').forEach(el => {
        const key = el.dataset.i18nText;
        el.textContent = i18n.t(key);
    });
}

// 為暫停菜單設定事件監聽
function setupPauseOverlayEvents(overlay) {
    overlay.querySelector('.resume-btn').addEventListener('click', resumeGame);
    overlay.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            setDifficulty(level);
            resumeGame();
            generateNewSudoku(DIFFICULTIES[level].removals);
        });
    });
}

function pauseGame(allowFromGameOver = false) {
    if (state.isPaused || (state.gameOver && !allowFromGameOver)) return;
    state.isPaused = true;
    state.pauseStartTime = Date.now();

    state.pauseOverlay = createPauseOverlay();
    document.body.appendChild(state.pauseOverlay);
    setupPauseOverlayEvents(state.pauseOverlay);

    saveGame();
}

function resumeGame() {
    if (!state.isPaused) return;
    state.totalPausedTime += (Date.now() - state.pauseStartTime);
    state.isPaused = false;
    state.pauseStartTime = null;
    if (state.pauseOverlay) {
        state.pauseOverlay.remove();
        state.pauseOverlay = null;
    }
    updateTimer();
    saveGame();
}

function updateTimer() {
    if (!state.gameStartTime || !timerSpan) return;
    const currentPausedTime = state.isPaused ? (Date.now() - state.pauseStartTime) : 0;
    const elapsed = Math.floor((Date.now() - state.gameStartTime - state.totalPausedTime - currentPausedTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerSpan.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;

    // 每 10 秒自動儲存一次，避免空轉時進度未寫入
    if (elapsed !== lastSavedElapsed && elapsed % 10 === 0) {
        saveGame();
        lastSavedElapsed = elapsed;
    }
}

// --- 儲存 / 載入遊戲進度 ---
function serializeCandidates() {
    return candidates.map(row => row.map(set => Array.from(set)));
}

function hydrateCandidates(raw) {
    candidates = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => new Set(Array.isArray(raw?.[r]?.[c]) ? raw[r][c] : [])));
}

function saveGame() {
    try {
        const currentPausedTime = (state.isPaused && state.pauseStartTime) ? (Date.now() - state.pauseStartTime) : 0;
        const data = {
            version: 1,
            timestamp: Date.now(),
            grid,
            puzzle: currentPuzzle,
            userInput,
            candidates: serializeCandidates(),
            errorCount: state.errorCount,
            hintsUsed: state.hintsUsed,
            hintCells: Array.from(state.hintCells),
            gameOver: state.gameOver,
            elapsedSeconds: state.gameStartTime ? Math.floor((Date.now() - state.gameStartTime - state.totalPausedTime - currentPausedTime) / 1000) : 0,
            totalPausedTime: state.totalPausedTime + currentPausedTime,
            isPaused: state.isPaused
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
        console.warn(i18n.t('saveFailed'), err);
    }
}

function clearSavedGame() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.warn(i18n.t('loadFailed'), err);
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.version !== 1) return false;
        if (!Array.isArray(data.puzzle) || data.puzzle.length !== N) return false;
        if (!Array.isArray(data.grid) || data.grid.length !== N) return false;
        if (!Array.isArray(data.userInput) || data.userInput.length !== N) return false;

        const savedUserInput = data.userInput.map(row => [...row]);
        const savedCandidates = data.candidates;

        currentPuzzle = data.puzzle.map(row => [...row]);
        grid = data.grid.map(row => [...row]);

        renderGrid(currentPuzzle);
        state.selectedCell = null;

        // 還原使用者輸入與候選數字
        userInput = savedUserInput.map(row => [...row]);
        hydrateCandidates(savedCandidates);
        updateAllCandidatesDisplay();
        updateButtonStates();

        // 恢復狀態
        state.errorCount = data.errorCount || 0;
        state.hintsUsed = data.hintsUsed || 0;
        state.hintCells = new Set(data.hintCells || []);
        state.gameOver = !!data.gameOver;
        state.isPaused = !!data.isPaused;
        state.pauseStartTime = state.isPaused ? Date.now() : null;
        state.totalPausedTime = data.totalPausedTime || 0;
        updateErrorDisplay();
        if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
        if (hintBtn) hintBtn.disabled = state.hintsUsed >= 3;

        // 重啟計時器（以保存的 elapsedSeconds 為基準）
        const elapsedSeconds = data.elapsedSeconds || 0;
        lastSavedElapsed = elapsedSeconds;
        startTimer(elapsedSeconds);

        // 若載入時處於暫停狀態，重建暫停遮罩但不重複儲存
        if (state.isPaused) {
            state.pauseOverlay = createPauseOverlay();
            document.body.appendChild(state.pauseOverlay);
            setupPauseOverlayEvents(state.pauseOverlay);
        }

        return true;
    } catch (err) {
        console.warn(i18n.t('loadFailed'), err);
        return false;
    }
}

// 非同步生成，讓 UI 可以更新狀態提示（始終使用唯一解檢查）
async function generateNewSudoku(difficulty = getSelectedDifficulty()) {
    try {
        // 重置遊戲狀態（允許重新開始）
        state.gameOver = false;

        // 顯示全螢幕讀條
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-bar"><div class="loading-progress"></div></div>';
        document.body.appendChild(overlay);

        // 讓瀏覽器有機會更新 UI
        await new Promise(resolve => setTimeout(resolve, 20));

        // 清除舊進度並初始化資料
        clearSavedGame();
        grid = Array.from({ length: N }, () => Array(N).fill(0));
        userInput = Array.from({ length: N }, () => Array(N).fill(0));
        candidates = Array.from({ length: N }, () => Array(N).fill(null).map(() => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])));
        fillGrid(0, 0);

        // 建立謎題（始終檢查唯一解）
        const puzzle = createPuzzle(difficulty, true);
        currentPuzzle = puzzle.map(row => [...row]);

        renderGrid(puzzle);
        // 不在遊戲初始化時填充候選數字，只在玩家點選"自動填入"按鈕時才填充
        updateButtonStates(); // 重置按鈕狀態

        // 初始化遊戲狀態
        state.errorCount = 0;
        state.gameOver = false;
        state.hintsUsed = 0;
        state.hintCells.clear();
        state.isPaused = false;
        state.pauseStartTime = null;
        state.totalPausedTime = 0;
        lastSavedElapsed = null;
        if (state.pauseOverlay) {
            state.pauseOverlay.remove();
            state.pauseOverlay = null;
        }
        updateErrorDisplay();

        // 更新提示按鈕
        if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
        if (hintBtn) hintBtn.disabled = false;

        // 啟動計時器
        startTimer();

        // 初始狀態即刻儲存
        saveGame();
    } finally {
        // 移除全螢幕讀條
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.remove();

        if (statusSpan) statusSpan.textContent = '';
    }
}

// 根據 puzzle 初始化候選數字：先全填 1~9，再移除同行、同列、同區塊已有的數字
function initializeCandidates(puzzle) {
    for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
            if (puzzle[row][col] !== 0) {
                // 給定格子，不需要候選數字
                candidates[row][col].clear();
            } else {
                // 空格：先初始化為 1~9
                candidates[row][col] = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

                // 移除同行已有的數字
                for (let c = 0; c < N; c++) {
                    if (puzzle[row][c] !== 0) {
                        candidates[row][col].delete(puzzle[row][c]);
                    }
                }
                // 移除同列已有的數字
                for (let r = 0; r < N; r++) {
                    if (puzzle[r][col] !== 0) {
                        candidates[row][col].delete(puzzle[r][col]);
                    }
                }
                // 移除同 3x3 區塊已有的數字
                const blockRow = Math.floor(row / 3) * 3;
                const blockCol = Math.floor(col / 3) * 3;
                for (let r = blockRow; r < blockRow + 3; r++) {
                    for (let c = blockCol; c < blockCol + 3; c++) {
                        if (puzzle[r][c] !== 0) {
                            candidates[row][col].delete(puzzle[r][c]);
                        }
                    }
                }
            }
        }
    }
}

// 移除已填入數字的同行/同列/同區塊候選
function removeRelatedCandidates(row, col, num) {
    for (let i = 0; i < N; i++) {
        if (userInput[row][i] === 0 && candidates[row][i].delete(num)) {
            updateCellDisplay(row, i);
        }
        if (userInput[i][col] === 0 && candidates[i][col].delete(num)) {
            updateCellDisplay(i, col);
        }
    }
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;
    for (let r = blockRow; r < blockRow + 3; r++) {
        for (let c = blockCol; c < blockCol + 3; c++) {
            if (userInput[r][c] === 0 && candidates[r][c].delete(num)) {
                updateCellDisplay(r, c);
            }
        }
    }
}

// 在自動填入值後更新候選、顯示與按鈕狀態
function updateCandidatesAfterInput(row, col, num) {
    removeRelatedCandidates(row, col, num);
    updateCellDisplay(row, col);
    updateHighlights();
    updateButtonStates();
}

// 更新所有格子的候選數字顯示
function updateAllCandidatesDisplay() {
    for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
            updateCellDisplay(row, col);
        }
    }
}

// 綁定答案按鈕
document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        if (!isNaN(num)) {
            const prevMode = state.candidateMode;
            state.candidateMode = false;
            inputNumber(num);
            state.candidateMode = prevMode;
        }
    });
});

// 綁定候選按鈕
document.querySelectorAll('.candidate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        if (!isNaN(num)) {
            const prevMode = state.candidateMode;
            state.candidateMode = true;
            inputNumber(num);
            state.candidateMode = prevMode;
        }
    });
});

// 自動填入候選數字按鈕
const autoCandidatesBtn = document.getElementById('auto-candidates-btn');
if (autoCandidatesBtn) {
    autoCandidatesBtn.addEventListener('click', () => {
        // 先構建當前的 puzzle（已輸入的 + 給定的）
        const puzzle = Array.from({ length: N }, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                puzzle[r][c] = userInput[r][c];
            }
        }
        // 初始化候選數字
        initializeCandidates(puzzle);
        // 更新顯示
        updateAllCandidatesDisplay();
        saveGame();
    });
}

// 直接填入正確答案的共用函式（不消耗提示次數）
function fillCorrectAnswerDirectly(row, col, cands) {
    const correctAnswer = grid[row][col];
    userInput[row][col] = correctAnswer;

    const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        cell.textContent = correctAnswer;
        cell.classList.remove('candidate-mode');
        cell.classList.add('user-input');
        const candidateEls = cell.querySelectorAll('.candidate');
        candidateEls.forEach(el => el.remove());
    }

    updateCandidatesAfterInput(row, col, correctAnswer);

    const fallbackMsg = i18n.t('noClueHint', row + 1, col + 1, cands.join(', '), correctAnswer);
    showToast(fallbackMsg);

    checkCompletion();
    saveGame();
}

// 提示按鈕
const hintBtn = document.getElementById('hint-btn');
const hintCountSpan = document.getElementById('hint-count');
if (hintBtn) {
    hintBtn.addEventListener('click', () => {
        if (state.gameOver) return;
        if (state.hintsUsed >= 3) {
            showToast(i18n.t('hintLimitReached'));
            return;
        }

        // 移除所有舊的提示邊框和相關提示
        document.querySelectorAll('.cell.hint-border').forEach(c => c.classList.remove('hint-border'));
        document.querySelectorAll('.cell.hint-related').forEach(c => c.classList.remove('hint-related'));

        // 計算當前盤面每個空格的可能候選數字（基於數獨規則）
        const calculatedCandidates = Array.from({ length: N }, () =>
            Array.from({ length: N }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        );

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (userInput[r][c] !== 0) {
                    // 已填入的格子，沒有候選數字
                    calculatedCandidates[r][c].clear();
                } else {
                    // 空格：移除同行、同列、同區塊已有的數字
                    for (let i = 0; i < N; i++) {
                        if (userInput[r][i] !== 0) {
                            calculatedCandidates[r][c].delete(userInput[r][i]);
                        }
                        if (userInput[i][c] !== 0) {
                            calculatedCandidates[r][c].delete(userInput[i][c]);
                        }
                    }
                    const blockRow = Math.floor(r / 3) * 3;
                    const blockCol = Math.floor(c / 3) * 3;
                    for (let br = blockRow; br < blockRow + 3; br++) {
                        for (let bc = blockCol; bc < blockCol + 3; bc++) {
                            if (userInput[br][bc] !== 0) {
                                calculatedCandidates[r][c].delete(userInput[br][bc]);
                            }
                        }
                    }
                }
            }
        }

        // 策略 1: Naked Single - 找出只有一個候選數字的格子
        const nakedSingleCells = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                // 排除系統預填（given）格
                const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (userInput[r][c] === 0 && calculatedCandidates[r][c].size === 1 && cellEl && !cellEl.classList.contains('given')) {
                    nakedSingleCells.push({ row: r, col: c });
                }
            }
        }

        if (nakedSingleCells.length > 0) {
            // 隨機選擇一個 Naked Single
            const randomCell = nakedSingleCells[Math.floor(Math.random() * nakedSingleCells.length)];
            const { row, col } = randomCell;
            const onlyCandidate = Array.from(calculatedCandidates[row][col])[0];

            const nakedMsg = i18n.t('nakedSingleHint', row + 1, col + 1, onlyCandidate);
            showToast(nakedMsg);

            state.hintCells.add(`${row}-${col}`);

            // 先添加樣式再 selectCell
            const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('hint-border');
            }
            selectCell(row, col, true);
            state.hintsUsed++;
            if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
            if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
            saveGame();
            return;
        }

        // 策略 2: Hidden Single - 某數字在某行/列/區塊只能填在一個位置
        const hiddenSingleCells = [];

        // 檢查每一行
        for (let row = 0; row < N; row++) {
            for (let num = 1; num <= 9; num++) {
                const possibleCols = [];
                for (let col = 0; col < N; col++) {
                    if (userInput[row][col] === 0 && calculatedCandidates[row][col].has(num)) {
                        possibleCols.push(col);
                    }
                }
                if (possibleCols.length === 1) {
                    hiddenSingleCells.push({ row: row, col: possibleCols[0], num: num, type: 'row' });
                }
            }
        }

        // 檢查每一列
        for (let col = 0; col < N; col++) {
            for (let num = 1; num <= 9; num++) {
                const possibleRows = [];
                for (let row = 0; row < N; row++) {
                    if (userInput[row][col] === 0 && calculatedCandidates[row][col].has(num)) {
                        possibleRows.push(row);
                    }
                }
                if (possibleRows.length === 1) {
                    hiddenSingleCells.push({ row: possibleRows[0], col: col, num: num, type: 'col' });
                }
            }
        }

        // 檢查每個 3x3 區塊
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                for (let num = 1; num <= 9; num++) {
                    const possibleCells = [];
                    for (let r = blockRow * 3; r < blockRow * 3 + 3; r++) {
                        for (let c = blockCol * 3; c < blockCol * 3 + 3; c++) {
                            if (userInput[r][c] === 0 && calculatedCandidates[r][c].has(num)) {
                                possibleCells.push({ row: r, col: c });
                            }
                        }
                    }
                    if (possibleCells.length === 1) {
                        hiddenSingleCells.push({ ...possibleCells[0], num: num, type: 'box' });
                    }
                }
            }
        }

        if (hiddenSingleCells.length > 0) {
            // 策略 2: Naked Pair
            // 在每一行、每一列、每個區塊尋找 Naked Pair
            function findNakedPairOrTriple(type = 2) {
                // type=2: Naked Pair, type=3: Naked Triple
                // 回傳 {cells: [{row, col}], nums: Set, region: 'row'|'col'|'box', regionIdx: number}
                // 1. 行
                for (let row = 0; row < N; row++) {
                    const cells = [];
                    for (let col = 0; col < N; col++) {
                        const cellEl = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (userInput[row][col] === 0 && cellEl && !cellEl.classList.contains('given')) {
                            cells.push({ row, col, cand: calculatedCandidates[row][col] });
                        }
                    }
                    // 找出所有 type 個候選數字的格子
                    const targetCells = cells.filter(c => c.cand.size === type);
                    // 檢查是否有 type 格子候選集合完全相同
                    for (let i = 0; i < targetCells.length; i++) {
                        for (let j = i + 1; j < targetCells.length; j++) {
                            if (type === 2 && i === j) continue;
                            if (type === 3 && (j + 1 >= targetCells.length)) continue;
                            let group = [targetCells[i]];
                            if (type === 2) group.push(targetCells[j]);
                            if (type === 3) group = [targetCells[i], targetCells[j], targetCells[j + 1]];
                            const allSame = group.every(c => eqSet(c.cand, group[0].cand));
                            if (allSame) {
                                // 檢查這 type 個候選數字在本行其他格是否出現
                                const nums = group[0].cand;
                                let canEliminate = false;
                                for (const c of cells) {
                                    if (!group.includes(c)) {
                                        // 檢查該格實際顯示的候選數字（使用者手動輸入的）
                                        const cellEl = gridContainer.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`);
                                        const actualCandidates = new Set();
                                        if (cellEl) {
                                            const candidateEls = cellEl.querySelectorAll('.candidate');
                                            candidateEls.forEach(el => {
                                                const num = parseInt(el.textContent);
                                                if (!isNaN(num)) actualCandidates.add(num);
                                            });
                                        }
                                        for (const n of nums) {
                                            if (actualCandidates.has(n)) canEliminate = true;
                                        }
                                    }
                                }
                                if (canEliminate) {
                                    return { cells: group.map(c => ({ row: c.row, col: c.col })), nums, region: 'row', regionIdx: row };
                                }
                            }
                        }
                    }
                }
                // 2. 列
                for (let col = 0; col < N; col++) {
                    const cells = [];
                    for (let row = 0; row < N; row++) {
                        const cellEl = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (userInput[row][col] === 0 && cellEl && !cellEl.classList.contains('given')) {
                            cells.push({ row, col, cand: calculatedCandidates[row][col] });
                        }
                    }
                    const targetCells = cells.filter(c => c.cand.size === type);
                    for (let i = 0; i < targetCells.length; i++) {
                        for (let j = i + 1; j < targetCells.length; j++) {
                            if (type === 2 && i === j) continue;
                            if (type === 3 && (j + 1 >= targetCells.length)) continue;
                            let group = [targetCells[i]];
                            if (type === 2) group.push(targetCells[j]);
                            if (type === 3) group = [targetCells[i], targetCells[j], targetCells[j + 1]];
                            const allSame = group.every(c => eqSet(c.cand, group[0].cand));
                            if (allSame) {
                                const nums = group[0].cand;
                                let canEliminate = false;
                                for (const c of cells) {
                                    if (!group.includes(c)) {
                                        // 檢查該格實際顯示的候選數字（使用者手動輸入的）
                                        const cellEl = gridContainer.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`);
                                        const actualCandidates = new Set();
                                        if (cellEl) {
                                            const candidateEls = cellEl.querySelectorAll('.candidate');
                                            candidateEls.forEach(el => {
                                                const num = parseInt(el.textContent);
                                                if (!isNaN(num)) actualCandidates.add(num);
                                            });
                                        }
                                        for (const n of nums) {
                                            if (actualCandidates.has(n)) canEliminate = true;
                                        }
                                    }
                                }
                                if (canEliminate) {
                                    return { cells: group.map(c => ({ row: c.row, col: c.col })), nums, region: 'col', regionIdx: col };
                                }
                            }
                        }
                    }
                }
                // 3. 區塊
                for (let br = 0; br < 3; br++) {
                    for (let bc = 0; bc < 3; bc++) {
                        const cells = [];
                        for (let r = br * 3; r < br * 3 + 3; r++) {
                            for (let c = bc * 3; c < bc * 3 + 3; c++) {
                                const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                if (userInput[r][c] === 0 && cellEl && !cellEl.classList.contains('given')) {
                                    cells.push({ row: r, col: c, cand: calculatedCandidates[r][c] });
                                }
                            }
                        }
                        const targetCells = cells.filter(c => c.cand.size === type);
                        for (let i = 0; i < targetCells.length; i++) {
                            for (let j = i + 1; j < targetCells.length; j++) {
                                if (type === 2 && i === j) continue;
                                if (type === 3 && (j + 1 >= targetCells.length)) continue;
                                let group = [targetCells[i]];
                                if (type === 2) group.push(targetCells[j]);
                                if (type === 3) group = [targetCells[i], targetCells[j], targetCells[j + 1]];
                                const allSame = group.every(c => eqSet(c.cand, group[0].cand));
                                if (allSame) {
                                    const nums = group[0].cand;
                                    let canEliminate = false;
                                    for (const c of cells) {
                                        if (!group.includes(c)) {
                                            // 檢查該格實際顯示的候選數字（使用者手動輸入的）
                                            const cellEl = gridContainer.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`);
                                            const actualCandidates = new Set();
                                            if (cellEl) {
                                                const candidateEls = cellEl.querySelectorAll('.candidate');
                                                candidateEls.forEach(el => {
                                                    const num = parseInt(el.textContent);
                                                    if (!isNaN(num)) actualCandidates.add(num);
                                                });
                                            }
                                            for (const n of nums) {
                                                if (actualCandidates.has(n)) canEliminate = true;
                                            }
                                        }
                                    }
                                    if (canEliminate) {
                                        return { cells: group.map(c => ({ row: c.row, col: c.col })), nums, region: 'box', regionIdx: br * 3 + bc };
                                    }
                                }
                            }
                        }
                    }
                }
                return null;
            }

            // Naked Pair
            function eqSet(a, b) {
                if (a.size !== b.size) return false;
                for (const v of a) if (!b.has(v)) return false;
                return true;
            }
            const nakedPair = findNakedPairOrTriple(2);
            if (nakedPair) {
                // 標示這兩格
                for (const { row, col } of nakedPair.cells) {
                    const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) cell.classList.add('hint-border');
                }
                // 標示同區域其他可被刪除的格子
                let relatedCells = [];
                if (nakedPair.region === 'row') {
                    for (let c = 0; c < N; c++) {
                        if (!nakedPair.cells.some(cell => cell.row === nakedPair.regionIdx && cell.col === c)) {
                            const cell = gridContainer.querySelector(`[data-row="${nakedPair.regionIdx}"][data-col="${c}"]`);
                            if (cell) relatedCells.push(cell);
                        }
                    }
                } else if (nakedPair.region === 'col') {
                    for (let r = 0; r < N; r++) {
                        if (!nakedPair.cells.some(cell => cell.col === nakedPair.regionIdx && cell.row === r)) {
                            const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${nakedPair.regionIdx}"]`);
                            if (cell) relatedCells.push(cell);
                        }
                    }
                } else if (nakedPair.region === 'box') {
                    const br = Math.floor(nakedPair.regionIdx / 3);
                    const bc = nakedPair.regionIdx % 3;
                    for (let r = br * 3; r < br * 3 + 3; r++) {
                        for (let c = bc * 3; c < bc * 3 + 3; c++) {
                            if (!nakedPair.cells.some(cell => cell.row === r && cell.col === c)) {
                                const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                if (cell) relatedCells.push(cell);
                            }
                        }
                    }
                }
                relatedCells.forEach(cell => cell.classList.add('hint-related'));
                const regionNameMap = { row: i18n.t('row'), col: i18n.t('col'), box: i18n.t('box') };
                const regionName = regionNameMap[nakedPair.region];
                const regionDisplay = nakedPair.region === 'row' ? `${regionName}${nakedPair.regionIdx + 1}` :
                    nakedPair.region === 'col' ? `${regionName}${nakedPair.regionIdx + 1}` :
                        `${regionName}${Math.floor(nakedPair.regionIdx / 3) + 1}`;
                const nakedPairMsg = i18n.t('nakedPairHint', regionName, nakedPair.regionIdx + (nakedPair.region === 'box' ? Math.floor(nakedPair.regionIdx / 3) * 3 : 1), Array.from(nakedPair.nums).join(', '));
                showToast(nakedPairMsg);
                // select 第一格
                selectCell(nakedPair.cells[0].row, nakedPair.cells[0].col, true);
                state.hintsUsed++;
                if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                saveGame();
                return;
            }
            // Naked Triple
            const nakedTriple = findNakedPairOrTriple(3);
            if (nakedTriple) {
                for (const { row, col } of nakedTriple.cells) {
                    const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) cell.classList.add('hint-border');
                }
                let relatedCells = [];
                if (nakedTriple.region === 'row') {
                    for (let c = 0; c < N; c++) {
                        if (!nakedTriple.cells.some(cell => cell.row === nakedTriple.regionIdx && cell.col === c)) {
                            const cell = gridContainer.querySelector(`[data-row="${nakedTriple.regionIdx}"][data-col="${c}"]`);
                            if (cell) relatedCells.push(cell);
                        }
                    }
                } else if (nakedTriple.region === 'col') {
                    for (let r = 0; r < N; r++) {
                        if (!nakedTriple.cells.some(cell => cell.col === nakedTriple.regionIdx && cell.row === r)) {
                            const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${nakedTriple.regionIdx}"]`);
                            if (cell) relatedCells.push(cell);
                        }
                    }
                } else if (nakedTriple.region === 'box') {
                    const br = Math.floor(nakedTriple.regionIdx / 3);
                    const bc = nakedTriple.regionIdx % 3;
                    for (let r = br * 3; r < br * 3 + 3; r++) {
                        for (let c = bc * 3; c < bc * 3 + 3; c++) {
                            if (!nakedTriple.cells.some(cell => cell.row === r && cell.col === c)) {
                                const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                if (cell) relatedCells.push(cell);
                            }
                        }
                    }
                }
                relatedCells.forEach(cell => cell.classList.add('hint-related'));
                const regionNameMap = { row: i18n.t('row'), col: i18n.t('col'), box: i18n.t('box') };
                const regionName = regionNameMap[nakedTriple.region];
                const nakedTripleMsg = i18n.t('nakedTripleHint', regionName, nakedTriple.regionIdx + (nakedTriple.region === 'box' ? Math.floor(nakedTriple.regionIdx / 3) * 3 : 1), Array.from(nakedTriple.nums).join(', '));
                showToast(nakedTripleMsg);
                selectCell(nakedTriple.cells[0].row, nakedTriple.cells[0].col, true);
                state.hintsUsed++;
                if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                saveGame();
                return;
            }

            // 策略 3: Pointing (Box-Line Reduction)
            // 對每個區塊，檢查某數字只出現在同一行或同一列
            for (let num = 1; num <= 9; num++) {
                for (let br = 0; br < 3; br++) {
                    for (let bc = 0; bc < 3; bc++) {
                        let positions = [];
                        for (let r = br * 3; r < br * 3 + 3; r++) {
                            for (let c = bc * 3; c < bc * 3 + 3; c++) {
                                const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                if (userInput[r][c] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[r][c].has(num)) {
                                    positions.push({ row: r, col: c });
                                }
                            }
                        }
                        if (positions.length > 1 && positions.length <= 3) {
                            // 檢查是否都在同一行
                            const allRow = positions.every(p => p.row === positions[0].row);
                            const allCol = positions.every(p => p.col === positions[0].col);
                            if (allRow) {
                                // 檢查是否真的有候選數字可以刪除（有效性檢查）
                                let canEliminate = false;
                                for (let c = 0; c < N; c++) {
                                    if (c < bc * 3 || c >= bc * 3 + 3) {
                                        const cellEl = gridContainer.querySelector(`[data-row="${positions[0].row}"][data-col="${c}"]`);
                                        if (userInput[positions[0].row][c] === 0 && cellEl && !cellEl.classList.contains('given')) {
                                            // 檢查該格實際顯示的候選數字
                                            const candidateEls = cellEl.querySelectorAll('.candidate');
                                            for (const el of candidateEls) {
                                                if (parseInt(el.textContent) === num) {
                                                    canEliminate = true;
                                                    break;
                                                }
                                            }
                                            if (canEliminate) break;
                                        }
                                    }
                                }
                                if (canEliminate) {
                                    // 標示區塊內這些格
                                    positions.forEach(p => {
                                        const cell = gridContainer.querySelector(`[data-row="${p.row}"][data-col="${p.col}"]`);
                                        if (cell) cell.classList.add('hint-border');
                                    });
                                    // 標示同一行但不在本區塊的格
                                    let relatedCells = [];
                                    for (let c = 0; c < N; c++) {
                                        if (c < bc * 3 || c >= bc * 3 + 3) {
                                            const cell = gridContainer.querySelector(`[data-row="${positions[0].row}"][data-col="${c}"]`);
                                            if (cell && userInput[positions[0].row][c] === 0 && calculatedCandidates[positions[0].row][c].has(num)) {
                                                relatedCells.push(cell);
                                            }
                                        }
                                    }
                                    relatedCells.forEach(cell => cell.classList.add('hint-related'));
                                    const lineType = i18n.t('row');
                                    const pointingMsg = i18n.t('pointingHint', num, br * 3 + bc + 1, positions[0].row + 1, lineType);
                                    showToast(pointingMsg);
                                    selectCell(positions[0].row, positions[0].col, true);
                                    state.hintsUsed++;
                                    if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                                    if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                                    saveGame();
                                    return;
                                }
                            } else if (allCol) {
                                // 檢查是否真的有候選數字可以刪除（有效性檢查）
                                let canEliminate = false;
                                for (let r = 0; r < N; r++) {
                                    if (r < br * 3 || r >= br * 3 + 3) {
                                        const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${positions[0].col}"]`);
                                        if (userInput[r][positions[0].col] === 0 && cellEl && !cellEl.classList.contains('given')) {
                                            // 檢查該格實際顯示的候選數字
                                            const candidateEls = cellEl.querySelectorAll('.candidate');
                                            for (const el of candidateEls) {
                                                if (parseInt(el.textContent) === num) {
                                                    canEliminate = true;
                                                    break;
                                                }
                                            }
                                            if (canEliminate) break;
                                        }
                                    }
                                }
                                if (canEliminate) {
                                    positions.forEach(p => {
                                        const cell = gridContainer.querySelector(`[data-row="${p.row}"][data-col="${p.col}"]`);
                                        if (cell) cell.classList.add('hint-border');
                                    });
                                    let relatedCells = [];
                                    for (let r = 0; r < N; r++) {
                                        if (r < br * 3 || r >= br * 3 + 3) {
                                            const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${positions[0].col}"]`);
                                            if (cell && userInput[r][positions[0].col] === 0 && calculatedCandidates[r][positions[0].col].has(num)) {
                                                relatedCells.push(cell);
                                            }
                                        }
                                    }
                                    relatedCells.forEach(cell => cell.classList.add('hint-related'));
                                    const lineType = i18n.t('col');
                                    const pointingMsg = i18n.t('pointingHint', num, br * 3 + bc + 1, positions[0].col + 1, lineType);
                                    showToast(pointingMsg);
                                    selectCell(positions[0].row, positions[0].col, true);
                                    state.hintsUsed++;
                                    if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                                    if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                                    saveGame();
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            // 策略 3b: Claiming (Line -> Box Reduction)
            // 若某行/列的某數字候選只出現在同一個 3x3 區塊內，則可刪除該區塊其他格的該候選
            for (let num = 1; num <= 9; num++) {
                // 行方向
                for (let row = 0; row < N; row++) {
                    const positions = [];
                    for (let col = 0; col < N; col++) {
                        const cellEl = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (userInput[row][col] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[row][col].has(num)) {
                            positions.push({ row, col });
                        }
                    }
                    if (positions.length >= 2 && positions.length <= 4) {
                        const boxIdx = Math.floor(positions[0].row / 3) * 3 + Math.floor(positions[0].col / 3);
                        const sameBox = positions.every(p => (Math.floor(p.row / 3) * 3 + Math.floor(p.col / 3)) === boxIdx);
                        if (sameBox) {
                            const br = Math.floor(boxIdx / 3);
                            const bc = boxIdx % 3;
                            let related = [];
                            for (let r = br * 3; r < br * 3 + 3; r++) {
                                for (let c = bc * 3; c < bc * 3 + 3; c++) {
                                    const isInLine = (r === row);
                                    const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                    // 必須實際存在該候選且目前未填，避免浪費提示
                                    if (!isInLine && userInput[r][c] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[r][c].has(num)) {
                                        related.push(cellEl);
                                    }
                                }
                            }
                            if (related.length > 0) {
                                positions.forEach(({ row: r, col: c }) => {
                                    const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                    if (cell) cell.classList.add('hint-border');
                                });
                                related.forEach(cell => cell.classList.add('hint-related'));
                                const lineType = i18n.t('row');
                                const claimingMsg = i18n.t('claimingHint', num, row + 1, lineType);
                                showToast(claimingMsg);
                                selectCell(positions[0].row, positions[0].col, true);
                                state.hintsUsed++;
                                if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                                if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                                saveGame();
                                return;
                            }
                        }
                    }
                }

                // 列方向
                for (let col = 0; col < N; col++) {
                    const positions = [];
                    for (let row = 0; row < N; row++) {
                        const cellEl = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                        if (userInput[row][col] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[row][col].has(num)) {
                            positions.push({ row, col });
                        }
                    }
                    if (positions.length >= 2 && positions.length <= 4) {
                        const boxIdx = Math.floor(positions[0].row / 3) * 3 + Math.floor(positions[0].col / 3);
                        const sameBox = positions.every(p => (Math.floor(p.row / 3) * 3 + Math.floor(p.col / 3)) === boxIdx);
                        if (sameBox) {
                            const br = Math.floor(boxIdx / 3);
                            const bc = boxIdx % 3;
                            let related = [];
                            for (let r = br * 3; r < br * 3 + 3; r++) {
                                for (let c = bc * 3; c < bc * 3 + 3; c++) {
                                    const isInLine = (c === col);
                                    const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                    // 必須實際存在該候選且目前未填，避免浪費提示
                                    if (!isInLine && userInput[r][c] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[r][c].has(num)) {
                                        related.push(cellEl);
                                    }
                                }
                            }
                            if (related.length > 0) {
                                positions.forEach(({ row: r, col: c }) => {
                                    const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                    if (cell) cell.classList.add('hint-border');
                                });
                                related.forEach(cell => cell.classList.add('hint-related'));
                                const lineType = i18n.t('col');
                                const claimingMsg = i18n.t('claimingHint', num, col + 1, lineType);
                                showToast(claimingMsg);
                                selectCell(positions[0].row, positions[0].col, true);
                                state.hintsUsed++;
                                if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                                if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                                saveGame();
                                return;
                            }
                        }
                    }
                }
            }
            // 去重（可能同一格被多次找到）
            const uniqueCells = [];
            const seen = new Set();
            for (const cell of hiddenSingleCells) {
                const key = `${cell.row}-${cell.col}`;
                // 排除系統預填（given）格
                const cellEl = gridContainer.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
                if (!seen.has(key) && cellEl && !cellEl.classList.contains('given')) {
                    seen.add(key);
                    uniqueCells.push(cell);
                }
            }
            // 隨機選擇一個 Hidden Single
            const randomCell = uniqueCells[Math.floor(Math.random() * uniqueCells.length)];
            const { row, col, num, type } = randomCell;

            const regionType = type === 'row' ? i18n.t('row') : type === 'col' ? i18n.t('col') : i18n.t('box');
            const hiddenMsg = i18n.t('hiddenSingleHint', row + 1, col + 1, num, regionType, 0);
            showToast(hiddenMsg);

            state.hintCells.add(`${row}-${col}`);

            // 主要提示格子
            const mainCell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (mainCell) {
                mainCell.classList.add('hint-border');
            }

            // 標示相關格子（淡黃色背景）
            if (type === 'row') {
                // 同行所有格子
                for (let c = 0; c < N; c++) {
                    if (c !== col) {
                        const relatedCell = gridContainer.querySelector(`[data-row="${row}"][data-col="${c}"]`);
                        if (relatedCell) relatedCell.classList.add('hint-related');
                    }
                }
            } else if (type === 'col') {
                // 同列所有格子
                for (let r = 0; r < N; r++) {
                    if (r !== row) {
                        const relatedCell = gridContainer.querySelector(`[data-row="${r}"][data-col="${col}"]`);
                        if (relatedCell) relatedCell.classList.add('hint-related');
                    }
                }
            } else if (type === 'box') {
                // 同區塊所有格子
                const boxRow = Math.floor(row / 3) * 3;
                const boxCol = Math.floor(col / 3) * 3;
                for (let r = boxRow; r < boxRow + 3; r++) {
                    for (let c = boxCol; c < boxCol + 3; c++) {
                        if (r !== row || c !== col) {
                            const relatedCell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                            if (relatedCell) relatedCell.classList.add('hint-related');
                        }
                    }
                }
            }

            // 最後才 selectCell，並保留提示樣式
            selectCell(row, col, true);

            state.hintsUsed++;
            if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
            if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
            saveGame();
            return;
        }

        // 策略 3: X-Wing - 在兩行或兩列中，某數字只出現在相同的兩個位置
        for (let num = 1; num <= 9; num++) {
            // 檢查行中的 X-Wing
            const rowPatterns = [];
            for (let row = 0; row < N; row++) {
                const cols = [];
                for (let col = 0; col < N; col++) {
                    const cellEl = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (userInput[row][col] === 0 && cellEl && !cellEl.classList.contains('given') && calculatedCandidates[row][col].has(num)) {
                        cols.push(col);
                    }
                }
                if (cols.length === 2) {
                    rowPatterns.push({ row, cols });
                }
            }

            // 找出兩行具有相同兩列位置的模式
            for (let i = 0; i < rowPatterns.length; i++) {
                for (let j = i + 1; j < rowPatterns.length; j++) {
                    if (rowPatterns[i].cols[0] === rowPatterns[j].cols[0] &&
                        rowPatterns[i].cols[1] === rowPatterns[j].cols[1]) {
                        const col1 = rowPatterns[i].cols[0];
                        const col2 = rowPatterns[i].cols[1];
                        const row1 = rowPatterns[i].row;
                        const row2 = rowPatterns[j].row;

                        // 檢查這兩列其他行是否有該數字的候選可刪除
                        // 必須檢查實際顯示的候選（用戶手動輸入的），而非計算的理論候選
                        let canEliminate = false;
                        for (let r = 0; r < N; r++) {
                            if (r !== row1 && r !== row2) {
                                // 檢查該格是否顯示了該數字的候選（使用 candidates 而非 calculatedCandidates）
                                if ((candidates[r][col1].has(num) && userInput[r][col1] === 0) ||
                                    (candidates[r][col2].has(num) && userInput[r][col2] === 0)) {
                                    canEliminate = true;
                                    break;
                                }
                            }
                        }

                        if (canEliminate) {
                            // 標示 X-Wing 的四個格子
                            [[row1, col1], [row1, col2], [row2, col1], [row2, col2]].forEach(([r, c]) => {
                                const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                                if (cell) cell.classList.add('hint-border');
                            });

                            // 標示可刪除候選的格子（检查实际显示的候选）
                            for (let r = 0; r < N; r++) {
                                if (r !== row1 && r !== row2) {
                                    if (candidates[r][col1].has(num) && userInput[r][col1] === 0) {
                                        const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${col1}"]`);
                                        if (cell) cell.classList.add('hint-related');
                                    }
                                    if (candidates[r][col2].has(num) && userInput[r][col2] === 0) {
                                        const cell = gridContainer.querySelector(`[data-row="${r}"][data-col="${col2}"]`);
                                        if (cell) cell.classList.add('hint-related');
                                    }
                                }
                            }

                            const xWingMsg = i18n.t('xWingHint', num, row1 + 1, row2 + 1, col1 + 1, col2 + 1);
                            showToast(xWingMsg);
                            selectCell(row1, col1, true);
                            state.hintsUsed++;
                            if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                            if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                            saveGame();
                            return;
                        }
                    }
                }
            }
        }

        // 策略 4: 改進的最少候選提示 - 只提示有2個候選的格子，並給予排除建議
        let minCandidates = 10;
        const minCandidateCells = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const size = calculatedCandidates[r][c].size;
                // 排除系統預填（given）格，且只考慮2個候選的格子
                const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (userInput[r][c] === 0 && size === 2 && cellEl && !cellEl.classList.contains('given')) {
                    minCandidateCells.push({ row: r, col: c });
                }
            }
        }

        if (minCandidateCells.length > 0) {
            // 「二選一」策略：只在有明確分析線索時才提示，避免過度提示
            // 篩選出有明確分析價值的候選（即候選分佈不均或有明顯排除線索）
            const valuableMinCells = minCandidateCells.filter(({ row, col }) => {
                const candidates = Array.from(calculatedCandidates[row][col]);
                if (candidates.length !== 2) return false; // 只考慮恰好 2 個候選的格子

                const [num1, num2] = candidates;
                let value = 0;

                // 檢查行/列/區塊中是否有明顯的排除線索
                for (let c = 0; c < N; c++) {
                    if (c !== col) {
                        if (calculatedCandidates[row][c].has(num1) && !calculatedCandidates[row][c].has(num2)) value++; // num1 在其他位置更頻繁
                        if (calculatedCandidates[row][c].has(num2) && !calculatedCandidates[row][c].has(num1)) value--;
                    }
                }
                for (let r = 0; r < N; r++) {
                    if (r !== row) {
                        if (calculatedCandidates[r][col].has(num1) && !calculatedCandidates[r][col].has(num2)) value++;
                        if (calculatedCandidates[r][col].has(num2) && !calculatedCandidates[r][col].has(num1)) value--;
                    }
                }

                // 只有分佈明顯不均（|value| > 2）才認為有價值
                return Math.abs(value) > 2;
            });

            if (valuableMinCells.length > 0) {
                // 隨機選擇一個有分析價值的候選
                const randomCell = valuableMinCells[Math.floor(Math.random() * valuableMinCells.length)];
                const { row, col } = randomCell;
                const candidates = Array.from(calculatedCandidates[row][col]).sort((a, b) => a - b);

                // 提供更具體的分析建議
                let hint = i18n.t('logicElimination', row + 1, col + 1) + `${candidates[0]} 或 ${candidates[1]}\n`;

                // 分析這兩個候選在同行/列/區塊的分佈
                const num1Count = { row: 0, col: 0, box: 0 };
                const num2Count = { row: 0, col: 0, box: 0 };

                for (let c = 0; c < N; c++) {
                    if (c !== col && calculatedCandidates[row][c].has(candidates[0])) num1Count.row++;
                    if (c !== col && calculatedCandidates[row][c].has(candidates[1])) num2Count.row++;
                }
                for (let r = 0; r < N; r++) {
                    if (r !== row && calculatedCandidates[r][col].has(candidates[0])) num1Count.col++;
                    if (r !== row && calculatedCandidates[r][col].has(candidates[1])) num2Count.col++;
                }

                const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
                for (let r = br; r < br + 3; r++) {
                    for (let c = bc; c < bc + 3; c++) {
                        if ((r !== row || c !== col) && calculatedCandidates[r][c].has(candidates[0])) num1Count.box++;
                        if ((r !== row || c !== col) && calculatedCandidates[r][c].has(candidates[1])) num2Count.box++;
                    }
                }

                // 給予建議
                if (num1Count.row === 0 && num2Count.row > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[0], i18n.t('row'));
                } else if (num2Count.row === 0 && num1Count.row > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[1], i18n.t('row'));
                } else if (num1Count.col === 0 && num2Count.col > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[0], i18n.t('col'));
                } else if (num2Count.col === 0 && num1Count.col > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[1], i18n.t('col'));
                } else if (num1Count.box === 0 && num2Count.box > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[0], i18n.t('box'));
                } else if (num2Count.box === 0 && num1Count.box > 0) {
                    hint += i18n.t('eliminationAdvice', candidates[1], i18n.t('box'));
                } else {
                    // 無法判斷時，直接填入正確答案（不消耗提示次數）
                    fillCorrectAnswerDirectly(row, col, candidates);
                    return;
                }

                showToast(hint);
                state.hintCells.add(`${row}-${col}`);

                // 先添加樣式再 selectCell
                const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('hint-border');
                }
                selectCell(row, col, true);
                state.hintsUsed++;
                if (hintCountSpan) hintCountSpan.textContent = `${3 - state.hintsUsed}`;
                if (state.hintsUsed >= 3 && hintBtn) hintBtn.disabled = true;
                saveGame();
                return;
            }
        }

        // Fallback: 選一個候選數最少的可填格（排除 given）提供基本提示，降低無提示情況
        let fallback = null;
        let fallbackSize = 10;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const cellEl = gridContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (userInput[r][c] === 0 && cellEl && !cellEl.classList.contains('given')) {
                    const size = calculatedCandidates[r][c].size;
                    if (size > 0 && size < fallbackSize) {
                        fallbackSize = size;
                        fallback = { row: r, col: c, cands: Array.from(calculatedCandidates[r][c]).sort((a, b) => a - b) };
                    }
                }
            }

        }
        if (fallback) {
            const { row, col, cands } = fallback;
            fillCorrectAnswerDirectly(row, col, cands);
            return;
        }

        // 理論上不應該到這裡（除非遊戲已完成）
        showToast(i18n.t('noHintAvailable'));
    });
}

// 暫停按鈕
if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
        if (state.isPaused) {
            resumeGame();
        } else {
            // 遊戲結束後也可開啟設定菜單
            pauseGame(true);
        }
    });
}

// 監聽網頁顯示狀態，隱藏時暫停計時器
let wasAutoHidden = false;
document.addEventListener('visibilitychange', () => {
    if (state.gameOver) return;

    if (document.hidden) {
        // 網頁隱藏，記錄是否本來就是暫停狀態
        if (!state.isPaused) {
            wasAutoHidden = true;
            pauseGame();
        }
    } else {
        // 網頁顯示，如果是自動暫停則自動恢復
        if (wasAutoHidden && state.isPaused) {
            wasAutoHidden = false;
            resumeGame();
        }
    }
});

// 初始化：如有暫存進度則載入，否則生成新遊戲
if (!loadGame()) {
    generateNewSudoku(getSelectedDifficulty()).catch(err => {
        console.error(i18n.t('generateFailed'), err);
        showToast(i18n.t('loadGameFailed'));
    });
}
