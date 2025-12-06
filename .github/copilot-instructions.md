# Copilot 指令（專案快速上手）

此專案是一個極簡的前端數獨生成器（靜態 single-page app）。以下指令說明讓 AI 編碼代理能快速在此代碼庫中有用且安全地改動。

## 大局觀（Why / Architecture）
- 單頁靜態應用：所有邏輯都在 `script.js`，視覺樣式在 `style.css`，入口為 `index.html`。
- `script.js` 的主要責任：生成完整數獨盤面（`fillGrid` 回溯法）、從完整盤面移除數字以產生謎題（`createPuzzle`）、以及將謎題渲染至 DOM（`renderGrid`）。
- DOM integration：使用兩個固定 ID：`#sudoku-grid`（格子容器）和 `#generate-btn`（生成按鈕）。

## 主要檔案（重要參考）
- `index.html`：包含 `<div id="sudoku-grid">` 與 `<button id="generate-btn">`，並載入 `script.js` 與 `style.css`。
- `script.js`：核心程式，關鍵函數：`isSafe(row,col,num)`、`fillGrid(row,col)`、`createPuzzle(difficulty)`、`renderGrid(puzzle)`、`generateNewSudoku()`。
- `style.css`：以 CSS Grid 呈現 9x9 格子，`.cell`、`.given` 與 `.grid-container` 為重要類別。

## 可執行／開發工作流（具體命令）
- 無建置系統（純靜態），直接打開 `index.html` 即可。
- 若需在本機啟動簡易伺服器（建議用於跨來源或 fetch 測試）：
  - 使用 Python 3:
    ```bash
    python3 -m http.server 8000
    # 在瀏覽器開啟 http://localhost:8000
    ```
  - 或使用 Node 小工具（若安裝）：
    ```bash
    npx serve .
    ```

## 已知專案風格與約定（從原始碼可發現）
- 採用原生 JavaScript（ES6+），未使用模組打包或 NPM 套件。
- 全域變數 `grid` 用作主要資料結構（9x9 二維陣列）。代理若修改資料結構，務必同步調整 `isSafe`, `fillGrid`, `createPuzzle`, `renderGrid`。
- `createPuzzle` 目前只依「移除數量」來控制難度，**不驗證唯一解** — 這是重要的可觀察限制，不要假設謎題總有唯一解。

## 編輯與偵錯建議（具體例子）
- 若要查看生成的已解盤面，可暫時在 `generateNewSudoku()` 中 `fillGrid(0,0)` 之後加入：
  ```js
  console.log('full solution', grid);
  ```
- 若要替換空白格為可輸入的欄位，編輯 `renderGrid`：在 `value === 0` 分支，建立 `<input inputmode="numeric">` 並綁定事件以更新使用者輸入。
- 若要驗證唯一解（改進 `createPuzzle`），在移除數字後執行一個可計數解數量的解算器（backtracking solver），必要時恢復該格。

## 小心不要做的事（不可假設）
- 不要移除或隨意改動 `#sudoku-grid` 與 `#generate-btn` 的 ID，前端邏輯直接依賴它們。
- 不要假設 `createPuzzle` 產生的謎題有唯一解；任何新增功能（例如難度標準或驗證）應明確加入解唯一性檢查。

## 可執行任務範例（短期、可驗證）
- 為 `createPuzzle` 加入「唯一解檢查」：新增一個 solver 函式（回傳解的數量），在移除數字時使用它決定是否永久移除。
- 將 `renderGrid` 中空格改為 `<input>`，並在輸入時標注錯誤（即時比對 `isSafe` 或對比目前解）。
- 新增測試頁面或開發工具：在 `index.html` 加入隱藏按鈕以列印目前 `grid`、謎題與解答。

## Pull Request 與提交說明（建議）
- 小而明確的修改：一個 PR 專注於一項功能（例如：新增 solver 或改良 UI）。
- PR 說明應包含：變更摘要、手動驗證步驟（如何在瀏覽器確認）、任何可能的行為變更（例如改變 `grid` 形式）。

---
如果你想要我直接：
- 實作「唯一解檢查」的 solver（我可以修改 `script.js` 並加上測試按鈕）；或
- 把空格轉成可輸入 `<input>` 並加入即時錯誤提示。

請告訴我你要優先哪一項，或提供你希望補充到說明裡的細節（例如開發者偏好、命名規則）。
