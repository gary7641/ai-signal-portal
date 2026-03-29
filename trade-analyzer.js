/**
 * AI Signal Hub - 完整整合版 Trade Analyzer
 * 無需手動修改，直接覆蓋原本的 trade-analyzer.js 即可運行。
 */

// --- 1. 全域變數初始化 ---
let globalTrades = [];
let globalBySymbol = {};
let radarChart, equityChart, symbolCumulativeChart;
let symbolWeekdayProfitChart, symbolWeekdayCountChart;
let symbolHourlyProfitChart, symbolHourlyCountChart;
let miniCharts = {};
let globalEAKey = "AI_SIGNAL_EA";

// --- 2. 數據處理核心 (處理 CSV 與 統計) ---

function parseMT4CSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    // 取得 Header 並清理空格
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const trades = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] ? cols[idx].trim() : ""; });

        // 核心數據轉換
        const profit = parseFloat(row.profit) || 0;
        const lots = parseFloat(row.lots) || 0;
        const openTime = new Date(row.opentime || row.time);
        const closeTime = new Date(row.closetime || row.time);

        trades.push({
            symbol: row.symbol || "Unknown",
            type: (row.type || "buy").toLowerCase(),
            lots: lots,
            openTime: openTime,
            closeTime: closeTime,
            profit: profit,
            pips: parseFloat(row.pips) || 0
        });
    }
    // 按平倉時間排序
    return trades.sort((a, b) => a.closeTime - b.closeTime);
}

function buildStats(trades) {
    if (!trades || trades.length === 0) return null;
    
    let grossProfit = 0, grossLoss = 0, winCount = 0;
    let maxDrawdown = 0, currentEquity = 0, peak = 0;
    let totalPips = 0, totalHoldingMs = 0;
    let maxConsecLoss = 0, currentConsecLoss = 0;

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
        totalPips += t.pips;
        totalHoldingMs += (t.closeTime - t.openTime);

        currentEquity += p;
        if (currentEquity > peak) peak = currentEquity;
        let dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;
    });

    return {
        totalTrades: trades.length,
        winRate: winCount / trades.length,
        profitFactor: grossLoss === 0 ? Infinity : grossProfit / grossLoss,
        expectancy: (grossProfit - grossLoss) / trades.length,
        grossProfit, grossLoss, maxDrawdown, maxConsecLoss,
        avgWin: winCount > 0 ? grossProfit / winCount : 0,
        avgLoss: (trades.length - winCount) > 0 ? grossLoss / (trades.length - winCount) : 0,
        avgHolding: (totalHoldingMs / trades.length) / 3600000, // 轉為小時
        totalPips, avgMFE: 0, avgMAE: 0
    };
}

function buildAccountSummary() {
    if (!globalTrades.length) return null;
    const stats = buildStats(globalTrades);
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

// --- 3. 介面渲染邏輯 (UI Rendering) ---

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
    setText("radarProfitTrades", (s.winRate * s.totalTrades).toFixed(0));
    setText("radarLossTrades", (s.totalTrades - (s.winRate * s.totalTrades)).toFixed(0));
    setText("radarMaxDD", s.maxDrawdown.toFixed(2));
    setText("radarActivity", s.totalTrades + " trades");
    setText("radarAlgoScore", globalEAKey);
    
    buildSummaryRadarChart(s);
    buildSummaryEquityChart(acc.curve);
}

function buildRadarMetricsFromStats(s) {
    const winRateScore = Math.min(100, (s.winRate * 100));
    const pfRaw = s.profitFactor === Infinity ? 5 : s.profitFactor;
    const pfScore = Math.min(100, (pfRaw / 5) * 100);
    const ddScore = Math.max(0, 100 - Math.min(100, s.maxDrawdown));
    return {
        labels: ["勝率","盈利因子","風險 (DD)","期望值","平均盈利","平均虧損"],
        values: [winRateScore, pfScore, ddScore, 50, 50, 50] // 部分數值簡化處理
    };
}

function buildSummaryRadarChart(s) {
    const ctx = document.getElementById("radarChart");
    if (!ctx) return;
    if (radarChart) radarChart.destroy();
    const radarData = buildRadarMetricsFromStats(s);
    radarChart = new Chart(ctx, {
        type: "radar",
        data: {
            labels: radarData.labels,
            datasets: [{
                data: radarData.values,
                backgroundColor: "rgba(157,78,221,0.15)",
                borderColor: "#9d4edd",
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function buildSummaryEquityChart(curve) {
    const ctx = document.getElementById("equityChart");
    if (!ctx) return;
    if (equityChart) equityChart.destroy();
    equityChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: curve.map(p => p.x),
            datasets: [{
                data: curve.map(p => p.y),
                borderColor: "#0d9fff",
                backgroundColor: "rgba(13,159,255,0.1)",
                tension: 0.2, fill: true, pointRadius: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderAccountStatistics(s) {
    const el = document.getElementById("accountStats");
    if (!el || !s) return;
    el.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <tr><td>交易總數</td><td><b>${s.totalTrades}</b></td></tr>
            <tr><td>勝率</td><td><b>${(s.winRate * 100).toFixed(1)}%</b></td></tr>
            <tr><td>盈利因子</td><td><b>${s.profitFactor.toFixed(2)}</b></td></tr>
            <tr><td>淨利潤</td><td><b>${(s.grossProfit - s.grossLoss).toFixed(2)}</b></td></tr>
            <tr><td>最大回撤</td><td><b>${s.maxDrawdown.toFixed(2)}</b></td></tr>
        </table>`;
}

function renderSymbolButtons() {
    const container = document.getElementById("symbolButtons");
    if (!container) return;
    container.innerHTML = "";
    ["ALL", ...Object.keys(globalBySymbol)].forEach(sym => {
        const btn = document.createElement("button");
        btn.textContent = sym;
        btn.className = "symbol-btn";
        btn.onclick = () => renderSymbol(sym);
        container.appendChild(btn);
    });
}

function renderSymbol(sym) {
    const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym];
    const s = buildStats(trades);
    renderAccountStatistics(s);
    // 可在此擴展更多 Symbol 點擊後的邏輯
}

// --- 4. 啟動與監聽 (Initialization) ---

async function startAnalysis() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files.length) {
        alert("請先選擇 CSV 檔案！");
        return;
    }

    try {
        const text = await fileInput.files[0].text();
        globalTrades = parseMT4CSV(text);
        
        // 分類數據
        globalBySymbol = globalTrades.reduce((rv, x) => {
            (rv[x.symbol] = rv[x.symbol] || []).push(x);
            return rv;
        }, {});

        const acc = buildAccountSummary();
        if (acc) {
            renderSummaryCards(acc);
            renderAccountStatistics(acc.stats);
            renderSymbolButtons();
            console.log("分析成功！");
        } else {
            alert("數據解析失敗，請檢查 CSV 格式。");
        }
    } catch (err) {
        console.error(err);
        alert("讀取檔案出錯。");
    }
}

// 自動綁定按鈕
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('analyzeBtn'); // 確保按鈕 ID 是 analyzeBtn
    if (btn) {
        btn.addEventListener('click', startAnalysis);
    } else {
        console.error("找不到 ID 為 analyzeBtn 的按鈕，請檢查 HTML！");
    }
});
