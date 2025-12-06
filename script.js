// 網格尺寸
const N = 9;
// 數獨網格 (9x9)
let grid = Array.from({ length: N }, () => Array(N).fill(0));
// 使用者輸入追蹤 (9x9)
let userInput = Array.from({ length: N }, () => Array(N).fill(0));
// 候選數字追蹤 (9x9，每格是 Set)
let candidates = Array.from({ length: N }, () => Array(N).fill(null).map(() => new Set([1,2,3,4,5,6,7,8,9])));

// DOM 元素
const gridContainer = document.getElementById('sudoku-grid');
const generateBtn = document.getElementById('generate-btn');
const statusSpan = document.getElementById('status');
const errorCountSpan = document.getElementById('error-count');
const timerSpan = document.getElementById('timer');
const consoleToast = document.getElementById('console-toast');

// Toast 訊息顯示函數
let toastTimeout = null;
function showToast(message) {
    console.log(message); // 保留原本的 console.log
    
    // 清除之前的 timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // 顯示新訊息
    consoleToast.textContent = message;
    consoleToast.classList.add('show');
    
    // 3秒後消失
    toastTimeout = setTimeout(() => {
        consoleToast.classList.remove('show');
    }, 3000);
}

// 遊戲狀態
let selectedCell = null; // { row, col }
let candidateMode = false;
let errorCount = 0; // 錯誤計數器（初始為 0）
let gameOver = false; // 遊戲是否結束
let hintsUsed = 0; // 已使用的提示次數（不限制上限）
let hintCells = new Set(); // 記錄提示填入的格子
let gameStartTime = null; // 遊戲開始時間
let timerInterval = null; // 計時器 interval ID

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

    const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
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
        Array.from({ length: N }, () => new Set([1,2,3,4,5,6,7,8,9]))
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
 * @param {number} difficulty 要移除的格數
 * @param {boolean} ensureUnique 是否檢查並保證唯一解
 */
function createPuzzle(difficulty, ensureUnique = true) {
    let bestPuzzle = grid.map(row => [...row]);
    let bestScore = -99999;
    let bestRemoved = 0;
    const attempts = 15; // 增加到15次嘗試，找更難的謎題
    
    for (let attempt = 0; attempt < attempts; attempt++) {
        let currentPuzzle = grid.map(row => [...row]);
        let currentRemoved = 0;
        
        // 創建所有格子位置的陣列
        const positions = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                positions.push([r, c]);
            }
        }
        
        // 根據策略排序位置（優先移除中心和對稱位置）
        if (attempt % 2 === 0) {
            // 策略1: 從中心向外移除（保留邊角，增加難度）
            positions.sort((a, b) => {
                const distA = Math.abs(a[0] - 4) + Math.abs(a[1] - 4);
                const distB = Math.abs(b[0] - 4) + Math.abs(b[1] - 4);
                return distA - distB;
            });
        } else {
            // 策略2: 隨機打亂
            for (let i = positions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
        }

        // 按順序嘗試移除每個位置
        for (const [r, c] of positions) {
            if (currentPuzzle[r][c] === 0) continue;

            const value = currentPuzzle[r][c];
            currentPuzzle[r][c] = 0; // 暫時移除

            if (ensureUnique) {
                const solutions = countSolutions(currentPuzzle.map(row => [...row]), 2);
                if (solutions === 1) {
                    currentRemoved++;
                } else {
                    currentPuzzle[r][c] = value; // 回復
                }
            } else {
                currentRemoved++;
            }
        }
        
        // 評估難度分數
        const difficultyScore = evaluatePuzzleDifficulty(currentPuzzle);
        
        // 選擇難度分數最高的謎題（嚴格優先分數）
        if (difficultyScore > bestScore) {
            bestScore = difficultyScore;
            bestRemoved = currentRemoved;
            bestPuzzle = currentPuzzle.map(row => [...row]);
        }
    }

    console.log(`難度分數: ${bestScore}, 移除: ${bestRemoved}, 剩餘: ${81 - bestRemoved} (嘗試${attempts}次)`);
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
            }
            
            gridContainer.appendChild(cell);
        }    
    }
}

// 選擇格子
function selectCell(row, col, keepHints = false) {
    // 移除前一個選擇的高亮
    if (selectedCell) {
        const prevCell = gridContainer.querySelector(`[data-row="${selectedCell.row}"][data-col="${selectedCell.col}"]`);
        if (prevCell) prevCell.classList.remove('selected');
    }
    
    // 移除所有提示邊框和相關提示（點選其他格子時）
    // 但如果是提示功能調用，則保留提示樣式
    if (!keepHints) {
        document.querySelectorAll('.cell.hint-border').forEach(c => c.classList.remove('hint-border'));
        document.querySelectorAll('.cell.hint-related').forEach(c => c.classList.remove('hint-related'));
    }
    
    // 設置新選擇
    selectedCell = { row, col };
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

    if (!selectedCell) {
        // 點選清除時，重新更新所有候選顯示
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                updateCellDisplay(r, c);
            }
        }
        return;
    }
    const { row: sRow, col: sCol } = selectedCell;
    const selectedCellEl = gridContainer.querySelector(`[data-row="${sRow}"][data-col="${sCol}"]`);
    const selectedValue = selectedCellEl && (selectedCellEl.classList.contains('given') ? grid[sRow][sCol] : userInput[sRow][sCol]);

    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        // 行列區塊高亮
        const sameBox = (Math.floor(r/3) === Math.floor(sRow/3) && Math.floor(c/3) === Math.floor(sCol/3));
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
        errorCountSpan.textContent = errorCount;
        // 有錯誤時顯示為紅字
        if (errorCount > 0) {
            errorCountSpan.classList.add('has-error');
        } else {
            errorCountSpan.classList.remove('has-error');
        }
    }
    if (errorCount >= 3 && !gameOver) {
        gameOver = true;
        if (statusSpan) statusSpan.textContent = '遊戲結束！錯誤次數已達上限。';
        setControlsDisabled(true);
    }
}

// 輸入數字
function inputNumber(num) {
    if (!selectedCell || gameOver) return;
    const { row, col } = selectedCell;
    
    if (candidateMode) {
        // 候選模式：切換候選數字
        if (candidates[row][col].has(num)) {
            candidates[row][col].delete(num);
        } else {
            candidates[row][col].add(num);
        }
        updateCellDisplay(row, col);
        updateCandidateButtonStyles(row, col); // 更新按鈕樣式
    } else {
        // 普通模式：設置值（清空候選數字）
        
        // 保存原始的候選數字集合（還原用）
        const originalCandidates = new Set(candidates[row][col]);
        
        userInput[row][col] = num;
        candidates[row][col].clear();
        
        // 驗證輸入是否正確
        if (!validateInput(row, col, num)) {
            // 錯誤：顯示紅色，計數器 +1，然後自動還原
            errorCount++;
            updateErrorDisplay();
            const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.style.backgroundColor = '#ffcccc'; // 紅色背景
            }
            // 自動還原上一步（移除這次的輸入，恢復候選數字）
            setTimeout(() => {
                userInput[row][col] = 0;
                candidates[row][col] = originalCandidates;
                updateCellDisplay(row, col);
                updateHighlights();
                updateButtonStates();
                updateCandidateButtonStyles(row, col); // 更新候選按鈕樣式
                // 清除紅色背景
                if (cell) cell.style.backgroundColor = '';
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
        
        // 檢查遊戲是否完成
        if (isGameComplete()) {
            gameOver = true;
            setControlsDisabled(true);
            setTimeout(() => showGameCompleteDialog(), 500);
        }
    }
}

function getSelectedDifficulty() {
    return 75;
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

// 顯示遊戲完成對話框
function showGameCompleteDialog() {
    // 停止計時器
    stopTimer();
    
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const message = `🎉 恭喜！所有答案都輸入完成了！\n\n⏱️ 用時：${timeStr}\n💡 提示次數：${hintsUsed}\n\n點選確認開始新遊戲`;
    if (confirm(message)) {
        generateNewSudoku(getSelectedDifficulty());
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

function setControlsDisabled(disabled) {
    if (generateBtn) generateBtn.disabled = disabled;
}

// 計時器函數
function startTimer() {
    stopTimer(); // 先停止之前的計時器
    gameStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // 立即更新一次
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimer() {
    if (!gameStartTime || !timerSpan) return;
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerSpan.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// 非同步生成，讓 UI 可以更新狀態提示（始終使用唯一解檢查）
async function generateNewSudoku(difficulty = getSelectedDifficulty()) {
    try {
        setControlsDisabled(true);
        
        // 顯示全螢幕讀條
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-bar"><div class="loading-progress"></div></div>';
        document.body.appendChild(overlay);

        // 讓瀏覽器有機會更新 UI
        await new Promise(resolve => setTimeout(resolve, 20));

        // 初始化並產生完整解
            grid = Array.from({ length: N }, () => Array(N).fill(0));
            userInput = Array.from({ length: N }, () => Array(N).fill(0));
            candidates = Array.from({ length: N }, () => Array(N).fill(null).map(() => new Set([1,2,3,4,5,6,7,8,9])));
        fillGrid(0, 0);

        // 建立謎題（始終檢查唯一解）
        const puzzle = createPuzzle(difficulty, true);

        renderGrid(puzzle);
        // 不在遊戲初始化時填充候選數字，只在玩家點選"自動填入"按鈕時才填充
        updateButtonStates(); // 重置按鈕狀態
        
        // 初始化遊戲狀態
        errorCount = 0; // 初始化為 0/3
        gameOver = false;
        hintsUsed = 0; // 重置提示次數
        hintCells.clear(); // 清空提示格子記錄
        updateErrorDisplay();
        
        // 更新提示按鈕
        if (hintCountSpan) hintCountSpan.textContent = hintsUsed;
        if (hintBtn) hintBtn.disabled = false;
        
        // 啟動計時器
        startTimer();
    } finally {
        setControlsDisabled(false);
        
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
                candidates[row][col] = new Set([1,2,3,4,5,6,7,8,9]);
                
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

// 更新所有格子的候選數字顯示
function updateAllCandidatesDisplay() {
    for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
            updateCellDisplay(row, col);
        }
    }
}

// 初始化時自動生成
generateNewSudoku(getSelectedDifficulty());

// 綁定事件
if (generateBtn) generateBtn.addEventListener('click', () => generateNewSudoku(getSelectedDifficulty()));

// 綁定答案按鈕
document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        if (!isNaN(num)) {
            const prevMode = candidateMode;
            candidateMode = false;
            inputNumber(num);
            candidateMode = prevMode;
        }
    });
});

// 綁定候選按鈕
document.querySelectorAll('.candidate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        if (!isNaN(num)) {
            const prevMode = candidateMode;
            candidateMode = true;
            inputNumber(num);
            candidateMode = prevMode;
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
    });
}

// 提示按鈕
const hintBtn = document.getElementById('hint-btn');
const hintCountSpan = document.getElementById('hint-count');
if (hintBtn) {
    hintBtn.addEventListener('click', () => {
        if (gameOver) return;
        
        // 移除所有舊的提示邊框和相關提示
        document.querySelectorAll('.cell.hint-border').forEach(c => c.classList.remove('hint-border'));
        document.querySelectorAll('.cell.hint-related').forEach(c => c.classList.remove('hint-related'));
        
        // 計算當前盤面每個空格的可能候選數字（基於數獨規則）
        const calculatedCandidates = Array.from({ length: N }, () => 
            Array.from({ length: N }, () => new Set([1,2,3,4,5,6,7,8,9]))
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
                if (userInput[r][c] === 0 && calculatedCandidates[r][c].size === 1) {
                    nakedSingleCells.push({ row: r, col: c });
                }
            }
        }
        
        if (nakedSingleCells.length > 0) {
            // 隨機選擇一個 Naked Single
            const randomCell = nakedSingleCells[Math.floor(Math.random() * nakedSingleCells.length)];
            const { row, col } = randomCell;
            const onlyCandidate = Array.from(calculatedCandidates[row][col])[0];
            
            const nakedMsg = `=== 提示：Naked Single ===\n位置：第 ${row + 1} 行，第 ${col + 1} 列\n這個格子的候選數字只剩一個：${onlyCandidate}\n因此答案必定是 ${onlyCandidate}`;
            showToast(nakedMsg);
            
            hintCells.add(`${row}-${col}`);
            
            // 先添加樣式再 selectCell
            const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('hint-border');
            }
            selectCell(row, col, true);
            hintsUsed++;
            hintCountSpan.textContent = hintsUsed;
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
            // 去重（可能同一格被多次找到）
            const uniqueCells = [];
            const seen = new Set();
            for (const cell of hiddenSingleCells) {
                const key = `${cell.row}-${cell.col}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueCells.push(cell);
                }
            }
            // 隨機選擇一個 Hidden Single
            const randomCell = uniqueCells[Math.floor(Math.random() * uniqueCells.length)];
            const { row, col, num, type } = randomCell;
            
            const hiddenMsg = `=== 提示：Hidden Single ===\n位置：第 ${row + 1} 行，第 ${col + 1} 列\n數字 ${num} 在此${type === 'row' ? '行' : type === 'col' ? '列' : '3x3區塊'}中只能填在這個位置\n淡黃色背景：相關的${type === 'row' ? '同行' : type === 'col' ? '同列' : '同區塊'}格子`;
            showToast(hiddenMsg);
            
            hintCells.add(`${row}-${col}`);
            
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
            
            hintsUsed++;
            hintCountSpan.textContent = hintsUsed;
            return;
        }
        
        // 策略 3: 退而求其次 - 找候選數字最少的格子（2-3個候選）
        let minCandidates = 10;
        const minCandidateCells = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const size = calculatedCandidates[r][c].size;
                if (userInput[r][c] === 0 && size > 0) {
                    if (size < minCandidates) {
                        minCandidates = size;
                        minCandidateCells.length = 0;
                        minCandidateCells.push({ row: r, col: c });
                    } else if (size === minCandidates) {
                        minCandidateCells.push({ row: r, col: c });
                    }
                }
            }
        }
        
        if (minCandidateCells.length > 0) {
            // 隨機選擇一個候選數字最少的格子
            const randomCell = minCandidateCells[Math.floor(Math.random() * minCandidateCells.length)];
            const { row, col } = randomCell;
            const candidates = Array.from(calculatedCandidates[row][col]).sort((a, b) => a - b);
            
            const minCandMsg = `=== 提示：最少候選數字 ===\n位置：第 ${row + 1} 行，第 ${col + 1} 列\n這個格子目前有 ${candidates.length} 個候選：${candidates.join(', ')}\n建議：用排除法縮小範圍`;
            showToast(minCandMsg);
            
            hintCells.add(`${row}-${col}`);
            
            // 先添加樣式再 selectCell
            const cell = gridContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('hint-border');
            }
            selectCell(row, col, true);
            hintsUsed++;
            hintCountSpan.textContent = hintsUsed;
            return;
        }
        
        // 理論上不應該到這裡（除非遊戲已完成）
        alert('無法找到可提示的格子！');
    });
}

// 初始化時自動生成
generateNewSudoku(getSelectedDifficulty());
