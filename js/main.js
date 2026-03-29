/**
 * AI Signal Hub - Main Controller
 * 系統大腦：負責流程控制與事件綁定
 */

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileInput = document.getElementById('csvFileInput');
    const debugLog = document.getElementById('debugLog');

    // 全域儲存變數
    let currentTrades = [];
    let groupedTrades = {};

    // 輔助：更新 Debug Console 訊息
    const log = (msg, isError = false) => {
        debugLog.innerText = msg;
        debugLog.style.color = isError ? "#f85149" : "#00ff00";
        console.log(`[System]: ${msg}`);
    };

    // --- 核心執行邏輯 ---
    const runAnalysis = async () => {
        if (!fileInput.files.length) {
            log("請先選擇 MT4 導出的 CSV 檔案！", true);
            return;
        }

        const file = fileInput.files[0];
        log(`正在讀取檔案: ${file.name}...`);

        try {
            const text = await file.text();
            
            // 1. 解析 CSV
            const trades = CoreMath.parseCSV(text);
            if (trades.length === 0) {
                log("錯誤：未能解析數據。請確保 CSV 包含 Symbol, Profit, Time 等欄位。", true);
                return;
            }

            currentTrades = trades;
            groupedTrades = CoreMath.groupBySymbol(trades);
            log(`解析成功！共讀取 ${trades.length} 筆交易。`);

            // 2. 計算全體數據
            const stats = CoreMath.calculateStats(trades);
            
            // 3. 渲染 UI
            UIRenderer.updateCards(stats);
            UIRenderer.drawEquityChart(stats.equityCurve);
            UIRenderer.drawRadarChart(stats.scores);
            UIRenderer.renderSymbolStats(trades);
            
            // 4. 生成品種切換按鈕
            UIRenderer.renderSymbolButtons(groupedTrades, (symbol) => {
                // 當用戶點擊特定品種按鈕時觸發
                const selectedTrades = symbol === "ALL" ? currentTrades : groupedTrades[symbol];
                const selectedStats = CoreMath.calculateStats(selectedTrades);
                
                // 局部更新數據（不影響全局 Equity Curve，只更新表格和卡片）
                UIRenderer.updateCards(selectedStats);
                UIRenderer.renderSymbolStats(selectedTrades);
                log(`已切換至品種: ${symbol}`);
            });

            log("分析完成！所有圖表已更新 ✅");

        } catch (err) {
            log(`系統崩潰: ${err.message}`, true);
            console.error(err);
        }
    };

    // 綁定點擊事件
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', runAnalysis);
    } else {
        console.error("找不到 analyzeBtn 元素，請檢查 HTML ID 是否正確。");
    }
});
