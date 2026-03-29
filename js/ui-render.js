/**
 * AI Signal Hub - UI Renderer
 * 專門負責圖表渲染與 DOM 更新
 */

const UIRenderer = {
    charts: {}, // 儲存所有圖表實例，避免重複繪製出錯

    // 1. 更新頂部卡片數值
    updateCards: function(stats) {
        if (!stats) return;
        
        const netProfitEl = document.getElementById('netProfit');
        const maxDDEl = document.getElementById('maxDrawdown');
        const winRateEl = document.getElementById('winRate');
        const rankEl = document.getElementById('accountRank');

        netProfitEl.innerText = `$${stats.netProfit.toFixed(2)}`;
        netProfitEl.className = stats.netProfit >= 0 ? 'value profit' : 'value loss';
        
        maxDDEl.innerText = `$${stats.maxDD.toFixed(2)}`;
        winRateEl.innerText = `${stats.winRate.toFixed(1)}%`;

        // 簡單的分級邏輯 (可隨時調整)
        if (stats.netProfit > 2000) {
            rankEl.innerText = "Diamond 💎";
            rankEl.style.color = "#b9f2ff";
        } else if (stats.netProfit > 500) {
            rankEl.innerText = "Gold 💰";
            rankEl.style.color = "#ffcc00";
        } else {
            rankEl.innerText = "Bronze 🥉";
            rankEl.style.color = "#cd7f32";
        }
    },

    // 2. 繪製資金曲線 (Equity Curve)
    drawEquityChart: function(dataPoints) {
        const ctx = document.getElementById('equityChart').getContext('2d');
        if (this.charts.equity) this.charts.equity.destroy();

        this.charts.equity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataPoints.map(p => p.x),
                datasets: [{
                    label: 'Equity ($)',
                    data: dataPoints.map(p => p.y),
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { display: false } },
                    y: { grid: { color: '#30363d' } }
                }
            }
        });
    },

    // 3. 繪製雷達圖 (EA Radar)
    drawRadarChart: function(scores) {
        const ctx = document.getElementById('radarChart').getContext('2d');
        if (this.charts.radar) this.charts.radar.destroy();

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['盈利能力', '穩定性', '勝率', '風險控制', '活躍度'],
                datasets: [{
                    data: [
                        scores.profitability,
                        scores.consistency,
                        scores.winRate,
                        scores.riskControl,
                        scores.activity
                    ],
                    backgroundColor: 'rgba(157, 78, 221, 0.2)',
                    borderColor: '#9d4edd',
                    pointBackgroundColor: '#9d4edd',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: '#30363d' },
                        grid: { color: '#30363d' },
                        pointLabels: { color: '#adbac7' },
                        ticks: { display: false },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    },

    // 4. 生成馬丁與品種細分表格
    renderSymbolStats: function(trades) {
        const container = document.getElementById('statsTableContainer');
        const martinData = CoreMath.analyzeMartingale(trades);
        
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>加倉層級 (Lots)</th>
                        <th>交易次數</th>
                        <th>累計盈虧</th>
                        <th>平均每單盈虧</th>
                    </tr>
                </thead>
                <tbody>
        `;

        martinData.forEach((level, index) => {
            const avg = level.profit / level.count;
            html += `
                <tr>
                    <td>Level ${index + 1} (${level.lots.toFixed(2)})</td>
                    <td>${level.count}</td>
                    <td class="${level.profit >= 0 ? 'profit' : 'loss'}">${level.profit.toFixed(2)}</td>
                    <td>${avg.toFixed(2)}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    // 5. 生成品種切換按鈕
    renderSymbolButtons: function(groupedData, callback) {
        const container = document.getElementById('symbolButtons');
        container.innerHTML = '<button class="symbol-btn active">全部 (ALL)</button>';
        
        Object.keys(groupedData).forEach(symbol => {
            const btn = document.createElement('button');
            btn.className = 'symbol-btn';
            btn.innerText = symbol;
            btn.onclick = () => {
                document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                callback(symbol); // 呼叫主控邏輯切換數據
            };
            container.appendChild(btn);
        });
    }
};

// 額外增加表格專用 CSS (插入到 document)
const tableStyle = document.createElement('style');
tableStyle.innerText = `
    .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
    .data-table th { color: var(--primary); border-bottom: 2px solid #30363d; padding: 10px; }
    .data-table td { padding: 10px; border-bottom: 1px solid #30363d; }
    .symbol-btn { background: #2d333b; color: #adbac7; border: 1px solid #444c56; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
    .symbol-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    .placeholder { color: #666; font-style: italic; text-align: center; padding: 40px; }
`;
document.head.appendChild(tableStyle);
