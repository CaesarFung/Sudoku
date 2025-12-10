// 多語言翻譯文件
const translations = {
    'zh-Hant': {
        // UI 按鈕和標籤
        title: 'Caesar的數獨遊戲',
        timer: '⏱️',
        errors: '❌',
        notes: '筆記',
        hint: '提示',
        settings: '設定',
        resume: '繼續遊戲',
        newGame: '新遊戲',
        intro: '入門',
        easy: '簡單',
        medium: '普通',
        hard: '困難',
        expert: '地獄',
        
        // 對話框訊息
        gameOverMessage: (time, hints, errors) => `❌ 遊戲結束\n\n錯誤次數已達上限 (${errors}/3)\n⏱️ 用時：${time}\n💡 提示次數：${hints}\n\n點選確認開始新遊戲`,
        gameCompleteMessage: (time, hints, errors) => `🎉 恭喜完成！\n\n⏱️ 用時：${time}\n💡 提示次數：${hints}\n❌ 錯誤次數：${errors}/3\n\n點選確認開始新遊戲`,
        
        // 提示訊息
        nakedSingleHint: (row, col, num) => `=== 提示：Naked Single ===\n位置：第 ${row} 行，第 ${col} 列\n這個格子的候選數字只剩一個：${num}\n因此答案必定是 ${num}`,
        hiddenSingleHint: (row, col, num, regionType, regionIdx) => `=== 提示：Hidden Single ===\n位置：第 ${row} 行，第 ${col} 列\n數字 ${num} 在此${regionType}中只能填在這個位置\n淡黃色背景：相關的同${regionType}格子`,
        nakedPairHint: (regionType, regionIdx, nums) => `=== 提示：Naked Pair ===\n${regionType}${regionIdx}\n這兩格候選數字僅有：${nums}\n可刪除同區域其他格的這些候選數字`,
        nakedTripleHint: (regionType, regionIdx, nums) => `=== 提示：Naked Triple ===\n${regionType}${regionIdx}\n這三格候選數字僅有：${nums}\n可刪除同區域其他格的這些候選數字`,
        pointingHint: (num, box, line, lineType) => `=== 提示：Pointing (Box-Line) ===\n數字 ${num} 在第 ${box} 區塊只出現在${lineType} ${line}\n可刪除該${lineType}其他區塊的 ${num} 候選`,
        claimingHint: (num, line, lineType) => `=== 提示：Claiming (Line→Box) ===\n數字 ${num} 在${lineType} ${line}只出現在同一區塊\n可刪除該區塊其他格的 ${num} 候選`,
        xWingHint: (num, row1, row2, col1, col2) => `=== 提示：X-Wing ===\n數字 ${num} 在第 ${row1} 行和第 ${row2} 行\n只出現在第 ${col1} 列和第 ${col2} 列\n可刪除這兩列其他位置的 ${num} 候選`,
        
        // 錯誤和警告訊息
        noHintAvailable: '無法找到可提示的格子！',
        saveFailed: '儲存進度失敗',
        loadFailed: '載入進度失敗',
        difficultyFailed: '儲存難度失敗',
        loadGameFailed: '遊戲載入失敗，請重新整理頁面',
        generateFailed: '遊戲初始化失敗',
        retryExceeded: (removed, target) => `超過重試上限，返回最佳結果 (移除: ${removed}/${target})`,
        puzzleBelowTarget: (removed, target) => `未達標 (移除: ${removed}/${target})，重新生成...`,
        puzzleComplete: (removed, target, attempts) => `移除: ${removed}/${target} (嘗試${attempts}次)`,
        
        // 邏輯排除提示
        logicElimination: (row, col) => `=== 提示：邏輯排除 ===\n位置：第 ${row} 行，第 ${col} 列\n可能是：`,
        noClueHint: (row, col, cands, answer) => `=== 提示：已填入答案 ===\n位置：第 ${row} 行，第 ${col} 列\n原候選：${cands}\n正確答案：${answer}\n（無明確技巧可提示，已直接填入，不消耗提示次數）`,
        eliminationAdvice: (num, context) => `提示：${num} 在${context}無其他位置，應是此格答案`,
        
        // 區域名稱（用於提示中）
        row: '行',
        col: '列',
        box: '區塊'
    },
    'en': {
        // UI Buttons and Labels
        title: 'Caesar\'s Sudoku Game',
        timer: '⏱️',
        errors: '❌',
        notes: 'Notes',
        hint: 'Hint',
        settings: 'Settings',
        resume: 'Resume Game',
        newGame: 'New Game',
        intro: 'Intro',
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
        expert: 'Expert',
        
        // Dialog Messages
        gameOverMessage: (time, hints, errors) => `❌ Game Over\n\nError limit reached (${errors}/3)\n⏱️ Time: ${time}\n💡 Hints used: ${hints}\n\nClick OK to start a new game`,
        gameCompleteMessage: (time, hints, errors) => `🎉 Congratulations!\n\n⏱️ Time: ${time}\n💡 Hints used: ${hints}\n❌ Errors: ${errors}/3\n\nClick OK to start a new game`,
        
        // Hint Messages
        nakedSingleHint: (row, col, num) => `=== Hint: Naked Single ===\nPosition: Row ${row}, Column ${col}\nThis cell has only one candidate: ${num}\nTherefore the answer must be ${num}`,
        hiddenSingleHint: (row, col, num, regionType, regionIdx) => `=== Hint: Hidden Single ===\nPosition: Row ${row}, Column ${col}\n${num} can only go in this ${regionType}\nLight yellow background: Related cells in the same ${regionType}`,
        nakedPairHint: (regionType, regionIdx, nums) => `=== Hint: Naked Pair ===\n${regionType} ${regionIdx}\nThese two cells have only: ${nums}\nRemove these candidates from other cells in this ${regionType}`,
        nakedTripleHint: (regionType, regionIdx, nums) => `=== Hint: Naked Triple ===\n${regionType} ${regionIdx}\nThese three cells have only: ${nums}\nRemove these candidates from other cells in this ${regionType}`,
        pointingHint: (num, box, line, lineType) => `=== Hint: Pointing (Box-Line) ===\n${num} in Box ${box} appears only in ${lineType} ${line}\nRemove ${num} candidates from other boxes in this ${lineType}`,
        claimingHint: (num, line, lineType) => `=== Hint: Claiming (Line→Box) ===\n${num} in ${lineType} ${line} appears only in one box\nRemove ${num} candidates from other ${lineType}s in this box`,
        xWingHint: (num, row1, row2, col1, col2) => `=== Hint: X-Wing ===\n${num} in Row ${row1} and Row ${row2}\nappears only in Column ${col1} and Column ${col2}\nRemove ${num} candidates from these columns`,
        
        // Error and Warning Messages
        noHintAvailable: 'No hint available!',
        saveFailed: 'Failed to save progress',
        loadFailed: 'Failed to load progress',
        difficultyFailed: 'Failed to save difficulty',
        loadGameFailed: 'Game loading failed, please refresh the page',
        generateFailed: 'Game initialization failed',
        retryExceeded: (removed, target) => `Retry limit exceeded, returning best result (removed: ${removed}/${target})`,
        puzzleBelowTarget: (removed, target) => `Below target (removed: ${removed}/${target}), regenerating...`,
        puzzleComplete: (removed, target, attempts) => `Removed: ${removed}/${target} (${attempts} attempts)`,
        
        // Logic Elimination Hints
        logicElimination: (row, col) => `=== Hint: Logic Elimination ===\nPosition: Row ${row}, Column ${col}\nCould be: `,
        noClueHint: (row, col, cands, answer) => `=== Hint: Answer Filled ===\nPosition: Row ${row}, Column ${col}\nOriginal candidates: ${cands}\nCorrect answer: ${answer}\n(No clear technique available, answer filled directly, no hint used)`,
        eliminationAdvice: (num, context) => `Hint: ${num} has no other position in this ${context}, must be the answer for this cell`,
        
        // Region Names
        row: 'row',
        col: 'column',
        box: 'box'
    },
    'ja': {
        // UI ボタンとラベル
        title: 'シーザーの数独ゲーム',
        timer: '⏱️',
        errors: '❌',
        notes: 'メモ',
        hint: 'ヒント',
        settings: '設定',
        resume: 'ゲームを続ける',
        newGame: '新しいゲーム',
        intro: '入門',
        easy: '簡単',
        medium: '普通',
        hard: '難しい',
        expert: 'エキスパート',
        
        // ダイアログメッセージ
        gameOverMessage: (time, hints, errors) => `❌ ゲームオーバー\n\nエラー数が上限に達しました (${errors}/3)\n⏱️ 時間: ${time}\n💡 ヒント: ${hints}\n\nOKをクリックして新しいゲームを開始します`,
        gameCompleteMessage: (time, hints, errors) => `🎉 おめでとうございます！\n\n⏱️ 時間: ${time}\n💡 ヒント: ${hints}\n❌ エラー: ${errors}/3\n\nOKをクリックして新しいゲームを開始します`,
        
        // ヒントメッセージ
        nakedSingleHint: (row, col, num) => `=== ヒント：ネイキッドシングル ===\n位置：${row}行${col}列\nこのセルには1つの候補しかありません：${num}\nしたがって答えは${num}です`,
        hiddenSingleHint: (row, col, num, regionType, regionIdx) => `=== ヒント：隠されたシングル ===\n位置：${row}行${col}列\n${num}はこの${regionType}にしか入りません\n淡黄色背景：同じ${regionType}の関連セル`,
        nakedPairHint: (regionType, regionIdx, nums) => `=== ヒント：ネイキッドペア ===\n${regionType}${regionIdx}\nこの2つのセルの候補のみ：${nums}\nこの${regionType}の他のセルから削除してください`,
        nakedTripleHint: (regionType, regionIdx, nums) => `=== ヒント：ネイキッドトリプル ===\n${regionType}${regionIdx}\nこの3つのセルの候補のみ：${nums}\nこの${regionType}の他のセルから削除してください`,
        pointingHint: (num, box, line, lineType) => `=== ヒント：ポインティング ===\nボックス${box}の${num}は${lineType}${line}にのみ出現します\nこの${lineType}の他のボックスから${num}を削除してください`,
        claimingHint: (num, line, lineType) => `=== ヒント：クレーミング ===\n${lineType}${line}の${num}は1つのボックスにのみ出現します\nこのボックスの他の${lineType}から${num}を削除してください`,
        xWingHint: (num, row1, row2, col1, col2) => `=== ヒント：X-Wing ===\n${num}は第${row1}行と第${row2}行\n第${col1}列と第${col2}列にのみ出現します\nこれらの列から${num}を削除してください`,
        
        // エラーと警告メッセージ
        noHintAvailable: 'ヒントが利用できません！',
        saveFailed: '進行状況の保存に失敗しました',
        loadFailed: '進行状況の読み込みに失敗しました',
        difficultyFailed: '難易度の保存に失敗しました',
        loadGameFailed: 'ゲームの読み込みに失敗しました。ページを更新してください',
        generateFailed: 'ゲームの初期化に失敗しました',
        retryExceeded: (removed, target) => `再試行の上限を超えました。最良の結果を返します (削除: ${removed}/${target})`,
        puzzleBelowTarget: (removed, target) => `目標未達 (削除: ${removed}/${target})。再生成中...`,
        puzzleComplete: (removed, target, attempts) => `削除: ${removed}/${target} (${attempts}回の試行)`,
        
        // ロジック削除ヒント
        logicElimination: (row, col) => `=== ヒント：ロジック排除 ===\n位置：第${row}行、第${col}列\nかもしれません：`,
        noClueHint: (row, col, cands, answer) => `=== ヒント：回答を入力 ===\n位置：第${row}行、第${col}列\n元の候補：${cands}\n正解：${answer}\n(明確なテクニックがないため、直接入力されました。ヒント消費なし)`,
        eliminationAdvice: (num, context) => `ヒント：${num}はこの${context}に他の位置がなく、このセルの答えである必要があります`,
        
        // 地域名
        row: '行',
        col: '列',
        box: 'ボックス'
    },
    'ko': {
        // UI 버튼 및 레이블
        title: '시저의 스도쿠 게임',
        timer: '⏱️',
        errors: '❌',
        notes: '메모',
        hint: '힌트',
        settings: '설정',
        resume: '게임 계속',
        newGame: '새 게임',
        intro: '입문',
        easy: '쉬움',
        medium: '보통',
        hard: '어려움',
        expert: '전문가',
        
        // 대화 상자 메시지
        gameOverMessage: (time, hints, errors) => `❌ 게임 오버\n\n오류 제한 도달 (${errors}/3)\n⏱️ 시간: ${time}\n💡 사용된 힌트: ${hints}\n\nOK를 클릭하여 새 게임을 시작하세요`,
        gameCompleteMessage: (time, hints, errors) => `🎉 축하합니다!\n\n⏱️ 시간: ${time}\n💡 사용된 힌트: ${hints}\n❌ 오류: ${errors}/3\n\nOK를 클릭하여 새 게임을 시작하세요`,
        
        // 힌트 메시지
        nakedSingleHint: (row, col, num) => `=== 힌트: 네이키드 싱글 ===\n위치: ${row}행 ${col}열\n이 칸에는 하나의 후보만 있습니다: ${num}\n따라서 답은 ${num}입니다`,
        hiddenSingleHint: (row, col, num, regionType, regionIdx) => `=== 힌트: 숨겨진 싱글 ===\n위치: ${row}행 ${col}열\n${num}은 이 ${regionType}에만 들어갈 수 있습니다\n연한 노란색 배경: 같은 ${regionType}의 관련 셀`,
        nakedPairHint: (regionType, regionIdx, nums) => `=== 힌트: 네이키드 페어 ===\n${regionType}${regionIdx}\n이 두 칸의 후보: ${nums}\n같은 ${regionType}의 다른 칸에서 삭제하세요`,
        nakedTripleHint: (regionType, regionIdx, nums) => `=== 힌트: 네이키드 트리플 ===\n${regionType}${regionIdx}\n이 세 칸의 후보: ${nums}\n같은 ${regionType}의 다른 칸에서 삭제하세요`,
        pointingHint: (num, box, line, lineType) => `=== 힌트: 포인팅 ===\n박스${box}의 ${num}은 ${lineType}${line}에만 나타납니다\n이 ${lineType}의 다른 박스에서 ${num}을 삭제하세요`,
        claimingHint: (num, line, lineType) => `=== 힌트: 클레이밍 ===\n${lineType}${line}의 ${num}은 하나의 박스에만 나타납니다\n이 박스의 다른 ${lineType}에서 ${num}을 삭제하세요`,
        xWingHint: (num, row1, row2, col1, col2) => `=== 힌트: X-Wing ===\n${num}은 ${row1}행과 ${row2}행\n${col1}열과 ${col2}열에만 나타납니다\n이 열들에서 ${num}을 삭제하세요`,
        
        // 오류 및 경고 메시지
        noHintAvailable: '사용 가능한 힌트가 없습니다!',
        saveFailed: '진행 상황 저장 실패',
        loadFailed: '진행 상황 로드 실패',
        difficultyFailed: '난이도 저장 실패',
        loadGameFailed: '게임 로드 실패, 페이지를 새로고침하세요',
        generateFailed: '게임 초기화 실패',
        retryExceeded: (removed, target) => `재시도 한도 초과, 최적 결과 반환 (제거: ${removed}/${target})`,
        puzzleBelowTarget: (removed, target) => `목표 미달 (제거: ${removed}/${target}), 재생성 중...`,
        puzzleComplete: (removed, target, attempts) => `제거됨: ${removed}/${target} (${attempts}회 시도)`,
        
        // 로직 제거 힌트
        logicElimination: (row, col) => `=== 힌트: 로직 제거 ===\n위치: ${row}행 ${col}열\n다음 중 하나일 수 있습니다: `,
        noClueHint: (row, col, cands, answer) => `=== 힌트: 답변 입력됨 ===\n위치: ${row}행 ${col}열\n원래 후보: ${cands}\n정답: ${answer}\n(명확한 기법이 없어 직접 입력되었습니다. 힌트 사용 안 함)`,
        eliminationAdvice: (num, context) => `힌트: ${num}은 이 ${context}에서 다른 위치가 없으므로 이 셀의 정답이어야 합니다`,
        
        // 영역 이름
        row: '행',
        col: '열',
        box: '박스'
    }
};

// 語言管理類
class I18n {
    constructor(defaultLang = 'zh-Hant') {
        this.supportedLanguages = Object.keys(translations);
        this.currentLang = this.loadLanguage() || this.detectSystemLanguage() || defaultLang;
    }

    loadLanguage() {
        try {
            return localStorage.getItem('sudoku-language');
        } catch (err) {
            return null;
        }
    }

    detectSystemLanguage() {
        // 從 navigator.language 獲取系統語言設定
        const browserLang = navigator.language || navigator.userLanguage;
        
        // 嘗試精確匹配（例如 zh-Hant、en-US）
        if (this.supportedLanguages.includes(browserLang)) {
            return browserLang;
        }
        
        // 嘗試語言前綴匹配（例如 zh 匹配 zh-Hant）
        const langPrefix = browserLang.split('-')[0];
        for (let lang of this.supportedLanguages) {
            if (lang.startsWith(langPrefix)) {
                return lang;
            }
        }
        
        // 處理特殊情況
        if (browserLang.startsWith('zh')) {
            // 簡體中文預設使用繁體（因為繁體更通用）
            return 'zh-Hant';
        }
        if (browserLang.startsWith('en')) {
            return 'en';
        }
        if (browserLang.startsWith('ja')) {
            return 'ja';
        }
        if (browserLang.startsWith('ko')) {
            return 'ko';
        }
        
        return null;
    }

    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`Language ${lang} not supported, using ${this.currentLang}`);
            return;
        }
        this.currentLang = lang;
        try {
            localStorage.setItem('sudoku-language', lang);
        } catch (err) {
            console.warn('Failed to save language preference', err);
        }
        // 觸發語言變更事件（供其他代碼監聽）
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    t(key, ...args) {
        const trans = translations[this.currentLang];
        if (!trans) {
            return translations['en'][key] || key;
        }
        const value = trans[key];
        if (typeof value === 'function') {
            return value(...args);
        }
        return value || key;
    }

    getCurrentLanguage() {
        return this.currentLang;
    }

    getSupportedLanguages() {
        return this.supportedLanguages;
    }
}

// 建立全域 i18n 實例
const i18n = new I18n();
