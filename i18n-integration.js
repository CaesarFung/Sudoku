// 多語言集成代碼 - 在 script.js 最末尾加入此內容

// ==================== 多語言相關函數 ====================

// 更新所有 UI 文本為目前選定的語言
function updateUILanguage() {
    // 更新 data-i18n-title 屬性（title 屬性）
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        el.title = i18n.t(key);
    });

    // 更新 data-i18n-text 屬性（文字內容）
    document.querySelectorAll('[data-i18n-text]').forEach(el => {
        const key = el.dataset.i18nText;
        el.textContent = i18n.t(key);
    });
}

// 語言切換事件監聽
document.addEventListener('languageChanged', (e) => {
    const newLang = e.detail.lang;
    console.log(`Language changed to: ${newLang}`);
    updateUILanguage();
    
    // 如果暫停菜單已開啟，需要更新其文字
    if (state.pauseOverlay) {
        updatePauseOverlayText(state.pauseOverlay);
    }
});

// 初始化語言按鈕狀態（已移除，因為不再有語言選擇器）
function initLanguageButtons() {
    updateUILanguage();
}

// 在遊戲初始化時呼叫
initLanguageButtons();