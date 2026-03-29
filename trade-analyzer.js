/**
 * AI Signal Hub - Trade Analyzer Core
 * 處理數據解析、統計計算與圖表渲染
 */

// 全域變數初始化
let globalTrades = [];
let globalBySymbol = {};
let radarChart, equityChart, symbolCumulativeChart, symbolWeekdayProfitChart;
let symbolWeekdayCountChart, symbolHourlyProfitChart, symbolHourlyCountChart;
let miniCharts = {};
let globalEAKey = "EA_STRATEGY_01";

// --- 1. 數據解析層 (Data Parsing) ---

function parseMT4CSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const trades = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx]; });

        // 轉換格式以適配後續計算
        trades.push({
            symbol: row.symbol || "Unknown",
            type: (row.type || "").toLowerCase(),
            lots: parseFloat(row.lots) || 0,
            openTime: new Date(row.opentime || row.time),
            closeTime: new Date(row.closetime || row.time),
            openPrice: parseFloat(row.openprice) || 0,
            closePrice: parseFloat(row.closeprice) || 0,
            profit: parseFloat(row.profit) || 0,
            pips: parseFloat(row.pips) || 0
        });
    }
    return trades.sort((a, b) => a.closeTime - b.closeTime);
}

function groupBy(array, key) {
    return array.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}

// --- 2. 統計計算層 (Statistics Logic) ---

function buildStats(trades) {
    if (!trades || trades.length === 0) return null;

    let grossProfit = 0, grossLoss = 0, winCount = 0;
    let maxDrawdown = 0, currentEquity = 0, peak = 0;
    let maxConsecLoss = 0, currentConsecLoss = 0;
    let totalPips = 0, totalHoldingMs = 0;

    trades.forEach(t => {
        const p = t.profit;
        if (p > 0) {
            grossProfit += p;
            winCount++;
            currentConsecLoss = 0;
        } else {
            grossLoss += Math.abs(p);
            currentConsecLoss++;
            if (currentConsecLoss > maxConsecLoss) maxConsecLoss = currentConsecLoss;
        }

        totalPips += (t.pips || 0);
        totalHoldingMs += (t.closeTime - t.openTime);

        currentEquity += p;
        if (currentEquity > peak) peak = currentEquity;
        let dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;
    });

    const total = trades.length;
    return {
        totalTrades: total,
        winRate: winCount / total,
        profitFactor: grossLoss === 0 ? Infinity : grossProfit / grossLoss,
        expectancy: (grossProfit - grossLoss) / total,
        grossProfit, grossLoss, maxDrawdown, maxConsecLoss,
        avgWin: winCount > 0 ? grossProfit / winCount : 0,
        avgLoss: (total - winCount) > 0 ? grossLoss / (total - winCount) : 0,
        avgHolding: (totalHoldingMs / total) / 3600000, // 轉小時
        totalPips, avgMFE: 0, avgMAE: 0 // MFE/MAE 需額外數據支持
    };
}

function buildAccountSummary() {
    const stats = buildStats(globalTrades);
    if (!stats) return null;

    let cum = 0;
    const curve = globalTrades.map((t, i) => {
        cum += t.profit;
        return { x: i, y: cum };
    });

    const symbolRanking = Object.keys(globalBySymbol).map(sym => {
        const s = buildStats(globalBySymbol[sym]);
        return [sym, s.grossProfit - s.grossLoss];
    }).sort((a, b) => b[1] - a[1]);

    return {
        stats, curve, symbolRanking,
        firstTime: globalTrades[0].openTime,
        lastTime: globalTrades[globalTrades.length - 1].closeTime
    };
}

// --- 3. 渲染層 (Rendering - 你原本提供的邏輯) ---

function renderSummaryCards(acc) {
    if (!acc || !acc.stats) return;
    const s = acc.stats;
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    const netProfit = s.grossProfit - s.grossLoss;
    setText("growthValue", netProfit >= 0 ? "+" + netProfit.toFixed(2) : netProfit.toFixed(2));
    setText("profitValue", netProfit.toFixed(2));
    if (acc.firstTime && acc.lastTime) {
        setText("growthPeriod", acc.firstTime.toISOString().slice(0, 10) + " → " + acc.lastTime.toISOString().slice(0, 10));
    }
    setText("radarProfitTrades", s.winRate * s.totalTrades);
    setText("radarLossTrades", s.totalTrades - (s.winRate * s.totalTrades));
    setText("radarMaxDD", s.maxDrawdown.toFixed(2));
    setText("radarActivity", s.totalTrades + " trades");
    setText("radarAlgoScore", globalEAKey);
    buildSummaryRadarChart(s);
    buildSummaryEquityChart(acc.curve);
}

// ... 這裡保留你之前提供的所有 renderXXXX function ...
// (包括 buildRadarMetricsFromStats, buildSummaryRadarChart, renderMartinTables, renderSwot 等)

// --- 4. 啟動分析 (Event Hook) ---

async function handleAnalysis() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files.length) {
        alert("請先選擇 CSV 檔案");
        return;
    }

    const text = await fileInput.files[0].text();
    globalTrades = parseMT4CSV(text);
    globalBySymbol = groupBy(globalTrades, 'symbol');

    const acc = buildAccountSummary();
    if (!acc) return;

    // 執行所有渲染
    renderSummaryCards(acc);
    renderAccountStatistics(acc.stats);
    renderSymbolButtons();
    renderSymbolMiniCharts();
    renderMartinTables();
    renderSwot(buildSwotData(acc.stats));
    
    // 如果有 Dashboard 頁面
    if(document.getElementById("taEquityChart")) renderEquityGrowthDashboard();
    if(document.getElementById("taRadarChart")) renderEaRadarDashboard();
    if(document.getElementById("taSymbolChart")) renderSymbolPerfDashboard();
    
    console.log("Analysis Complete ✅");
}

// 綁定按鈕 (假設你的按鈕 ID 是 analyzeBtn)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('analyzeBtn');
    if(btn) btn.addEventListener('click', handleAnalysis);
});
