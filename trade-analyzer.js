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
    setText("growthPeriod", acc.firstTime.toISOString().slice(0,10) + " → " + acc.lastTime.toISOString().slice(0,10));
  }
  setText("radarProfitTrades", s.profitTrades);
  setText("radarLossTrades", s.lossTrades);
  setText("radarMaxDD", s.maxDrawdown.toFixed(2));
  setText("radarActivity", s.totalTrades + " trades");
  setText("radarAlgoScore", globalEAKey);
  buildSummaryRadarChart(s);
  buildSummaryEquityChart(acc.curve);
}

function buildRadarMetricsFromStats(s) {
  if (!s) return null;
  const winRateScore = Math.min(100, Math.max(0, s.winRate * 100));
  const pfRaw = s.profitFactor === Infinity ? 5 : (s.profitFactor || 0);
  const pfScore = Math.max(0, Math.min(100, (pfRaw / 5) * 100));
  const maxDd = Math.abs(s.maxDrawdown || 0);
  const ddScore = maxDd <= 0 ? 100 : Math.max(0, 100 - Math.min(100, maxDd));
  const exp = s.expectancy || 0;
  const expScore = exp <= 0 ? 0 : Math.max(0, Math.min(100, (exp / 10) * 100));
  const avgWin = s.avgWin || 0;
  const avgLoss = Math.abs(s.avgLoss || 0);
  const avgWinScore = avgWin <= 0 ? 0 : Math.max(0, Math.min(100, (avgWin / 10) * 100));
  const avgLossScore = avgLoss <= 0 ? 100 : Math.max(0, 100 - Math.min(100, (avgLoss / 10) * 100));
  return {
    labels: ["Win Rate 勝率","Profit Factor 盈利因子","Risk (DD) 風險","Expectancy 期望值","Avg Win 平均盈利","Avg Loss 平均虧損"],
    values: [winRateScore, pfScore, ddScore, expScore, avgWinScore, avgLossScore]
  };
}

function buildSummaryRadarChart(s) {
  const ctx = document.getElementById("radarChart");
  if (!ctx) return;
  if (radarChart) { radarChart.destroy(); radarChart = null; }
  const radarData = buildRadarMetricsFromStats(s);
  if (!radarData) return;
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: radarData.labels,
      datasets: [{
        label: "EA Performance",
        data: radarData.values,
        backgroundColor: "rgba(157,78,221,0.15)",
        borderColor: "#9d4edd",
        borderWidth: 2,
        pointBackgroundColor: "#9d4edd",
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: "rgba(0,0,0,0.08)" },
          grid: { color: "rgba(0,0,0,0.08)" },
          suggestedMin: 0, suggestedMax: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 10 }, color: "rgba(0,0,0,0.7)" }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function buildSummaryEquityChart(curve) {
  const ctx = document.getElementById("equityChart");
  if (!ctx) return;
  if (equityChart) { equityChart.destroy(); equityChart = null; }
  if (!curve || !curve.length) return;
  equityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: curve.map((p) => p.x),
      datasets: [{
        label: "Equity",
        data: curve.map((p) => p.y),
        borderColor: "#0d9fff",
        backgroundColor: "rgba(13,159,255,0.10)",
        tension: 0.25, borderWidth: 2, pointRadius: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 6, color: "rgba(0,0,0,0.5)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(0,0,0,0.5)" }, grid: { color: "rgba(0,0,0,0.06)" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderAccountStatistics(s) {
  const el = document.getElementById("accountStats");
  if (!el || !s) return;
  const pf = s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2);
  el.innerHTML = `
    <table style="font-size:13px;width:100%;border-collapse:collapse;">
      <tr><td>Total Trades</td><td><b>${s.totalTrades}</b></td></tr>
      <tr><td>Win Rate</td><td><b>${(s.winRate*100).toFixed(1)}%</b></td></tr>
      <tr><td>Profit Factor</td><td><b>${pf}</b></td></tr>
      <tr><td>Expectancy</td><td><b>${s.expectancy.toFixed(2)}</b></td></tr>
      <tr><td>Gross Profit</td><td><b style="color:#06d6a0">${s.grossProfit.toFixed(2)}</b></td></tr>
      <tr><td>Gross Loss</td><td><b style="color:#ef476f">${s.grossLoss.toFixed(2)}</b></td></tr>
      <tr><td>Net Profit</td><td><b>${(s.grossProfit-s.grossLoss).toFixed(2)}</b></td></tr>
      <tr><td>Max Drawdown</td><td><b>${s.maxDrawdown.toFixed(2)}</b></td></tr>
      <tr><td>Max Consec. Loss</td><td><b>${s.maxConsecLoss}</b></td></tr>
      <tr><td>Avg Win</td><td><b>${s.avgWin.toFixed(2)}</b></td></tr>
      <tr><td>Avg Loss</td><td><b>${s.avgLoss.toFixed(2)}</b></td></tr>
      <tr><td>Avg Holding (hrs)</td><td><b>${s.avgHolding.toFixed(1)}</b></td></tr>
    </table>`;
}

function renderMinimumArea(s) {
  const el = document.getElementById("minimumArea");
  if (!el || !s) return;
  el.innerHTML = `<div style="font-size:12px;color:var(--txt2);margin-top:8px;">
    Avg MFE: <b>${s.avgMFE.toFixed(2)}</b> &nbsp;|&nbsp;
    Avg MAE: <b>${s.avgMAE.toFixed(2)}</b> &nbsp;|&nbsp;
    Total Pips: <b>${s.totalPips.toFixed(1)}</b>
  </div>`;
}

function renderSymbolButtons() {
  const container = document.getElementById("symbolButtons");
  if (!container) return;
  container.innerHTML = "";
  const symbols = ["ALL", ...Object.keys(globalBySymbol)];
  symbols.forEach((sym) => {
    const btn = document.createElement("button");
    btn.textContent = sym;
    btn.className = "symbol-btn";
    btn.addEventListener("click", () => {
      document.querySelectorAll(".symbol-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderSymbol(sym);
    });
    container.appendChild(btn);
  });
  const first = container.querySelector(".symbol-btn");
  if (first) first.classList.add("active");
}

function renderSymbolMiniCharts() {
  const container = document.getElementById("symbolMiniCharts");
  if (!container) return;
  container.innerHTML = "";
  Object.values(miniCharts).forEach((c) => { if (c) c.destroy(); });
  miniCharts = {};
  Object.keys(globalBySymbol).forEach((sym) => {
    const trades = globalBySymbol[sym];
    let cum = 0;
    const curve = trades.map((t) => { cum += t.profit; return cum; });
    const wrapper = document.createElement("div");
    wrapper.className = "mini-chart-item";
    wrapper.innerHTML = `<div class="mini-chart-label">${sym}</div>anvas id="mini_${sym}" height="60"></canvas>`;
    container.appendChild(wrapper);
    const ctx = document.getElementById("mini_" + sym);
    if (!ctx) return;
    miniCharts[sym] = new Chart(ctx, {
      type: "line",
      data: {
        labels: curve.map((_, i) => i),
        datasets: [{
          data: curve,
          borderColor: curve[curve.length-1] >= 0 ? "#06d6a0" : "#ef476f",
          borderWidth: 1.5, pointRadius: 0, fill: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { display: false }, y: { display: false } },
        plugins: { legend: { display: false } }
      }
    });
  });
}

function renderSymbol(sym) {
  const trades = sym === "ALL" ? globalTrades : (globalBySymbol[sym] || []);
  const s = buildStats(trades);
  const titleEl = document.getElementById("symbolTitle");
  if (titleEl) titleEl.textContent = "5. Symbol 深入分析 📊 – " + sym;
  const detailSection = document.getElementById("symbolDetailSection");
  if (detailSection) detailSection.style.display = "block";
  expandBody("symbolDetailBody");
  const statsEl = document.getElementById("symbolStats");
  if (statsEl && s) {
    const pf = s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2);
    statsEl.innerHTML = `
      <table style="font-size:12px;width:100%;border-collapse:collapse;">
        <tr><td>Trades</td><td><b>${s.totalTrades}</b></td></tr>
        <tr><td>Win Rate</td><td><b>${(s.winRate*100).toFixed(1)}%</b></td></tr>
        <tr><td>PF</td><td><b>${pf}</b></td></tr>
        <tr><td>Net P/L</td><td><b>${(s.grossProfit-s.grossLoss).toFixed(2)}</b></td></tr>
        <tr><td>Max DD</td><td><b>${s.maxDrawdown.toFixed(2)}</b></td></tr>
      </table>`;
  }
  renderSymbolCumulativeChart(trades, sym);
  renderSymbolWeekdayCharts(trades);
  renderSymbolHourlyCharts(trades);
}

function renderSymbolCumulativeChart(trades, sym) {
  const ctx = document.getElementById("symbolCumulativeChart");
  if (!ctx) return;
  if (symbolCumulativeChart) { symbolCumulativeChart.destroy(); symbolCumulativeChart = null; }
  let cum = 0;
  const data = trades.map((t) => { cum += t.profit; return cum; });
  const labels = trades.map((t) => t.closeTime ? t.closeTime.toISOString().slice(0,10) : "");
  symbolCumulativeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: sym, data, borderColor: "#0d9fff", backgroundColor: "rgba(13,159,255,0.08)", tension: 0.2, borderWidth: 2, pointRadius: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: "rgba(0,0,0,0.5)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(0,0,0,0.5)" }, grid: { color: "rgba(0,0,0,0.06)" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderSymbolWeekdayCharts(trades) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const profit = new Array(7).fill(0);
  const count = new Array(7).fill(0);
  trades.forEach((t) => {
    if (!t.closeTime) return;
    const d = t.closeTime.getDay();
    profit[d] += t.profit;
    count[d]++;
  });
  const ctxP = document.getElementById("symbolWeekdayProfitChart");
  const ctxC = document.getElementById("symbolWeekdayCountChart");
  if (ctxP) {
    if (symbolWeekdayProfitChart) { symbolWeekdayProfitChart.destroy(); symbolWeekdayProfitChart = null; }
    symbolWeekdayProfitChart = new Chart(ctxP, {
      type: "bar",
      data: {
        labels: days,
        datasets: [{ label: "Profit", data: profit, backgroundColor: profit.map((v) => v >= 0 ? "rgba(6,214,160,0.7)" : "rgba(239,71,111,0.7)") }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "rgba(0,0,0,0.5)" } }, y: { ticks: { color: "rgba(0,0,0,0.5)" } } } }
    });
  }
  if (ctxC) {
    if (symbolWeekdayCountChart) { symbolWeekdayCountChart.destroy(); symbolWeekdayCountChart = null; }
    symbolWeekdayCountChart = new Chart(ctxC, {
      type: "bar",
      data: {
        labels: days,
        datasets: [{ label: "Trades", data: count, backgroundColor: "rgba(13,159,255,0.7)" }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "rgba(0,0,0,0.5)" } }, y: { ticks: { color: "rgba(0,0,0,0.5)" } } } }
    });
  }
}

function renderSymbolHourlyCharts(trades) {
  const profit = new Array(24).fill(0);
  const count = new Array(24).fill(0);
  trades.forEach((t) => {
    if (!t.closeTime) return;
    const h = t.closeTime.getHours();
    profit[h] += t.profit;
    count[h]++;
  });
  const hours = Array.from({length: 24}, (_, i) => i + "h");
  const ctxP = document.getElementById("symbolHourlyProfitChart");
  const ctxC = document.getElementById("symbolHourlyCountChart");
  if (ctxP) {
    if (symbolHourlyProfitChart) { symbolHourlyProfitChart.destroy(); symbolHourlyProfitChart = null; }
    symbolHourlyProfitChart = new Chart(ctxP, {
      type: "bar",
      data: {
        labels: hours,
        datasets: [{ label: "Profit", data: profit, backgroundColor: profit.map((v) => v >= 0 ? "rgba(6,214,160,0.7)" : "rgba(239,71,111,0.7)") }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "rgba(0,0,0,0.5)", maxTicksLimit: 12 } }, y: { ticks: { color: "rgba(0,0,0,0.5)" } } } }
    });
  }
  if (ctxC) {
    if (symbolHourlyCountChart) { symbolHourlyCountChart.destroy(); symbolHourlyCountChart = null; }
    symbolHourlyCountChart = new Chart(ctxC, {
      type: "bar",
      data: {
        labels: hours,
        datasets: [{ label: "Trades", data: count, backgroundColor: "rgba(13,159,255,0.7)" }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "rgba(0,0,0,0.5)", maxTicksLimit: 12 } }, y: { ticks: { color: "rgba(0,0,0,0.5)" } } } }
    });
  }
}

function renderMartinTables() {
  const container = document.getElementById("martinTables");
  if (!container) return;
  container.innerHTML = "";
  const symbols = Object.keys(globalBySymbol);
  symbols.forEach((sym) => {
    const trades = globalBySymbol[sym];
    const buyTrades = trades.filter((t) => t.type === "buy");
    const sellTrades = trades.filter((t) => t.type === "sell");
    [["BUY", buyTrades], ["SELL", sellTrades]].forEach(([side, sideTrades]) => {
      if (!sideTrades.length) return;
      const lotGroups = {};
      sideTrades.forEach((t) => {
        const key = t.lots.toFixed(2);
        if (!lotGroups[key]) lotGroups[key] = [];
        lotGroups[key].push(t);
      });
      const levels = Object.keys(lotGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
      let cumProfit = 0;
      let firstPositiveLevel = null;
      const rows = levels.map((lot, idx) => {
        const levelTrades = lotGroups[lot];
        const s = buildStats(levelTrades);
        if (!s) return "";
        const net = s.grossProfit - s.grossLoss;
        cumProfit += net;
        if (firstPositiveLevel === null && cumProfit >= 0) firstPositiveLevel = idx;
        const rowClass = cumProfit >= 0 ? "level-safe" : "";
        return `<tr class="${rowClass}">
          <td>${idx + 1}</td>
          <td>${lot}</td>
          <td>${s.totalTrades}</td>
          <td>${(s.winRate * 100).toFixed(1)}%</td>
          <td>${net.toFixed(2)}</td>
          <td>${cumProfit.toFixed(2)}</td>
        </tr>`;
      });
      const totalNet = sideTrades.reduce((sum, t) => sum + t.profit, 0);
      const totalClass = totalNet < 0 ? "row-total-negative" : "";
      const table = document.createElement("div");
      table.innerHTML = `
        <h4 style="margin:12px 0 6px;">${sym} – ${side}</h4>
        <table class="ta-table" style="margin-bottom:16px;">
          <thead>
            <tr>
              <th>Level</th><th>Lots</th><th>Trades</th>
              <th>Win Rate</th><th>Net P/L</th><th>Cumulative P/L</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
            <tr class="${totalClass}">
              <td colspan="4"><b>TOTAL</b></td>
              <td colspan="2"><b>${totalNet.toFixed(2)}</b></td>
            </tr>
          </tbody>
        </table>`;
      container.appendChild(table);
    });
  });
}

function buildSwotData(s) {
  if (!s) return null;
  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];
  if (s.winRate >= 0.6) strengths.push("High win rate: " + (s.winRate * 100).toFixed(1) + "%");
  else weaknesses.push("Low win rate: " + (s.winRate * 100).toFixed(1) + "%");
  if (s.profitFactor >= 1.5) strengths.push("Strong profit factor: " + (s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)));
  else weaknesses.push("Weak profit factor: " + (s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)));
  if (s.maxDrawdown < 500) strengths.push("Controlled drawdown: " + s.maxDrawdown.toFixed(2));
  else threats.push("High max drawdown: " + s.maxDrawdown.toFixed(2));
  if (s.expectancy > 0) opportunities.push("Positive expectancy: " + s.expectancy.toFixed(2));
  else threats.push("Negative expectancy: " + s.expectancy.toFixed(2));
  if (s.maxConsecLoss >= 5) threats.push("Max consecutive loss: " + s.maxConsecLoss);
  else opportunities.push("Low consecutive loss: " + s.maxConsecLoss);
  return { strengths, weaknesses, opportunities, threats };
}

function renderSwot(swot) {
  if (!swot) return;
  const setSwot = (id, items) => {
    const el = document.getElementById(id);
    if (!el) return;
    const existing = el.querySelector(".swot-title");
    const title = existing ? existing.outerHTML : "";
    el.innerHTML = title + (items.length
      ? items.map((i) => `<div class="swot-item">• ${i}</div>`).join("")
      : `<div class="swot-item" style="opacity:0.5;">–</div>`);
  };
  setSwot("swotS", swot.strengths);
  setSwot("swotW", swot.weaknesses);
  setSwot("swotO", swot.opportunities);
  setSwot("swotT", swot.threats);
  setSwot("swotST", [...swot.strengths.slice(0,1), ...swot.threats.slice(0,1)]);
  setSwot("swotSW", [...swot.strengths.slice(0,1), ...swot.weaknesses.slice(0,1)]);
  setSwot("swotOT", [...swot.opportunities.slice(0,1), ...swot.threats.slice(0,1)]);
  setSwot("swotOW", [...swot.opportunities.slice(0,1), ...swot.weaknesses.slice(0,1)]);
  const centerEl = document.getElementById("swotCenterText");
  if (centerEl) centerEl.innerHTML = `<strong>${globalEAKey}</strong><br>SWOT`;
}

function renderEquityGrowthDashboard() {
  const acc = buildAccountSummary();
  if (!acc || !acc.curve || !acc.curve.length) return;
  const ctx = document.getElementById("taEquityChart");
  if (!ctx) return;
  if (window._taEquityChart) { window._taEquityChart.destroy(); window._taEquityChart = null; }
  window._taEquityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: acc.curve.map((p) => p.x),
      datasets: [{
        label: "Equity",
        data: acc.curve.map((p) => p.y),
        borderColor: "#0d9fff",
        backgroundColor: "rgba(13,159,255,0.12)",
        tension: 0.25, borderWidth: 2, pointRadius: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 6, color: "rgba(0,0,0,0.5)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(0,0,0,0.5)" }, grid: { color: "rgba(0,0,0,0.06)" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderEaRadarDashboard() {
  const stats = buildStats(globalTrades || []);
  const radarData = buildRadarMetricsFromStats(stats);
  const ctx = document.getElementById("taRadarChart");
  if (!ctx || !radarData) return;
  if (window._taRadarChart) { window._taRadarChart.destroy(); window._taRadarChart = null; }
  window._taRadarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: radarData.labels,
      datasets: [{
        label: "EA Performance",
        data: radarData.values,
        backgroundColor: "rgba(157,78,221,0.15)",
        borderColor: "#9d4edd",
        borderWidth: 2,
        pointBackgroundColor: "#9d4edd",
        pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: "rgba(0,0,0,0.08)" },
          grid: { color: "rgba(0,0,0,0.08)" },
          suggestedMin: 0, suggestedMax: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 11 }, color: "rgba(0,0,0,0.7)" }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderSymbolPerfDashboard() {
  const acc = buildAccountSummary();
  const ctx = document.getElementById("taSymbolChart");
  if (!ctx || !acc || !acc.symbolRanking || !acc.symbolRanking.length) return;
  if (window._taSymbolChart) { window._taSymbolChart.destroy(); window._taSymbolChart = null; }
  const labels = acc.symbolRanking.map((r) => r[0]);
  const data = acc.symbolRanking.map((r) => r[1]);
  window._taSymbolChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Net P/L",
        data,
        backgroundColor: data.map((v) => v >= 0 ? "rgba(6,214,160,0.7)" : "rgba(239,71,111,0.7)")
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: "rgba(0,0,0,0.5)" } },
        y: { ticks: { color: "rgba(0,0,0,0.5)" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderTaDetailsTable(view) {
  const tbody = document.getElementById("taTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (view === "symbol") {
    const acc = buildAccountSummary();
    if (!acc || !acc.symbolRanking) return;
    acc.symbolRanking.forEach(([sym]) => {
      const trades = globalBySymbol[sym] || [];
      const s = buildStats(trades);
      if (!s) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${globalEAKey}</td>
        <td>${sym}</td>
        <td>${s.totalTrades}</td>
        <td>${(s.winRate*100).toFixed(1)}%</td>
        <td>${(s.grossProfit-s.grossLoss).toFixed(2)}</td>
        <td>${s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)}</td>
        <td>${s.maxDrawdown.toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
  } else {
    const s = buildStats(globalTrades || []);
    if (!s) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${globalEAKey}</td>
      <td>ALL</td>
      <td>${s.totalTrades}</td>
      <td>${(s.winRate*100).toFixed(1)}%</td>
      <td>${(s.grossProfit-s.grossLoss).toFixed(2)}</td>
      <td>${s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)}</td>
      <td>${s.maxDrawdown.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  }
}

function initTradeAnalyzerModal() {
  const modal = document.getElementById("taChartModal");
  if (!modal) return;
  const backdrop = modal.querySelector(".ta-modal-backdrop");
  const closeBtn = document.getElementById("taModalClose");
  const titleEl = document.getElementById("taModalTitle");
  const chartContainer = document.getElementById("taModalChartContainer");

  document.addEventListener("click", (e) => {
    const shell = e.target.closest(".ta-chart-shell");
    if (!shell) return;
    openTaChartModal(shell.dataset.chart);
  });

  const close = () => {
    modal.classList.remove("open");
        if (chartContainer) chartContainer.innerHTML = "";
  };

  if (backdrop) backdrop.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  window.openTaChartModal = function(type) {
    if (!modal || !chartContainer || !titleEl) return;
    const titles = {
      equity: "Equity Growth 資金曲線（放大）",
      radar: "EA Radar 策略雷達圖（放大）",
      symbol: "Symbol Performance 品種表現（放大）"
    };
    titleEl.textContent = titles[type] || "Chart";
    chartContainer.innerHTML = '<div style="height:420px;">anvas id="taModalCanvas"></canvas></div>';
    const modalCtx = document.getElementById("taModalCanvas");
    if (!modalCtx) { modal.classList.add("open"); return; }

    if (type === "equity") {
      const acc = buildAccountSummary();
      if (acc && acc.curve && acc.curve.length) {
        new Chart(modalCtx, {
          type: "line",
          data: {
            labels: acc.curve.map((p) => p.x),
            datasets: [{
              label: "Equity",
              data: acc.curve.map((p) => p.y),
              borderColor: "#0d9fff",
              backgroundColor: "rgba(13,159,255,0.15)",
              tension: 0.25, borderWidth: 2, pointRadius: 0
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { ticks: { maxTicksLimit: 10, color: "rgba(255,255,255,0.7)" }, grid: { display: false } },
              y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.1)" } }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    } else if (type === "radar") {
      const stats = buildStats(globalTrades || []);
      const radarData = buildRadarMetricsFromStats(stats);
      if (radarData) {
        new Chart(modalCtx, {
          type: "radar",
          data: {
            labels: radarData.labels,
            datasets: [{
              label: "EA Performance",
              data: radarData.values,
              backgroundColor: "rgba(157,78,221,0.20)",
              borderColor: "#f72585",
              borderWidth: 2,
              pointBackgroundColor: "#f72585",
              pointRadius: 3
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              r: {
                angleLines: { color: "rgba(255,255,255,0.15)" },
                grid: { color: "rgba(255,255,255,0.15)" },
                suggestedMin: 0, suggestedMax: 100,
                ticks: { display: false },
                pointLabels: { font: { size: 12 }, color: "rgba(255,255,255,0.9)" }
              }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    } else if (type === "symbol") {
      const acc = buildAccountSummary();
      if (acc && acc.symbolRanking && acc.symbolRanking.length) {
        const labels = acc.symbolRanking.map((r) => r[0]);
        const data = acc.symbolRanking.map((r) => r[1]);
        new Chart(modalCtx, {
          type: "bar",
          data: {
            labels,
            datasets: [{
              label: "Net P/L",
              data,
              backgroundColor: data.map((v) => v >= 0 ? "rgba(6,214,160,0.8)" : "rgba(239,71,111,0.8)")
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: "rgba(255,255,255,0.7)" } },
              y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.1)" } }
            },
            plugins: { legend: { display: false } }
          }
        });
      }
    }

    modal.classList.add("open");
  };
}
