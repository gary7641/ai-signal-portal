/**
 * AI Signal Hub - Core Math Engine
 * 負責所有量化計算與數據解析
 */

const CoreMath = {
    // 1. CSV 解析器：自動識別 Header 並轉換為標準物件
    parseCSV: function(text) {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length < 2) return [];

        const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // 自動搵出關鍵欄位的位置
        const index = {
            symbol: rawHeaders.findIndex(h => h.includes('symbol')),
            profit: rawHeaders.findIndex(h => h.includes('profit')),
            time: rawHeaders.findIndex(h => h.includes('time') || h.includes('open')),
            type: rawHeaders.findIndex(h => h.includes('type')),
            lots: rawHeaders.findIndex(h => h.includes('lots'))
        };

        const trades = lines.slice(1).map(line => {
            const cols = line.split(',');
            const profit = parseFloat(cols[index.profit]) || 0;
            return {
                symbol: cols[index.symbol] || "Unknown",
                profit: profit,
                time: new Date(cols[index.time]),
                type: (cols[index.type] || "buy").toLowerCase(),
                lots: parseFloat(cols[index.lots]) || 0,
                isWin: profit > 0
            };
        });

        // 按時間排序 (由舊到新)
        return trades.sort((a, b) => a.time - b.time);
    },

    // 2. 統計計算器：計出勝率、PF、最大回撤等
    calculateStats: function(trades) {
        if (!trades || trades.length === 0) return null;

        let grossProfit = 0;
        let grossLoss = 0;
        let winCount = 0;
        let maxDD = 0;
        let peak = 0;
        let currentEquity = 0;
        
        const equityCurve = [];

        trades.forEach((t, i) => {
            // 計算盈虧
            if (t.isWin) {
                grossProfit += t.profit;
                winCount++;
            } else {
                grossLoss += Math.abs(t.profit);
            }

            // 計算資金曲線與回撤
            currentEquity += t.profit;
            equityCurve.push({ x: i, y: currentEquity });

            if (currentEquity > peak) peak = currentEquity;
            const dd = peak - currentEquity;
            if (dd > maxDD) maxDD = dd;
        });

        const netProfit = grossProfit - grossLoss;
        const totalTrades = trades.length;

        return {
            totalTrades,
            netProfit,
            winRate: (winCount / totalTrades) * 100,
            profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
            maxDD,
            equityCurve,
            // 評分邏輯 (用於雷達圖)
            scores: {
                profitability: Math.min(100, (netProfit / 1000) * 100), // 假設 1000 為滿分基準
                consistency: Math.max(0, 100 - (maxDD / Math.max(1, peak) * 100)),
                winRate: (winCount / totalTrades) * 100,
                riskControl: grossLoss === 0 ? 100 : Math.min(100, (grossProfit / grossLoss) * 20),
                activity: Math.min(100, (totalTrades / 50) * 100) // 假設 50 單為活躍
            }
        };
    },

    // 3. 馬丁層級分析 (Martingale Level Analysis)
    analyzeMartingale: function(trades) {
        // 按手數 (Lots) 分組計算
        const levels = {};
        trades.forEach(t => {
            const lotStr = t.lots.toFixed(2);
            if (!levels[lotStr]) {
                levels[lotStr] = { count: 0, profit: 0, lots: t.lots };
            }
            levels[lotStr].count++;
            levels[lotStr].profit += t.profit;
        });
        
        // 轉為陣列並按手數從小到大排 (Level 1, Level 2...)
        return Object.values(levels).sort((a, b) => a.lots - b.lots);
    },

    // 4. 分類數據 (按 Symbol)
    groupBySymbol: function(trades) {
        return trades.reduce((rv, x) => {
            (rv[x.symbol] = rv[x.symbol] || []).push(x);
            return rv;
        }, {});
    }
};
