// trade-analyzer.js
// v0.0260308003 + sort-by-closeTime + sync body theme + Martin + MFE/MAE + SWOT center id

let globalTrades = [];
let globalBySymbol = {};
let globalEAKey = "SMA";

let equityChart, weekdayChart, symbolProfitChart;
let mfeChart, maeChart, holdingChart;
let symbolCumulativeChart,
  symbolWeekdayProfitChart,
  symbolWeekdayCountChart,
  symbolHourlyProfitChart,
  symbolHourlyCountChart;
let radarChart;

let mfeMaeMode = "pips"; // "pips" | "money"
let cumulativeMode = "all"; // "all" | "separate"

// ---------- Theme Switch (Ã¨Â·Å¸ AI Signals HubÃ¯Â¼Å’Ã§â€Â¨ body.data-theme) ----------
(function setupThemeSwitch() {
  const body = document.body;
  const themeInput = document.getElementById("themeSwitch");
  if (!themeInput || !body) return;

  const saved =
    body.dataset.theme || localStorage.getItem("theme") || "light";
  body.dataset.theme = saved;
  themeInput.checked = saved === "dark";

  themeInput.addEventListener("change", () => {
    const theme = themeInput.checked ? "dark" : "light";
    body.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  });
})();

// ---------- Cumulative Switch (All / Separate) ----------
(function setupCumSwitch() {
  const cumInput = document.getElementById("cumSwitch");
  if (!cumInput) return;

  cumulativeMode = "all";
  cumInput.checked = false;

  cumInput.addEventListener("change", () => {
    cumulativeMode = cumInput.checked ? "separate" : "all";

    const activeSymbolBtn = document.querySelector(".symbol-btn.active");
    const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
    const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
    renderSymbolExtraCharts(sym, trades);
  });
})();

// Analyze button
const analyzeBtn = document.getElementById("analyzeBtn");
if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);

// Reset button
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) resetBtn.addEventListener("click", resetView);

// Pips / Money switch for MFE/MAE/Holding
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-mode");
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (!mode || mode === mfeMaeMode) return;
  mfeMaeMode = mode;

  document
    .querySelectorAll(".toggle-mode")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

  const activeSymbolBtn = document.querySelector(".symbol-btn.active");
  const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
  const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
  renderMfeMaeHoldingCharts(trades);
});

function handleAnalyze() {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput ? fileInput.files[0] : null;
  if (!file) {
    alert("Ã¨Â«â€¹Ã¥â€¦Ë†Ã©ÂÂ¸Ã¦â€œâ€¡ CSV Ã¦Âªâ€Ã¦Â¡Ë†");
    return;
  }
  const eaSelect = document.getElementById("eaSelect");
  globalEAKey = eaSelect ? eaSelect.value : "SMA";

  const reader = new FileReader();
  reader.onload = (e) => {
    parseCsv(e.target.result);
    buildAll();
  };
  reader.readAsText(file);
}

// ---------- CSV Ã¨Â§Â£Ã¦Å¾ÂÃ¯Â¼Ë†Ã¦Å’â€° closeTime Ã§â€Â±Ã¦Å“â‚¬Ã¨Ë†Å Ã¥Ë†Â°Ã¦Å“â‚¬Ã¦â€“Â°Ã¯Â¼â€° ----------
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) {
    globalTrades = [];
    globalBySymbol = {};
    return;
  }

  const headers = lines[0].split(",");
  const idx = (name) =>
    headers.findIndex(
      (h) => h.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const iOpenTime =
    idx("open time") !== -1 ? idx("open time") : idx("Open Time");
  const iCloseTime =
    idx("close time") !== -1 ? idx("close time") : idx("Close Time");
  const iType = idx("type");
  const iLots = idx("lots") !== -1 ? idx("lots") : idx("volume");
  const iSymbol = idx("symbol");
  const iNetProfit =
    idx("net profit") !== -1 ? idx("net profit") : idx("profit");
  const iNetPips = idx("net pips") !== -1 ? idx("net pips") : idx("pips");
  const iMFE = idx("mfe") !== -1 ? idx("mfe") : idx("max profit pips");
  const iMAE = idx("mae") !== -1 ? idx("mae") : idx("max loss pips");
  const iHold = idx("holding time") !== -1 ? idx("holding time") : -1;

  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const rowRaw = lines[i];
    if (!rowRaw.trim()) continue;
    const cells = rowRaw.split(",");

    if (iType < 0 || iSymbol < 0) continue;

    const type = (cells[iType] || "").trim().toLowerCase();
    if (type !== "buy" && type !== "sell") continue;

    const t = {
      openTime: iOpenTime >= 0 ? cells[iOpenTime] || "" : "",
      closeTime: iCloseTime >= 0 ? cells[iCloseTime] || "" : "",
      type,
      symbol: (cells[iSymbol] || "").trim(),
      lots: iLots >= 0 ? parseFloat(cells[iLots] || "0") || 0 : 0,
      netProfit:
        iNetProfit >= 0 ? parseFloat(cells[iNetProfit] || "0") || 0 : 0,
      netPips: iNetPips >= 0 ? parseFloat(cells[iNetPips] || "0") || 0 : 0,
      mfe: iMFE >= 0 ? parseFloat(cells[iMFE] || "0") || 0 : 0,
      mae: iMAE >= 0 ? parseFloat(cells[iMAE] || "0") || 0 : 0,
      holdingRaw: iHold === -1 ? "" : cells[iHold] || ""
    };
    t.holdingDays = parseHoldingToDays(t.holdingRaw);
    trades.push(t);
  }

  globalTrades = trades;
  globalTrades.sort((a, b) => {
    const da = new Date(a.closeTime || a.openTime);
    const db = new Date(b.closeTime || b.openTime);
    return da - db;
  });

  globalBySymbol = groupBySymbol(globalTrades);
}

function parseHoldingToDays(text) {
  if (!text) return 0;
  const t = text.toLowerCase().trim();
  if (t.endsWith("days") || t.endsWith("day")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v;
  }
  if (t.endsWith("hrs") || t.endsWith("hours") || t.endsWith("hr")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v / 24.0;
  }
  return 0;
}

function groupBySymbol(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.symbol) continue;
    if (!map[t.symbol]) map[t.symbol] = [];
    map[t.symbol].push(t);
  }
  return map;
}

// ---------- Ã¥Å¸ÂºÃ¦Å“Â¬Ã§ÂµÂ±Ã¨Â¨Ë† ----------
function buildStats(trades) {
  const totalTrades = trades.length;
  if (!totalTrades) return null;

  let grossProfit = 0;
  let grossLoss = 0;
  let profitTrades = 0;
  let lossTrades = 0;
  let maxConsecLoss = 0;
  let curConsecLoss = 0;
  let cum = 0;
  let peak = 0;
  let maxDD = 0;

  for (const t of trades) {
    const p = t.netProfit;
    if (p > 0) {
      profitTrades++;
      grossProfit += p;
      curConsecLoss = 0;
    } else if (p < 0) {
      lossTrades++;
      grossLoss += -p;
      curConsecLoss++;
      if (curConsecLoss > maxConsecLoss) maxConsecLoss = curConsecLoss;
    }

    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  const winRate = profitTrades / totalTrades || 0;
  const lossRate = lossTrades / totalTrades || 0;
  const avgWin = profitTrades ? grossProfit / profitTrades : 0;
  const avgLoss = lossTrades ? grossLoss / lossTrades : 0;
  const expectancy = avgWin * winRate - avgLoss * lossRate;
  const pf =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    totalTrades,
    grossProfit,
    grossLoss,
    profitTrades,
    lossTrades,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor: pf,
    maxDrawdown: maxDD,
    maxConsecLoss
  };
}

function buildAccountSummary() {
  const stats = buildStats(globalTrades);
  const bySymbolProfit = {};
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  let cum = 0;
  const curve = [];
  let firstTime = null;
  let lastTime = null;

  for (const t of globalTrades) {
    cum += t.netProfit;
    const ts = new Date(t.closeTime || t.openTime);
    const label = isNaN(ts.getTime()) ? "" : ts.toISOString().slice(0, 10);
    const wd = ts.getDay();
    weekdayCounts[wd]++;
    bySymbolProfit[t.symbol] = (bySymbolProfit[t.symbol] || 0) + t.netProfit;
    curve.push({ x: label, y: cum });

    if (!firstTime || ts < firstTime) firstTime = ts;
    if (!lastTime || ts > lastTime) lastTime = ts;
  }

  const symbolRanking = Object.entries(bySymbolProfit).sort(
    (a, b) => b[1] - a[1]
  );

  return { stats, weekdayCounts, symbolRanking, curve, firstTime, lastTime };
}

// ---------- Account Statistics (MT4-style text block) ----------
function renderAccountStatistics(stats) {
  const container = document.getElementById("accountStats");
  if (!container || !stats) {
    if (container) container.textContent = "";
    return;
  }

  const fmt = (v, digits = 2) =>
    typeof v === "number" ? v.toFixed(digits) : (v ?? "Ã¢â‚¬â€œ");

  const totalTrades = stats.totalTrades;
  const profitTrades = stats.profitTrades;
  const lossTrades = stats.lossTrades;
  const winRatePct = (stats.winRate * 100) || 0;
  const lossRatePct = (stats.lossRate * 100) || 0;
  const grossProfit = stats.grossProfit;
  const grossLoss = stats.grossLoss;
  const netProfit = grossProfit - grossLoss;
  const profitFactor =
    stats.profitFactor === Infinity ? "Ã¢Ë†Å¾" : fmt(stats.profitFactor, 2);
  const expectancy = fmt(stats.expectancy, 2);
  const maxDD = fmt(stats.maxDrawdown, 2);
  const maxConsecLoss = stats.maxConsecLoss;

  const html = `
    <div class="stat-line">Trades: ${totalTrades}</div>
    <div class="stat-line">Profit Trades: ${profitTrades} (${fmt(
    winRatePct,
    2
  )} %)</div>
    <div class="stat-line">Loss Trades: ${lossTrades} (${fmt(
    lossRatePct,
    2
  )} %)</div>

    <div class="stat-line">Gross Profit: ${fmt(grossProfit, 2)} USD</div>
    <div class="stat-line">Gross Loss: ${fmt(grossLoss, 2)} USD</div>
    <div class="stat-line">Net Profit: ${fmt(netProfit, 2)} USD</div>

    <div class="stat-line">Profit Factor: ${profitFactor}</div>
    <div class="stat-line">Expected Payoff: ${expectancy} USD</div>

    <div class="stat-line">Maximum consecutive losses: ${maxConsecLoss}</div>
    <div class="stat-line">Maximal drawdown: ${maxDD} USD</div>

    <div class="stat-line">Best trade: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Worst trade: Ã¢â‚¬â€œ</div>

    <div class="stat-line">Long Trades: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Short Trades: Ã¢â‚¬â€œ</div>

    <div class="stat-line">Recovery Factor: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Avg holding time: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Algo trading: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Swaps: Ã¢â‚¬â€œ</div>
    <div class="stat-line">Commission: Ã¢â‚¬â€œ</div>
  `;

  container.innerHTML = html;
}

// ---------- Collapsible ----------
document.addEventListener("click", (e) => {
  const header = e.target.closest(".collapsible-header");
  if (!header) return;

  const targetId = header.dataset.target;
  if (!targetId) return;

  const body = document.getElementById(targetId);
  if (!body) return;

  const btn = header.querySelector(".collapse-toggle");

  const isCollapsed = body.classList.toggle("collapsed");
  if (isCollapsed) {
    body.style.maxHeight = "0px";
    if (btn) btn.textContent = "Ã¯Â¼â€¹";
  } else {
    body.style.maxHeight = body.scrollHeight + "px";
    if (btn) btn.textContent = "Ã¯Â¼Â";
  }
});

function expandBody(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.remove("collapsed");
  body.style.maxHeight = body.scrollHeight + "px";
}

// === Equity Growth Chart (Chart.js) ===
function renderEquityGrowthDashboard() {
  const acc = buildAccountSummary();
  if (!acc || !acc.curve || !acc.curve.length) return;

  const ctx = document.getElementById("taEquityChart");
  if (!ctx) return;

  if (equityChart) {
    equityChart.destroy();
    equityChart = null;
  }

  const labels = acc.curve.map((p) => p.x);
  const data = acc.curve.map((p) => p.y);

  equityChart = new Chart(ctx, {
    type: "line",S
    data: {
      labels,
      datasets: [
        {
          label: "Equity / Ã¨Â³â€¡Ã©â€¡â€˜Ã¦â€ºÂ²Ã§Â·Å¡",
          data,
          borderColor: "#0d9fff",
          backgroundColor: "rgba(13,159,255,0.12)",
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { maxTicksLimit: 6, color: "rgba(0,0,0,0.55)" },
          grid: { display: false }
        },
        y: {
          ticks: { color: "rgba(0,0,0,0.55)" },
          grid: { color: "rgba(0,0,0,0.06)" }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => "Equity: " + ctx.parsed.y.toFixed(2)
          }
        }
      }
    }
  });
}

// === EA Radar (6D) Chart ===
function buildRadarMetricsFromStats(stats) {
  if (!stats) return null;

  const winRateScore = Math.min(100, Math.max(0, stats.winRate * 100));

  const pfRaw =
    stats.profitFactor === Infinity ? 5 : (stats.profitFactor || 0);
  const pfScore = Math.max(0, Math.min(100, (pfRaw / 5) * 100));

  const maxDd = Math.abs(stats.maxDrawdown || 0);
  const ddScore = maxDd <= 0 ? 100 : Math.max(0, 100 - Math.min(100, maxDd));

  const exp = stats.expectancy || 0;
  const expScore =
    exp <= 0 ? 0 : Math.max(0, Math.min(100, (exp / 10) * 100));

  const avgWin = stats.avgWin || 0;
  const avgLoss = Math.abs(stats.avgLoss || 0);
  const avgWinScore =
    avgWin <= 0 ? 0 : Math.max(0, Math.min(100, (avgWin / 10) * 100));
  const avgLossScore =
    avgLoss <= 0 ? 100 : Math.max(0, 100 - Math.min(100, (avgLoss / 10) * 100));

  return {
    labels: [
      "Win Rate Ã¥â€¹ÂÃ§Å½â€¡",
      "Profit Factor Ã§â€ºË†Ã¥Ë†Â©Ã¥â€º Ã¥Â­Â",
      "Risk (DD) Ã©Â¢Â¨Ã©Å¡Âª",
      "Expectancy Ã¦Å“Å¸Ã¦Å“â€ºÃ¥â‚¬Â¼",
      "Avg Win Ã¥Â¹Â³Ã¥Ââ€¡Ã§â€ºË†Ã¥Ë†Â©",
      "Avg Loss Ã¥Â¹Â³Ã¥Ââ€¡Ã¨â„¢Â§Ã¦ÂÂ"
    ],
    values: [
      winRateScore,
      pfScore,
      ddScore,
      expScore,
      avgWinScore,
      avgLossScore
    ]
  };
}

function renderEaRadarDashboard() {
  const stats = buildStats(globalTrades || []);
  const radarData = buildRadarMetricsFromStats(stats);
  const ctx = document.getElementById("taRadarChart");
  if (!ctx || !radarData) return;

  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: radarData.labels,
      datasets: [
        {
          label: "EA Performance / Ã§Â­â€“Ã§â€¢Â¥Ã¨Â¡Â¨Ã§ÂÂ¾",
          data: radarData.values,
          backgroundColor: "rgba(157,78,221,0.12)",
          borderColor: "#9d4edd",
          borderWidth: 2,
          pointBackgroundColor: "#9d4edd",
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: "rgba(0,0,0,0.08)" },
          grid: { color: "rgba(0,0,0,0.08)" },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { display: false },
          pointLabels: {
            font: { size: 11 },
            color: "rgba(0,0,0,0.7)"
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.label + ": " + ctx.parsed.r.toFixed(1)
          }
        }
      }
    }
  });
}

// ---------- Ã§Â¸Â½Ã¦ÂµÂÃ§Â¨â€¹ / RESET ----------
function buildAll() {
  if (!globalTrades.length) {
    alert("CSV Ã¥â€¦Â§Ã¦Â²â€™Ã¦Å“â€°Ã¦Å“â€°Ã¦â€¢Ë†Ã¤ÂºÂ¤Ã¦Ëœâ€œÃ§Â´â‚¬Ã©Å’â€ž");
    return;
  }

  // Ã§Â¬Â¬Ã¤Â¸â‚¬Ã¦Â¬Â¡Ã¦Å“â€°Ã¦â€¢Â¸Ã¦â€œÅ¡Ã¥â€¦Ë†Ã©Â¡Â¯Ã§Â¤Âº taPanel
  const taPanel = document.getElementById("taPanel");
  if (taPanel) taPanel.style.display = "block";

  const acc = buildAccountSummary();
}

  const acc = buildAccountSummary();

  renderSummaryCards(acc);
  document.getElementById("summaryCardsSection").style.display = "block";
  expandBody("summaryCardsBody");

  renderAccountStatistics(acc.stats);
  renderMinimumArea(acc.stats);

  renderSymbolButtons();
  document.getElementById("symbolSection").style.display = "block";
  renderSymbolMiniCharts();
  expandBody("symbolBody");

  renderSymbol("ALL");

  // Ã¦â€“Â° Dashboard Ã¥Å“â€“Ã¨Â¡Â¨
  renderEquityGrowthDashboard();
  renderEaRadarDashboard();
}

// === Trade Analyzer chart popup modal ===
(function setupTradeAnalyzerModal() {
  const modal = document.getElementById("taChartModal");
  if (!modal) return;

  const backdrop = modal.querySelector(".ta-modal-backdrop");
  const closeBtn = document.getElementById("taModalClose");
  const titleEl = document.getElementById("taModalTitle");
  const chartContainer = document.getElementById("taModalChartContainer");

  // Ã§â€ºÂ£Ã¨ÂÂ½Ã§Â´Â°Ã¥Å“â€“Ã¥Â®Â¹Ã¥â„¢Â¨ clickÃ¯Â¼Ë†Equity / Radar / Ã¤Â¹â€¹Ã¥Â¾Å’Ã¥ÂÂ¯Ã¤Â»Â¥Ã¥Å   SymbolÃ¯Â¼â€°
  document.addEventListener("click", (e) => {
    const shell = e.target.closest(".ta-chart-shell");
    if (!shell) return;

    const chartType = shell.dataset.chart; // "equity" | "radar" | "symbol"
    openTaChartModal(chartType);
  });

  const close = () => {
    modal.classList.remove("open");
    if (chartContainer) {
      chartContainer.innerHTML = ""; // Ã¦Â¸â€¦Ã§Â©ÂºÃ¥Â¤Â§Ã¥Å“â€“
    }
  };

  if (backdrop) backdrop.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Ã¥Â°ÂÃ¥Â¤â€“Ã¥ÂÂ¯Ã§â€Â¨Ã¯Â¼Ë†Ã¥Â¦â€šÃ¦Å¾Å“Ã¤Â¹â€¹Ã¥Â¾Å’Ã¤Â½ Ã¦Æ’Â³Ã§â€Â¨Ã¦Å’â€°Ã©Ë†â€¢Ã©â€“â€¹Ã¯Â¼â€°
  window.openTaChartModal = openTaChartModal;

  function openTaChartModal(type) {
    if (!modal || !chartContainer || !titleEl) return;

    let titleText = "";
    switch (type) {
      case "equity":
        titleText = "Equity Growth Ã¨Â³â€¡Ã©â€¡â€˜Ã¦â€ºÂ²Ã§Â·Å¡Ã¯Â¼Ë†Ã¦â€Â¾Ã¥Â¤Â§Ã¯Â¼â€°";
        break;
      case "radar":
        titleText = "EA Radar Ã§Â­â€“Ã§â€¢Â¥Ã©â€ºÂ·Ã©Ââ€Ã¥Å“â€“Ã¯Â¼Ë†Ã¦â€Â¾Ã¥Â¤Â§Ã¯Â¼â€°";
        break;
      case "symbol":
        titleText = "Symbol Performance Ã¥â€œÂÃ§Â¨Â®Ã¨Â¡Â¨Ã§ÂÂ¾Ã¯Â¼Ë†Ã¦â€Â¾Ã¥Â¤Â§Ã¯Â¼â€°";
        break;
      default:
        titleText = "Chart Ã¥Å“â€“Ã¨Â¡Â¨";
    }
    titleEl.textContent = titleText;

    // Ã¥Å“Â¨ modal Ã¥â€¦Â¥Ã©ÂÂ¢Ã¥Â»ÂºÃ§Â«â€¹Ã¤Â¸â‚¬Ã¥â‚¬â€¹ canvas Ã§â€Â¨Ã¥Å¡Å¸Ã§â€¢Â«Ã¦â€Â¾Ã¥Â¤Â§Ã¥Å“â€“
    chartContainer.innerHTML =
      '<div style="height:400px;"><canvas id="taModalChart"></canvas></div>';

    const modalCtx = document.getElementById("taModalChart");
    if (!modalCtx) {
      modal.classList.add("open");
      return;
    }

    // Ã¦ Â¹Ã¦â€œÅ¡ type Ã§â€Â¨Ã§ÂÂ¾Ã¦Å“â€° data Ã§â€¢Â«Ã¦â€Â¾Ã¥Â¤Â§Ã¥Å“â€“
    if (type === "equity") {
      renderEquityGrowthInModal(modalCtx);
    } else if (type === "radar") {
      renderEaRadarInModal(modalCtx);
    } else {
      // Ã¤Â¹â€¹Ã¥Â¾Å’Ã¥ÂÂ¯Ã¤Â»Â¥Ã¥Å   symbol performance
    }

    modal.classList.add("open");
  }

  // Ã§â€Â¨Ã¥ÂÅ’Ã¤Â¸â‚¬Ã¥Â¥â€” buildAccountSummary() data Ã§â€¢Â«Ã¦â€Â¾Ã¥Â¤Â§Ã§â€°Ë† equity
  function renderEquityGrowthInModal(ctx) {
    const acc = buildAccountSummary();
    if (!acc || !acc.curve || !acc.curve.length) return;

    const labels = acc.curve.map((p) => p.x);
    const data = acc.curve.map((p) => p.y);

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Equity / Ã¨Â³â€¡Ã©â€¡â€˜Ã¦â€ºÂ²Ã§Â·Å¡",
            data,
            borderColor: "#0d9fff",
            backgroundColor: "rgba(13,159,255,0.16)",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { maxTicksLimit: 10, color: "rgba(255,255,255,0.7)" },
            grid: { display: false }
          },
          y: {
            ticks: { color: "rgba(255,255,255,0.7)" },
            grid: { color: "rgba(255,255,255,0.15)" }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => "Equity: " + c.parsed.y.toFixed(2)
            }
          }
        }
      }
    });
  }

  // Ã§â€Â¨ buildStats() Ã¢â€ â€™ radar data Ã§â€¢Â«Ã¦â€Â¾Ã¥Â¤Â§Ã§â€°Ë† radar
  function renderEaRadarInModal(ctx) {
    const stats = buildStats(globalTrades || []);
    const radarData = buildRadarMetricsFromStats(stats);
    if (!radarData) return;

    new Chart(ctx, {
      type: "radar",
      data: {
        labels: radarData.labels,
        datasets: [
          {
            label: "EA Performance / Ã§Â­â€“Ã§â€¢Â¥Ã¨Â¡Â¨Ã§ÂÂ¾",
            data: radarData.values,
            backgroundColor: "rgba(157,78,221,0.20)",
            borderColor: "#f72585",
            borderWidth: 2,
            pointBackgroundColor: "#f72585",
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: "rgba(255,255,255,0.15)" },
            grid: { color: "rgba(255,255,255,0.15)" },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { display: false },
            pointLabels: {
              font: { size: 11 },
              color: "rgba(255,255,255,0.85)"
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                c.label + ": " + c.parsed.r.toFixed(1)
            }
          }
        }
      }
    });
  }
})();

function resetView() {
  globalTrades = [];
  globalBySymbol = {};
  globalEAKey = "SMA";
  mfeMaeMode = "pips";
  cumulativeMode = "all";

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  equityChart = weekdayChart = symbolProfitChart = null;
  mfeChart = maeChart = holdingChart = null;
  symbolCumulativeChart =
    symbolWeekdayProfitChart =
    symbolWeekdayCountChart =
    symbolHourlyProfitChart =
    symbolHourlyCountChart =
      null;

  const hideIds = [
    "summaryCardsSection",
    "accountSection",
    "symbolSection",
    "symbolDetailSection",
    "swotSection",
    "martinSection"
  ];
  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const clearIds = [
    "accountStats",
    "symbolButtons",
    "symbolMiniCharts",
    "symbolStats",
    "martinTables",
    "minimumArea",
    "swotST",
    "swotS",
    "swotSW",
    "swotT",
    "swotW",
    "swotOT",
    "swotO",
    "swotOW",
    "eaCenterAnalysis"
  ];
  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const summaryDefaults = {
    growthValue: "0 %",
    growthPeriod: "",
    radarAlgo: "EA Radar",
    radarProfitTrades: "",
    radarLossTrades: "",
    radarMaxDD: "",
    radarPF: "",
    radarActivity: "",
    equityValue: "0.00",
    profitValue: "0.00",
    initialDepositValue: "0.00"
  };
  Object.entries(summaryDefaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
  const equityBar = document.getElementById("equityBar");
  const profitBar = document.getElementById("profitBar");
  if (equityBar) equityBar.style.width = "0%";
  if (profitBar) profitBar.style.width = "0%";

  const fileInput = document.getElementById("csvFile");
  if (fileInput) fileInput.value = "";
  const eaSelect = document.getElementById("eaSelect");
  if (eaSelect) eaSelect.value = "SMA";

  const symbolTitle = document.getElementById("symbolTitle");
  if (symbolTitle) symbolTitle.textContent = "5. Symbol Ã¦Â·Â±Ã¥â€¦Â¥Ã¥Ë†â€ Ã¦Å¾Â Ã°Å¸â€œÅ ";

  const eaTag = document.getElementById("eaTag");
  if (eaTag) eaTag.textContent = "EA";

  document
    .querySelectorAll(".toggle-mode")
    .forEach((b) => b.classList.remove("active"));
  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add("active");

  const themeInput = document.getElementById("themeSwitch");
  if (themeInput) {
    themeInput.checked = false;
    document.body.dataset.theme = "light";
    localStorage.setItem("theme", "light");
  }

  const cumInput = document.getElementById("cumSwitch");
  if (cumInput) cumInput.checked = false;
  cumulativeMode = "all";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Ã¥Â¸Â³Ã¦Ë†Â¶Ã¦â€˜ËœÃ¨Â¦ÂÃ¥ÂÂ¡ ----------
function renderSummaryCards(acc) {
  const stats = acc.stats;
  const netProfit = stats.grossProfit - stats.grossLoss;
  const initialDeposit = 5000;
  const equity = initialDeposit + netProfit;

  const growthPct = (equity / initialDeposit - 1) * 100;
  const periodDays =
    acc.firstTime && acc.lastTime
      ? Math.max(
          1,
          Math.round(
            (acc.lastTime.getTime() - acc.firstTime.getTime()) /
              (1000 * 3600 * 24)
          )
        )
      : 0;
  const weeks = (periodDays / 7).toFixed(1);

  // Ã¥ÂÂ³Ã©â€šÅ  Growth Ã¦â€¢Â¸Ã¥â‚¬Â¼
  const growthEl = document.getElementById("growthValue");
  const growthPeriodEl = document.getElementById("growthPeriod");
  if (growthEl)
    growthEl.textContent = growthPct.toFixed(2) + " %";
  if (growthPeriodEl)
    growthPeriodEl.textContent =
      "Days: " + periodDays + " (Week(s): " + weeks + ")";

  const equityEl = document.getElementById("equityValue");
  const profitEl = document.getElementById("profitValue");
  const initEl = document.getElementById("initialDepositValue");
  if (equityEl) equityEl.textContent = equity.toFixed(2);
  if (profitEl) profitEl.textContent = netProfit.toFixed(2);
  if (initEl) initEl.textContent = initialDeposit.toFixed(2);

  const equityPct = Math.min(100, (equity / initialDeposit) * 20);
  const profitPct = Math.min(100, Math.abs(netProfit / initialDeposit) * 20);
  const equityBar = document.getElementById("equityBar");
  const profitBar = document.getElementById("profitBar");
  if (equityBar) equityBar.style.width = equityPct + "%";
  if (profitBar) profitBar.style.width = profitPct + "%";

  // Ã¥Â·Â¦Ã©â€šÅ  6 Ã¨Â¡Å’Ã¯Â¼Å¡Ã¦Å¡Â«Ã¦â„¢â€šÃ§â€Â¨Ã§Â°Â¡Ã¥â€“Â® stats Ã¥Â¡Â«Ã¦â€¢Â¸Ã¯Â¼Ë†Ã¦Å“ÂªÃ§â€Â¨ radar formulaÃ¯Â¼â€°
  const radarProfit = document.getElementById("radarProfitTrades");
  const radarLoss = document.getElementById("radarLossTrades");
  const radarDepositLoad = document.getElementById("radarDepositLoad");
  const radarMaxDD = document.getElementById("radarMaxDD");
  const radarActivity = document.getElementById("radarActivity");
  const radarAlgoScore = document.getElementById("radarAlgoScore");

  if (radarProfit)
    radarProfit.textContent = (stats.winRate * 100).toFixed(1) + " %";
  if (radarLoss)
    radarLoss.textContent = (stats.lossRate * 100).toFixed(1) + " %";

  // Deposit Load Ã¦Å¡Â«Ã¦â„¢â€šÃ§â€žÂ¡Ã¦â€¢Â¸Ã¦â€œÅ¡Ã¯Â¼Å’Ã§â€Â¨ 0 Ã§Â«â„¢Ã¤Â½Â
  if (radarDepositLoad) radarDepositLoad.textContent = "0.0 %";

  if (radarMaxDD)
    radarMaxDD.textContent = stats.maxDrawdown.toFixed(2);

  if (radarActivity)
    radarActivity.textContent = stats.totalTrades + " trades";

  if (radarAlgoScore)
    radarAlgoScore.textContent = "Ã¢â‚¬â€œ";
}


function renderRadarChart(accountStats) {
  const ctxEl = document.getElementById("radarChart");
  if (!ctxEl) return;

  if (radarChart) radarChart.destroy();

  const risk = accountStats.risk;
  const radar = accountStats.radar;

  const profitScore = risk.winRatePct;              // Ã¥Â¤Å¡Ã¥Â¤Å¡Ã§â€ºÅ Ã¥â€“â€ž
  const lossScore = 100 - risk.lossRatePct;         // Ã¨Â¶Å Ã¥Â°â€˜Ã¨Â¶Å Ã¥Â¥Â½
  const depositLoadPct =
    typeof risk.maxDepositLoadPct === "number"
      ? risk.maxDepositLoadPct
      : 0;
  const depositScore = 100 - Math.min(100, depositLoadPct); // Ã¥â‚¬â€°Ã¤Â½ÂÃ¥Â£â€œÃ¥Å â€ºÃ¤Â½Å½Ã¢â€ â€™Ã¥Â¥Â½

  const ddScore = 100 - Math.min(100, risk.maxDrawdownPct); // DD Ã¤Â½Å½Ã¢â€ â€™Ã¥Â¥Â½

  const activityScore = accountStats.growth.tradesPerDay * 20;
  const clippedActivity = Math.max(0, Math.min(100, activityScore));

  const algoScore = radar.algoQuality;

  const labels = [
    "Profit Trades",
    "Loss Trades",
    "Max Deposit Load",
    "Max DD",
    "Trading Activity",
    "Algo Trading"
  ];

  const data = [
    profitScore,
    lossScore,
    depositScore,
    ddScore,
    clippedActivity,
    algoScore
  ];

  radarChart = new Chart(ctxEl.getContext("2d"), {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "EA Radar",
          data,
          backgroundColor: "rgba(14, 165, 233, 0.25)",
          borderColor: "#0ea5e9",
          borderWidth: 2,
          pointBackgroundColor: "#0ea5e9",
          pointRadius: 3
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            showLabelBackdrop: false
          },
          grid: { color: "rgba(148, 163, 184, 0.4)" },
          angleLines: { color: "rgba(148, 163, 184, 0.4)" },
          pointLabels: { font: { size: 10 } }
        }
      }
    }
  });
}


// ---------- Ã¥Â¸Â³Ã¦Ë†Â¶Ã§Â¸Â½Ã¨Â¦Â½Ã¥Å“â€“Ã¨Â¡Â¨ + MINIMUM ----------
function renderAccountStats(stats) {
  const net = stats.grossProfit - stats.grossLoss;
  const el = document.getElementById("accountStats");
  el.innerHTML = `
    <div class="account-row">
      <span>Ã§Â¸Â½Ã¤ÂºÂ¤Ã¦Ëœâ€œ: ${stats.totalTrades}</span>
      <span>Ã¥â€¹ÂÃ§Å½â€¡: ${(stats.winRate * 100).toFixed(1)}%</span>
      <span>Ã¦Â·Â¨Ã§â€ºË†Ã¥Ë†Â©: ${net.toFixed(2)}</span>
      <span>Profit Factor: ${
        stats.profitFactor === Infinity ? "Ã¢Ë†Å¾" : stats.profitFactor.toFixed(2)
      }</span>
    </div>
    <div class="account-row">
      <span>Ã¦Å“Å¸Ã¦Å“â€ºÃ¥â‚¬Â¼/Ã¥â€“Â®: ${stats.expectancy.toFixed(2)}</span>
      <span>Ã¦Å“â‚¬Ã¥Â¤Â§Ã¥â€ºÅ¾Ã¦â€™Â¤: ${stats.maxDrawdown.toFixed(2)}</span>
      <span>Ã¦Å“â‚¬Ã¥Â¤Â§Ã©â‚¬Â£Ã¨â„¢Â§: ${stats.maxConsecLoss}</span>
    </div>
  `;
}

function renderMinimumArea(stats) {
  const el = document.getElementById("minimumArea");
  if (!el) return;

  el.innerHTML = `
    <div><strong>Avg Win:</strong> ${stats.avgWin.toFixed(2)}</div>
    <div><strong>Avg Loss:</strong> ${stats.avgLoss.toFixed(2)}</div>
    <div><strong>Expectancy:</strong> ${stats.expectancy.toFixed(2)}</div>
    <div><strong>Max DD:</strong> ${stats.maxDrawdown.toFixed(2)}</div>
  `;
}

function renderAccountCharts(acc) {
  const ctx1 = document.getElementById("equityChart").getContext("2d");
  const ctx2 = document.getElementById("weekdayChart").getContext("2d");
  const ctx3 = document.getElementById("symbolProfitChart").getContext("2d");

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();

  const POS = "#22d3ee";
  const NEG = "#ef476f";

  equityChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: acc.curve.map((p) => p.x),
      datasets: [
        {
          label: "Equity",
          data: acc.curve.map((p) => p.y),
          borderColor: "#0b5c7f",
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      scales: {
        x: {
          type: "category",
          title: { display: true, text: "Ã¦â„¢â€šÃ©â€“â€œ (Ã¦Å’â€°Ã¤ÂºÂ¤Ã¦Ëœâ€œÃ© â€ Ã¥ÂºÂ)" },
          ticks: { maxTicksLimit: 10 }
        },
        y: { title: { display: true, text: "Ã§Â´Â¯Ã§Â©Â Profit" } }
      }
    }
  });

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdayChart = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "Ã¤ÂºÂ¤Ã¦Ëœâ€œÃ¦â€¢Â¸",
          data: acc.weekdayCounts,
          backgroundColor: POS
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Ã¥â€“Â®Ã¦â€¢Â¸" } }
      }
    }
  });

  const labels = acc.symbolRanking.map((r) => r[0]);
  const data = acc.symbolRanking.map((r) => r[1]);
  symbolProfitChart = new Chart(ctx3, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Ã¦Â·Â¨Ã§â€ºË†Ã¥Ë†Â©",
          data,
          backgroundColor: data.map((v) => (v >= 0 ? POS : NEG))
        }
      ]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { title: { display: true, text: "Profit" } }
      }
    }
  });
}

// ---------- Symbol Ã¦Å’â€°Ã©Ë†â€¢ + Ã¨Â©Â³Ã§Â´Â° ----------
function renderSymbolButtons() {
  const container = document.getElementById("symbolButtons");
  container.innerHTML = "";

  const symbols = Object.keys(globalBySymbol).sort();

  const allStats = buildStats(globalTrades);
  const allNet = allStats.grossProfit - allStats.grossLoss;
  const allBtn = document.createElement("button");
  allBtn.className = "symbol-btn active";
  allBtn.dataset.symbol = "ALL";
  allBtn.innerHTML = `
    <span>All Symbols</span>
    <span class="value">${allNet.toFixed(0)}</span>
  `;
  allBtn.onclick = () => {
    [...container.querySelectorAll(".symbol-btn")].forEach((b) =>
      b.classList.remove("active")
    );
    allBtn.classList.add("active");
    renderSymbol("ALL");
  };
  container.appendChild(allBtn);

  symbols.forEach((sym) => {
    const stats = buildStats(globalBySymbol[sym]);
    const net = stats.grossProfit - stats.grossLoss;

    const btn = document.createElement("button");
    btn.className = "symbol-btn";
    btn.dataset.symbol = sym;
    btn.innerHTML = `
      <span>${sym}</span>
      <span class="value">${net.toFixed(0)}</span>
    `;
    btn.onclick = () => {
      [...container.querySelectorAll(".symbol-btn")].forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      renderSymbol(sym);
    };
    container.appendChild(btn);
  });
}

function renderSymbol(symbol) {
  const trades = symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
  if (!trades.length) return;

  document.getElementById("symbolDetailSection").style.display = "block";
  document.getElementById("swotSection").style.display = "block";
  expandBody("symbolDetailBody");
  expandBody("swotBody");

  document.getElementById("symbolTitle").textContent =
    symbol === "ALL"
      ? "5. Symbol Ã¦Â·Â±Ã¥â€¦Â¥Ã¥Ë†â€ Ã¦Å¾Â Ã°Å¸â€œÅ  Ã¢â‚¬â€œ All Symbols"
      : `5. Symbol Ã¦Â·Â±Ã¥â€¦Â¥Ã¥Ë†â€ Ã¦Å¾Â Ã°Å¸â€œÅ  Ã¢â‚¬â€œ ${symbol}`;

  const cumWrap = document.getElementById("cumSwitchWrapper");
  if (cumWrap) {
    if (symbol === "ALL") {
      cumWrap.style.display = "inline-flex";
    } else {
      cumWrap.style.display = "none";
    }
  }

  const stats = buildStats(trades);
  renderSymbolStats(stats);

  const rule = EA_RULES[globalEAKey] || EA_RULES.OtherBasic;
  const eaTag = document.getElementById("eaTag");
  if (eaTag)
    eaTag.textContent =
      symbol === "ALL" ? `${rule.name} Ã¢â‚¬â€œ Ã¥â€¦Â¨Ã§Âµâ€žÃ¥ÂË†` : rule.name;

  let martinSummary = null;

  if (rule.martin && symbol !== "ALL") {
    const m = buildMartinForSymbol(trades);
    martinSummary = m.martinSummary;
    renderMartinTables(symbol, m.tablePerSide);
    document.getElementById("martinSection").style.display = "block";
  } else {
    document.getElementById("martinSection").style.display = "none";
  }

  renderMfeMaeHoldingCharts(trades);
  renderSymbolExtraCharts(symbol, trades);

  const swot = buildSwotForEA(globalEAKey, symbol, stats, martinSummary);
  renderSwot(swot);
}

function renderSymbolStats(stats) {
  const net = stats.grossProfit - stats.grossLoss;
  const el = document.getElementById("symbolStats");
  el.innerHTML = `
    <div class="symbol-row">
      <span>Symbol Ã¥â€“Â®Ã¦â€¢Â¸: ${stats.totalTrades}</span>
      <span>Ã¥â€¹ÂÃ§Å½â€¡: ${(stats.winRate * 100).toFixed(1)}%</span>
      <span>Ã¦Â·Â¨Ã§â€ºË†Ã¥Ë†Â©: ${net.toFixed(2)}</span>
      <span>PF: ${
        stats.profitFactor === Infinity ? "Ã¢Ë†Å¾" : stats.profitFactor.toFixed(2)
      }</span>
    </div>
    <div class="symbol-row">
      <span>Ã¦Å“Å¸Ã¦Å“â€ºÃ¥â‚¬Â¼/Ã¥â€“Â®: ${stats.expectancy.toFixed(2)}</span>
      <span>Max DD: ${stats.maxDrawdown.toFixed(2)}</span>
      <span>Ã¦Å“â‚¬Ã¥Â¤Â§Ã©â‚¬Â£Ã¨â„¢Â§: ${stats.maxConsecLoss}</span>
    </div>
  `;
}

// ---------- Martin Ã¨Â¡Â¨Ã¥Â»ÂºÃ¦Â§â€¹ ----------
// ---------- Martin Ã¨Â¡Â¨Ã¥Â»ÂºÃ¦Â§â€¹ ----------
function buildMartinForSymbol(trades) {
  const map = {};
  for (const t of trades) {
    const key = `${t.symbol}_${t.type}_${t.lots.toFixed(2)}`;
    if (!map[key]) {
      map[key] = {
        symbol: t.symbol,
        side: t.type.toUpperCase(),
        lots: t.lots,
        tradeCount: 0,
        sumProfit: 0,
        sumPips: 0,
        winCount: 0,
        lossCount: 0,
        minWinProfit: null
      };
    }
    const m = map[key];
    m.tradeCount++;
    m.sumProfit += t.netProfit;
    m.sumPips += t.netPips;

    if (t.netProfit > 0) {
      m.winCount++;
      if (m.minWinProfit === null || t.netProfit < m.minWinProfit) {
        m.minWinProfit = t.netProfit;
      }
    } else if (t.netProfit < 0) {
      m.lossCount++;
    }
  }

  const rows = Object.values(map);
  const bySide = {};
  for (const r of rows) {
    const key = `${r.symbol}_${r.side}`;
    if (!bySide[key]) bySide[key] = [];
    bySide[key].push(r);
  }

  const tablePerSide = [];
  const martinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  for (const key of Object.keys(bySide)) {
    const [symbol, side] = key.split("_");
    const arr = bySide[key].sort((a, b) => a.lots - b.lots);

    let totalProfit = 0;
    let totalPips = 0;
    let totalTrades = 0;
    let cum = 0;
    let levelIndex = 0;
    let firstPositiveLevel = null;
    const rowsOut = [];

    for (const r of arr) {
      totalProfit += r.sumProfit;
      totalPips += r.sumPips;
      totalTrades += r.tradeCount;

      levelIndex++;
      cum += r.sumProfit;
      if (cum >= 0 && firstPositiveLevel === null) {
        firstPositiveLevel = levelIndex;
      }

      const levelWinRate =
        r.tradeCount > 0 ? (r.winCount / r.tradeCount) * 100 : 0;
      const levelMinWin = r.minWinProfit;

      rowsOut.push({
        symbol,
        side,
        level: levelIndex,
        lots: r.lots,
        levelTrades: r.tradeCount,
        levelSumProfit: r.sumProfit,
        levelSumPips: r.sumPips,
        cumulativeProfit: cum,
        totalProfit,
        totalPips,
        totalTrades,
        levelWinRate,
        levelMinWin
      });
    }

    tablePerSide.push({
      symbol,
      side,
      totalProfit,
      totalPips,
      totalTrades,
      rows: rowsOut,
      firstPositiveLevel,
      maxLevel: levelIndex
    });

    martinSummary.totalProfit += totalProfit;
    if (levelIndex > martinSummary.maxLevel) {
      martinSummary.maxLevel = levelIndex;
    }
    if (totalProfit < 0) {
      martinSummary.worstSideNegative = { symbol, side, totalProfit };
    }
    if (firstPositiveLevel !== null) {
      if (
        martinSummary.firstPositiveLevel === null ||
        firstPositiveLevel < martinSummary.firstPositiveLevel
      ) {
        martinSummary.firstPositiveLevel = firstPositiveLevel;
      }
    }
  }

  return { tablePerSide, martinSummary };
}


function renderMartinTables(symbol, tablePerSide) {
  const container = document.getElementById("martinTables");
  if (!container) return;
  container.innerHTML = "";

  tablePerSide.forEach((block) => {
    const title = document.createElement("div");
    title.className = "martin-header";
    const totalClass =
      block.totalProfit < 0 ? "row-total-negative" : "row-total-positive";
    title.innerHTML = `
      <span>${block.symbol} - ${block.side}</span>
      <span style="margin-left:8px;">
        TOTAL Profit:
        <span class="${totalClass}">${block.totalProfit.toFixed(2)}</span>,
        Trades: ${block.totalTrades}
      </span>
    `;
    container.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "martin-table-wrapper";

    const table = document.createElement("table");
    table.className = "martin-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Lots</th>
          <th>Trades</th>
          <th>SUM Profit</th>
          <th>SUM Pips</th>
          <th>Cum Profit</th>
          <th>Win Rate %</th>
          <th>Min Win Profit</th>
          <th>Symbol/Side TOTAL Profit</th>
          <th>Total Trades</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    block.rows.forEach((r) => {
      const tr = document.createElement("tr");
      let cls = "";

      if (block.totalProfit < 0) {
        cls = "row-total-negative";
      } else if (
        block.firstPositiveLevel !== null &&
        r.level >= block.firstPositiveLevel
      ) {
        cls = "level-safe";
      } else {
        cls = "level-risk";
      }
      if (cls) tr.classList.add(cls);

      const winRate = r.levelWinRate || 0;
      const minWinText =
        r.levelMinWin == null ? "Ã¢â‚¬â€œ" : r.levelMinWin.toFixed(2);

      // Ã©Â«ËœÃ¥â€¹ÂÃ§Å½â€¡Ã¥Â±Â¤Ã¯Â¼Å¡Ã§Â²â€°Ã¨â€”ÂÃ¨â€°Â²
      if (winRate >= 80) {
        tr.classList.add("level-high-winrate");
      }

      tr.innerHTML = `
        <td>${r.level}</td>
        <td>${r.lots.toFixed(2)}</td>
        <td>${r.levelTrades}</td>
        <td>${r.levelSumProfit.toFixed(2)}</td>
        <td>${r.levelSumPips.toFixed(1)}</td>
        <td>${r.cumulativeProfit.toFixed(2)}</td>
        <td>${winRate.toFixed(1)}%</td>
        <td>${minWinText}</td>
        <td>${r.totalProfit.toFixed(2)}</td>
        <td>${r.totalTrades}</td>
      `;
      tbody.appendChild(tr);
    });

    wrap.appendChild(table);
    container.appendChild(wrap);
  });
}

// ---------- Symbol Ã§Â´Â¯Ã§Â©Â Profit Ã¥Â°ÂÃ¥Å“â€“ ----------
function renderSymbolMiniCharts() {
  const container = document.getElementById("symbolMiniCharts");
  container.innerHTML = "";

  addMiniChartCard(container, "All Symbols", globalTrades);

  const symbols = Object.keys(globalBySymbol).sort();
  symbols.forEach((sym) => {
    addMiniChartCard(container, sym, globalBySymbol[sym]);
  });
}

function addMiniChartCard(container, label, trades) {
  if (!trades || !trades.length) return;

  const stats = buildStats(trades);
  const net = stats.grossProfit - stats.grossLoss;

  const div = document.createElement("div");
  div.className = "mini-chart-card";

  const canvas = document.createElement("canvas");
  div.appendChild(canvas);

  const title = document.createElement("div");
  title.className = "mini-chart-title";
  title.innerHTML = `<span>${label}</span><span class="value">${net.toFixed(
    0
  )}</span>`;
  div.appendChild(title);

  container.appendChild(div);

  let cum = 0;
  const points = [];
  trades.forEach((t) => {
    cum += t.netProfit;
    points.push(cum);
  });

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: points.map((_, i) => i + 1),
      datasets: [
        {
          data: points,
          borderColor: "#22c55e",
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}

// ---------- MFE / MAE / Holding ----------
function renderMfeMaeHoldingCharts(trades) {
  const mfeCtx = document.getElementById("mfeChart");
  const maeCtx = document.getElementById("maeChart");
  const holdCtx = document.getElementById("holdingChart");
  if (!mfeCtx || !maeCtx || !holdCtx) return;

  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();

  const xKey = mfeMaeMode === "pips" ? "netPips" : "netProfit";
  const mfeData = trades.map((t) => ({
    x: t[xKey],
    y: t.mfe,
    c: t.netProfit >= 0 ? "#16a34a" : "#dc2626"
  }));
  const maeData = trades.map((t) => ({
    x: t[xKey],
    y: t.mae,
    c: t.netProfit >= 0 ? "#16a34a" : "#dc2626"
  }));
  const holdData = trades.map((t) => ({
    x: t[xKey],
    y: t.holdingDays,
    c: t.netProfit >= 0 ? "#16a34a" : "#dc2626"
  }));

  const xTitle =
    mfeMaeMode === "pips" ? "Result (Net Pips)" : "Result (Net Profit)";

  mfeChart = new Chart(mfeCtx.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "MFE vs Result",
          data: mfeData,
          backgroundColor: mfeData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: xTitle } },
        y: { title: { display: true, text: "MFE (pips)" } }
      }
    }
  });

  maeChart = new Chart(maeCtx.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "MAE vs Result",
          data: maeData,
          backgroundColor: maeData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: xTitle } },
        y: { title: { display: true, text: "MAE (pips)" } }
      }
    }
  });

  holdingChart = new Chart(holdCtx.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Holding Time vs Result",
          data: holdData,
          backgroundColor: holdData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: xTitle } },
        y: { title: { display: true, text: "Holding Time (days)" } }
      }
    }
  });
}

// ---------- Symbol Ã¦Â·Â±Ã¥â€¦Â¥Ã¥Ë†â€ Ã¦Å¾ÂÃ¯Â¼Å¡Cumulative / Weekday / Hourly ----------
function renderSymbolExtraCharts(symbol, trades) {
  const cumCtx = document.getElementById("symbolCumulativeChart");
  const wdProfitCtx = document.getElementById("symbolWeekdayProfitChart");
  const wdCountCtx = document.getElementById("symbolWeekdayCountChart");
  const hrProfitCtx = document.getElementById("symbolHourlyProfitChart");
  const hrCountCtx = document.getElementById("symbolHourlyCountChart");

  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  if (!trades || !trades.length) return;
  if (!cumCtx || !wdProfitCtx || !wdCountCtx || !hrProfitCtx || !hrCountCtx)
    return;

  const sorted = trades;
  const cumCtx2d = cumCtx.getContext("2d");

  if (symbol === "ALL" && cumulativeMode === "separate") {
    const grouped = {};
    sorted.forEach((t) => {
      if (!t.symbol) return;
      if (!grouped[t.symbol]) grouped[t.symbol] = [];
      grouped[t.symbol].push(t);
    });

    const baseColors = [
      "#22d3ee",
      "#a855f7",
      "#f97316",
      "#22c55e",
      "#eab308",
      "#ec4899",
      "#0ea5e9"
    ];
    let colorIndex = 0;
    const datasets = [];
    let maxLen = 0;

    Object.entries(grouped).forEach(([symKey, arr]) => {
      let cum = 0;
      const data = [];
      arr.forEach((t) => {
        cum += t.netProfit;
        data.push(cum);
      });
      if (data.length > maxLen) maxLen = data.length;

      const c = baseColors[colorIndex++ % baseColors.length];
      datasets.push({
        label: symKey,
        data,
        borderColor: c,
        fill: false,
        pointRadius: 0,
        tension: 0.15
      });
    });

    const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: {
        labels,
        datasets
      },
      options: {
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: "Trade Index (per Symbol)" } },
          y: { title: { display: true, text: "Profit" } }
        }
      }
    });
  } else {
    let cum = 0;
    const cumLabels = [];
    const cumData = [];
    sorted.forEach((t, idx) => {
      cum += t.netProfit;
      cumLabels.push(idx + 1);
      cumData.push(cum);
    });

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: "Cumulative Profit",
            data: cumData,
            borderColor: "#2563eb",
            fill: false,
            pointRadius: 0,
            tension: 0.15
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Trade Index" } },
          y: { title: { display: true, text: "Profit" } }
        }
      }
    });
  }

  const weekdayProfit = Array(7).fill(0);
  const weekdayCount = Array(7).fill(0);
  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const wd = isNaN(d) ? 0 : d.getDay();
    weekdayProfit[wd] += t.netProfit;
    weekdayCount[wd] += 1;
  });
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  symbolWeekdayProfitChart = new Chart(wdProfitCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "Profit",
          data: weekdayProfit,
          backgroundColor: weekdayProfit.map((v) =>
            v >= 0 ? "#22d3ee" : "#ef4444"
          )
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: "Profit" } }
      }
    }
  });

  symbolWeekdayCountChart = new Chart(wdCountCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "Count",
          data: weekdayCount,
          backgroundColor: "#6366f1"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: "Trades" }, beginAtZero: true }
      }
    }
  });

  const hourlyProfit = Array(24).fill(0);
  const hourlyCount = Array(24).fill(0);
  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const h = isNaN(d) ? 0 : d.getHours();
    hourlyProfit[h] += t.netProfit;
    hourlyCount[h] += 1;
  });
  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  symbolHourlyProfitChart = new Chart(hrProfitCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Profit",
          data: hourlyProfit,
          backgroundColor: hourlyProfit.map((v) =>
            v >= 0 ? "#22d3ee" : "#ef4444"
          )
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Hour" } },
        y: { title: { display: true, text: "Profit" } }
      }
    }
  });

  symbolHourlyCountChart = new Chart(hrCountCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Count",
          data: hourlyCount,
          backgroundColor: "#3b82f6"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Hour" } },
        y: { title: { display: true, text: "Trades" }, beginAtZero: true }
      }
    }
  });
}

// ---------- SWOT ----------
function renderSwot(swot) {
  if (!swot) return;

  document.getElementById("swotST").innerHTML =
    "<strong>ST</strong><br>" + swot.ST.join("<br>");
  document.getElementById("swotS").innerHTML =
    "<strong>S</strong><br>" + swot.S.join("<br>");
  document.getElementById("swotSW").innerHTML =
    "<strong>SW</strong><br>" + swot.SW.join("<br>");

  document.getElementById("swotT").innerHTML =
    "<strong>T</strong><br>" + swot.T.join("<br>");
  document.getElementById("swotW").innerHTML =
    "<strong>W</strong><br>" + swot.W.join("<br>");

  document.getElementById("swotOT").innerHTML =
    "<strong>OT</strong><br>" + swot.OT.join("<br>");
  document.getElementById("swotO").innerHTML =
    "<strong>O</strong><br>" + swot.O.join("<br>");
  document.getElementById("swotOW").innerHTML =
    "<strong>OW</strong><br>" + swot.OW.join("<br>");

  const eaCenterText = document.getElementById("swotCenterText");
  if (eaCenterText) {
    eaCenterText.innerHTML = swot.centerAnalysis
      ? swot.centerAnalysis.join("<br>")
      : "";
  }
}

function buildAccountSummary() {
  const stats = buildStats(globalTrades);
  if (!stats) return null;

  const bySymbolProfit = {};
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

  let cum = 0;
  const curve = [];
  let firstTime = null;
  let lastTime = null;

  for (const t of globalTrades) {
    cum += t.netProfit;

    const ts = new Date(t.closeTime || t.openTime);
    const validDate = !Number.isNaN(ts.getTime());
    const label = validDate
      ? ts.toISOString().slice(0, 10)
      : String(t.closeTime || t.openTime || '');

    if (validDate) {
      weekdayCounts[ts.getDay()] += 1;
      if (!firstTime || ts < firstTime) firstTime = ts;
      if (!lastTime || ts > lastTime) lastTime = ts;
    }

    bySymbolProfit[t.symbol] = (bySymbolProfit[t.symbol] || 0) + t.netProfit;
    curve.push({ x: label, y: cum });
  }

  const symbolRanking = Object.entries(bySymbolProfit).sort((a, b) => b[1] - a[1]);

  return {
    stats,
    weekdayCounts,
    symbolRanking,
    curve,
    firstTime,
    lastTime
  };
}

function renderSummaryCards(acc) {
  if (!acc || !acc.stats) return;

  const stats = acc.stats;
  const netProfit = stats.grossProfit - stats.grossLoss;
  const initialDeposit = 5000;
  const equity = initialDeposit + netProfit;
  const growthPct = ((equity / initialDeposit) - 1) * 100;

  const periodDays =
    acc.firstTime && acc.lastTime
      ? Math.max(
          1,
          Math.round((acc.lastTime.getTime() - acc.firstTime.getTime()) / (1000 * 3600 * 24))
        )
      : 0;

  const weeks = periodDays ? (periodDays / 7).toFixed(1) : '0.0';

  const growthEl = document.getElementById('growthValue');
  const growthPeriodEl = document.getElementById('growthPeriod');
  const equityEl = document.getElementById('equityValue');
  const profitEl = document.getElementById('profitValue');
  const initEl = document.getElementById('initialDepositValue');

  if (growthEl) growthEl.textContent = `${growthPct.toFixed(2)}%`;
  if (growthPeriodEl) growthPeriodEl.textContent = `Days ${periodDays} | Weeks ${weeks}`;
  if (equityEl) equityEl.textContent = equity.toFixed(2);
  if (profitEl) profitEl.textContent = netProfit.toFixed(2);
  if (initEl) initEl.textContent = initialDeposit.toFixed(2);

  const equityPct = Math.min(100, (equity / initialDeposit) * 20);
  const profitPct = Math.min(100, Math.abs(netProfit / initialDeposit) * 20);

  const equityBar = document.getElementById('equityBar');
  const profitBar = document.getElementById('profitBar');

  if (equityBar) equityBar.style.width = `${equityPct}%`;
  if (profitBar) profitBar.style.width = `${profitPct}%`;

  const radarProfit = document.getElementById('radarProfitTrades');
  const radarLoss = document.getElementById('radarLossTrades');
  const radarDepositLoad = document.getElementById('radarDepositLoad');
  const radarMaxDD = document.getElementById('radarMaxDD');
  const radarActivity = document.getElementById('radarActivity');
  const radarAlgoScore = document.getElementById('radarAlgoScore');

  if (radarProfit) radarProfit.textContent = (stats.winRate * 100).toFixed(1);
  if (radarLoss) radarLoss.textContent = (stats.lossRate * 100).toFixed(1);
  if (radarDepositLoad) radarDepositLoad.textContent = '0.0';
  if (radarMaxDD) radarMaxDD.textContent = stats.maxDrawdown.toFixed(2);
  if (radarActivity) radarActivity.textContent = `${stats.totalTrades} trades`;
  if (radarAlgoScore) radarAlgoScore.textContent = stats.profitFactor === Infinity
    ? '∞'
    : stats.profitFactor.toFixed(2);
}

function renderAccountStatistics(stats) {
  const container = document.getElementById('accountStats');
  if (!container) return;

  if (!stats) {
    container.textContent = '';
    return;
  }

  const fmt = (v, digits = 2) =>
    typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : String(v ?? '');

  const totalTrades = stats.totalTrades;
  const profitTrades = stats.profitTrades;
  const lossTrades = stats.lossTrades;
  const winRatePct = stats.winRate * 100;
  const lossRatePct = stats.lossRate * 100;
  const grossProfit = stats.grossProfit;
  const grossLoss = stats.grossLoss;
  const netProfit = grossProfit - grossLoss;
  const profitFactor = stats.profitFactor === Infinity ? '∞' : fmt(stats.profitFactor, 2);
  const expectancy = fmt(stats.expectancy, 2);
  const maxDD = fmt(stats.maxDrawdown, 2);
  const maxConsecLoss = stats.maxConsecLoss;

  const html = `
    <div class="stat-line">Trades ${totalTrades}</div>
    <div class="stat-line">Profit Trades ${profitTrades} (${fmt(winRatePct, 2)}%)</div>
    <div class="stat-line">Loss Trades ${lossTrades} (${fmt(lossRatePct, 2)}%)</div>
    <div class="stat-line">Gross Profit ${fmt(grossProfit, 2)} USD</div>
    <div class="stat-line">Gross Loss ${fmt(grossLoss, 2)} USD</div>
    <div class="stat-line">Net Profit ${fmt(netProfit, 2)} USD</div>
    <div class="stat-line">Profit Factor ${profitFactor}</div>
    <div class="stat-line">Expected Payoff ${expectancy} USD</div>
    <div class="stat-line">Maximum consecutive losses ${maxConsecLoss}</div>
    <div class="stat-line">Maximal drawdown ${maxDD} USD</div>
    <div class="stat-line">Best trade -</div>
    <div class="stat-line">Worst trade -</div>
    <div class="stat-line">Long Trades -</div>
    <div class="stat-line">Short Trades -</div>
    <div class="stat-line">Recovery Factor -</div>
    <div class="stat-line">Avg holding time -</div>
    <div class="stat-line">Algo trading -</div>
    <div class="stat-line">Swaps -</div>
    <div class="stat-line">Commission -</div>
  `;

  container.innerHTML = html;
}

function renderMinimumArea(stats) {
  const el = document.getElementById('minimumArea');
  if (!el || !stats) return;

  el.innerHTML = `
    <div><strong>Avg Win</strong> ${stats.avgWin.toFixed(2)}</div>
    <div><strong>Avg Loss</strong> ${stats.avgLoss.toFixed(2)}</div>
    <div><strong>Expectancy</strong> ${stats.expectancy.toFixed(2)}</div>
    <div><strong>Max DD</strong> ${stats.maxDrawdown.toFixed(2)}</div>
  `;
}

document.addEventListener('click', (e) => {
  const header = e.target.closest('.collapsible-header');
  if (!header) return;

  const targetId = header.dataset.target;
  if (!targetId) return;

  const body = document.getElementById(targetId);
  if (!body) return;

  const btn = header.querySelector('.collapse-toggle');
  const isCollapsed = body.classList.toggle('collapsed');

  if (isCollapsed) {
    body.style.maxHeight = '0px';
    if (btn) btn.textContent = '+';
  } else {
    body.style.maxHeight = `${body.scrollHeight}px`;
    if (btn) btn.textContent = '−';
  }
});

function expandBody(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.remove('collapsed');
  body.style.maxHeight = `${body.scrollHeight}px`;
}

function renderEquityGrowthDashboard() {
  const acc = buildAccountSummary();
  if (!acc || !acc.curve || !acc.curve.length) return;

  const ctx = document.getElementById('taEquityChart');
  if (!ctx) return;

  if (equityChart) {
    equityChart.destroy();
    equityChart = null;
  }

  const labels = acc.curve.map((p) => p.x);
  const data = acc.curve.map((p) => p.y);

  equityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Equity',
          data,
          borderColor: '#0d9fff',
          backgroundColor: 'rgba(13,159,255,0.12)',
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 6,
            color: 'rgba(0,0,0,0.55)'
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: 'rgba(0,0,0,0.55)'
          },
          grid: {
            color: 'rgba(0,0,0,0.06)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `Equity ${ctx.parsed.y.toFixed(2)}`
          }
        }
      }
    }
  });
}

function buildRadarMetricsFromStats(stats) {
  if (!stats) return null;

  const winRateScore = Math.min(100, Math.max(0, stats.winRate * 100));

  const pfRaw = stats.profitFactor === Infinity ? 5 : (stats.profitFactor || 0);
  const pfScore = Math.max(0, Math.min(100, (pfRaw / 5) * 100));

  const maxDd = Math.abs(stats.maxDrawdown || 0);
  const ddScore = maxDd === 0 ? 100 : Math.max(0, 100 - Math.min(100, maxDd));

  const exp = stats.expectancy || 0;
  const expScore = exp <= 0 ? 0 : Math.max(0, Math.min(100, (exp / 10) * 100));

  const avgWin = stats.avgWin || 0;
  const avgLoss = Math.abs(stats.avgLoss || 0);

  const avgWinScore = avgWin <= 0 ? 0 : Math.max(0, Math.min(100, (avgWin / 10) * 100));
  const avgLossScore = avgLoss === 0 ? 100 : Math.max(0, 100 - Math.min(100, (avgLoss / 10) * 100));

  return {
    labels: ['Win Rate', 'Profit Factor', 'Risk DD', 'Expectancy', 'Avg Win', 'Avg Loss'],
    values: [winRateScore, pfScore, ddScore, expScore, avgWinScore, avgLossScore]
  };
}

function renderEaRadarDashboard() {
  const stats = buildStats(globalTrades);
  const radarData = buildRadarMetricsFromStats(stats);
  const ctx = document.getElementById('taRadarChart');

  if (!ctx || !radarData) return;

  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radarData.labels,
      datasets: [
        {
          label: 'EA Performance',
          data: radarData.values,
          backgroundColor: 'rgba(157,78,221,0.12)',
          borderColor: '#9d4edd',
          borderWidth: 2,
          pointBackgroundColor: '#9d4edd',
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: 'rgba(0,0,0,0.08)'
          },
          grid: {
            color: 'rgba(0,0,0,0.08)'
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            display: false
          },
          pointLabels: {
            font: {
              size: 11
            },
            color: 'rgba(0,0,0,0.7)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.r.toFixed(1)}`
          }
        }
      }
    }
  });
}

function buildAll() {
  if (!globalTrades.length) {
    alert('CSV empty');
    return;
  }

  const taPanel = document.getElementById('taPanel');
  if (taPanel) taPanel.style.display = 'block';

  const acc = buildAccountSummary();
  if (!acc) return;

  renderSummaryCards(acc);

  const summaryCardsSection = document.getElementById('summaryCardsSection');
  if (summaryCardsSection) summaryCardsSection.style.display = 'block';
  expandBody('summaryCardsBody');

  renderAccountStatistics(acc.stats);
  renderMinimumArea(acc.stats);

  const symbolSection = document.getElementById('symbolSection');
  if (symbolSection) symbolSection.style.display = 'block';

  renderSymbolButtons();
  renderSymbolMiniCharts();
  expandBody('symbolBody');
  renderSymbol('ALL');

  renderEquityGrowthDashboard();
  renderEaRadarDashboard();
}

function setupTradeAnalyzerModal() {
  const modal = document.getElementById('taChartModal');
  if (!modal) return;

  const backdrop = modal.querySelector('.ta-modal-backdrop');
  const closeBtn = document.getElementById('taModalClose');
  const titleEl = document.getElementById('taModalTitle');
  const chartContainer = document.getElementById('taModalChartContainer');

  const close = () => {
    modal.classList.remove('open');
    if (chartContainer) chartContainer.innerHTML = '';
  };

  document.addEventListener('click', (e) => {
    const shell = e.target.closest('.ta-chart-shell');
    if (!shell) return;

    const chartType = shell.dataset.chart;
    if (!chartType) return;

    openTaChartModal(chartType, modal, titleEl, chartContainer);
  });

  if (backdrop) backdrop.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  window.openTaChartModal = (type) => {
    openTaChartModal(type, modal, titleEl, chartContainer);
  };
}

function openTaChartModal(type, modal, titleEl, chartContainer) {
  if (!modal || !titleEl || !chartContainer) return;

  let titleText = 'Chart';

  switch (type) {
    case 'equity':
      titleText = 'Equity Growth';
      break;
    case 'radar':
      titleText = 'EA Radar';
      break;
    case 'symbol':
      titleText = 'Symbol Performance';
      break;
    default:
      titleText = 'Chart';
  }

  titleEl.textContent = titleText;
  chartContainer.innerHTML = `<div style="height:400px;"><canvas id="taModalChart"></canvas></div>`;

  const modalCtx = document.getElementById('taModalChart');
  modal.classList.add('open');

  if (!modalCtx) return;

  if (type === 'equity') {
    renderEquityGrowthInModal(modalCtx);
  } else if (type === 'radar') {
    renderEaRadarInModal(modalCtx);
  } else if (type === 'symbol') {
    renderSymbolPerformanceInModal(modalCtx);
  }
}

function renderEquityGrowthInModal(ctx) {
  const acc = buildAccountSummary();
  if (!acc || !acc.curve || !acc.curve.length) return;

  const labels = acc.curve.map((p) => p.x);
  const data = acc.curve.map((p) => p.y);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Equity',
          data,
          borderColor: '#0d9fff',
          backgroundColor: 'rgba(13,159,255,0.16)',
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            color: 'rgba(255,255,255,0.7)'
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.7)'
          },
          grid: {
            color: 'rgba(255,255,255,0.15)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => `Equity ${c.parsed.y.toFixed(2)}`
          }
        }
      }
    }
  });
}

function renderEaRadarInModal(ctx) {
  const stats = buildStats(globalTrades);
  const radarData = buildRadarMetricsFromStats(stats);
  if (!radarData) return;

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radarData.labels,
      datasets: [
        {
          label: 'EA Performance',
          data: radarData.values,
          backgroundColor: 'rgba(157,78,221,0.20)',
          borderColor: '#f72585',
          borderWidth: 2,
          pointBackgroundColor: '#f72585',
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: 'rgba(255,255,255,0.15)'
          },
          grid: {
            color: 'rgba(255,255,255,0.15)'
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            display: false
          },
          pointLabels: {
            font: {
              size: 11
            },
            color: 'rgba(255,255,255,0.85)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => `${c.label}: ${c.parsed.r.toFixed(1)}`
          }
        }
      }
    }
  });
}

function renderSymbolPerformanceInModal(ctx) {
  const acc = buildAccountSummary();
  if (!acc || !acc.symbolRanking || !acc.symbolRanking.length) return;

  const labels = acc.symbolRanking.map((r) => r[0]);
  const data = acc.symbolRanking.map((r) => r[1]);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Profit',
          data,
          backgroundColor: data.map((v) => (v >= 0 ? '#22d3ee' : '#ef476f'))
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.75)'
          },
          grid: {
            color: 'rgba(255,255,255,0.12)'
          },
          title: {
            display: true,
            text: 'Profit',
            color: 'rgba(255,255,255,0.75)'
          }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.75)'
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function resetView() {
  globalTrades = [];
  globalBySymbol = {};
  globalEAKey = 'SMA';
  mfeMaeMode = 'pips';
  cumulativeMode = 'all';

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();
  if (radarChart) radarChart.destroy();

  equityChart = null;
  weekdayChart = null;
  symbolProfitChart = null;
  mfeChart = null;
  maeChart = null;
  holdingChart = null;
  symbolCumulativeChart = null;
  symbolWeekdayProfitChart = null;
  symbolWeekdayCountChart = null;
  symbolHourlyProfitChart = null;
  symbolHourlyCountChart = null;
  radarChart = null;

  const hideIds = [
    'summaryCardsSection',
    'accountSection',
    'symbolSection',
    'symbolDetailSection',
    'swotSection',
    'martinSection'
  ];

  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const clearIds = [
    'accountStats',
    'symbolButtons',
    'symbolMiniCharts',
    'symbolStats',
    'martinTables',
    'minimumArea',
    'swotST',
    'swotS',
    'swotSW',
    'swotT',
    'swotW',
    'swotOT',
    'swotO',
    'swotOW',
    'eaCenterAnalysis'
  ];

  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  const summaryDefaults = {
    growthValue: '0%',
    growthPeriod: '',
    radarAlgo: 'EA Radar',
    radarProfitTrades: '',
    radarLossTrades: '',
    radarMaxDD: '',
    radarPF: '',
    radarActivity: '',
    equityValue: '0.00',
    profitValue: '0.00',
    initialDepositValue: '0.00'
  };

  Object.entries(summaryDefaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  const equityBar = document.getElementById('equityBar');
  const profitBar = document.getElementById('profitBar');
  if (equityBar) equityBar.style.width = '0%';
  if (profitBar) profitBar.style.width = '0%';

  const fileInput = document.getElementById('csvFile');
  if (fileInput) fileInput.value = '';

  const eaSelect = document.getElementById('eaSelect');
  if (eaSelect) eaSelect.value = 'SMA';

  const symbolTitle = document.getElementById('symbolTitle');
  if (symbolTitle) symbolTitle.textContent = '5. Symbol';

  const eaTag = document.getElementById('eaTag');
  if (eaTag) eaTag.textContent = 'EA';

  document.querySelectorAll('.toggle-mode').forEach((b) => b.classList.remove('active'));
  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add('active');

  const themeInput = document.getElementById('themeSwitch');
  if (themeInput) themeInput.checked = false;
  document.body.dataset.theme = 'light';
  localStorage.setItem('theme', 'light');

  const cumInput = document.getElementById('cumSwitch');
 好，以下係 **Part 3**。  
根據附件可辨識結構，呢段應該係 chart modal、modal 內 equity/radar chart、同埋 `resetView()` 呢部分。[file:388]

```javascript
function setupTradeAnalyzerModal() {
  const modal = document.getElementById('taChartModal');
  if (!modal) return;

  const backdrop = modal.querySelector('.ta-modal-backdrop');
  const closeBtn = document.getElementById('taModalClose');
  const titleEl = document.getElementById('taModalTitle');
  const chartContainer = document.getElementById('taModalChartContainer');

  const close = () => {
    modal.classList.remove('open');
    if (chartContainer) chartContainer.innerHTML = '';
  };

  document.addEventListener('click', (e) => {
    const shell = e.target.closest('.ta-chart-shell');
    if (!shell) return;

    const chartType = shell.dataset.chart;
    if (!chartType) return;

    openTaChartModal(chartType);
  });

  if (backdrop) backdrop.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  window.openTaChartModal = openTaChartModal;

  function openTaChartModal(type) {
    if (!modal || !chartContainer || !titleEl) return;

    let titleText = 'Chart';
    switch (type) {
      case 'equity':
        titleText = 'Equity Growth';
        break;
      case 'radar':
        titleText = 'EA Radar';
        break;
      case 'symbol':
        titleText = 'Symbol Performance';
        break;
      default:
        titleText = 'Chart';
        break;
    }

    titleEl.textContent = titleText;
    chartContainer.innerHTML = `<div style="height:400px;"><canvas id="taModalChart"></canvas></div>`;

    const modalCtx = document.getElementById('taModalChart');
    modal.classList.add('open');
    if (!modalCtx) return;

    if (type === 'equity') {
      renderEquityGrowthInModal(modalCtx);
    } else if (type === 'radar') {
      renderEaRadarInModal(modalCtx);
    } else if (type === 'symbol') {
      renderSymbolPerformanceInModal(modalCtx);
    }
  }
}

function renderEquityGrowthInModal(ctx) {
  const acc = buildAccountSummary();
  if (!acc || !acc.curve || !acc.curve.length) return;

  const labels = acc.curve.map((p) => p.x);
  const data = acc.curve.map((p) => p.y);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Equity',
          data,
          borderColor: '#0d9fff',
          backgroundColor: 'rgba(13,159,255,0.16)',
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            color: 'rgba(255,255,255,0.7)'
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.7)'
          },
          grid: {
            color: 'rgba(255,255,255,0.15)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => `Equity ${c.parsed.y.toFixed(2)}`
          }
        }
      }
    }
  });
}

function renderEaRadarInModal(ctx) {
  const stats = buildStats(globalTrades);
  const radarData = buildRadarMetricsFromStats(stats);
  if (!radarData) return;

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radarData.labels,
      datasets: [
        {
          label: 'EA Performance',
          data: radarData.values,
          backgroundColor: 'rgba(157,78,221,0.20)',
          borderColor: '#f72585',
          borderWidth: 2,
          pointBackgroundColor: '#f72585',
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: 'rgba(255,255,255,0.15)'
          },
          grid: {
            color: 'rgba(255,255,255,0.15)'
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            display: false
          },
          pointLabels: {
            font: {
              size: 11
            },
            color: 'rgba(255,255,255,0.85)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => `${c.label}: ${c.parsed.r.toFixed(1)}`
          }
        }
      }
    }
  });
}

function renderSymbolPerformanceInModal(ctx) {
  const acc = buildAccountSummary();
  if (!acc || !acc.symbolRanking || !acc.symbolRanking.length) return;

  const labels = acc.symbolRanking.map((r) => r);
  const data = acc.symbolRanking.map((r) => r);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Profit',
          data,
          backgroundColor: data.map((v) => (v >= 0 ? '#22d3ee' : '#ef4444'))
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.75)'
          },
          grid: {
            color: 'rgba(255,255,255,0.12)'
          }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.75)'
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function resetView() {
  globalTrades = [];
  globalBySymbol = {};
  globalEAKey = 'SMA';
  mfeMaeMode = 'pips';
  cumulativeMode = 'all';

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();
  if (radarChart) radarChart.destroy();

  equityChart = null;
  weekdayChart = null;
  symbolProfitChart = null;
  mfeChart = null;
  maeChart = null;
  holdingChart = null;
  symbolCumulativeChart = null;
  symbolWeekdayProfitChart = null;
  symbolWeekdayCountChart = null;
  symbolHourlyProfitChart = null;
  symbolHourlyCountChart = null;
  radarChart = null;

  const hideIds = [
    'summaryCardsSection',
    'accountSection',
    'symbolSection',
    'symbolDetailSection',
    'swotSection',
    'martinSection'
  ];

  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const clearIds = [
    'accountStats',
    'symbolButtons',
    'symbolMiniCharts',
    'symbolStats',
    'martinTables',
    'minimumArea',
    'swotST',
    'swotS',
    'swotSW',
    'swotT',
    'swotW',
    'swotOT',
    'swotO',
    'swotOW',
    'swotCenterText',
    'eaCenterAnalysis'
  ];

  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  const summaryDefaults = {
    growthValue: '0%',
    growthPeriod: '',
    radarAlgo: 'EA Radar',
    radarProfitTrades: '',
    radarLossTrades: '',
    radarMaxDD: '',
    radarPF: '',
    radarActivity: '',
    equityValue: '0.00',
    profitValue: '0.00',
    initialDepositValue: '0.00'
  };

  Object.entries(summaryDefaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  const equityBar = document.getElementById('equityBar');
  const profitBar = document.getElementById('profitBar');
  if (equityBar) equityBar.style.width = '0%';
  if (profitBar) profitBar.style.width = '0%';

  const fileInput = document.getElementById('csvFile');
  if (fileInput) fileInput.value = '';

  const eaSelect = document.getElementById('eaSelect');
  if (eaSelect) eaSelect.value = 'SMA';

  const symbolTitle = document.getElementById('symbolTitle');
  if (symbolTitle) symbolTitle.textContent = '5. Symbol';

  const eaTag = document.getElementById('eaTag');
  if (eaTag) eaTag.textContent = 'EA';

  document.querySelectorAll('.toggle-mode').forEach((b) => {
    b.classList.remove('active');
  });

  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add('active');

  const themeInput = document.getElementById('themeSwitch');
  if (themeInput) themeInput.checked = false;
  document.body.dataset.theme = 'light';
  localStorage.setItem('theme', 'light');

  const cumInput = document.getElementById('cumSwitch');
  if (cumInput) cumInput.checked = false;

  const taPanel = document.getElementById('taPanel');
  if (taPanel) taPanel.style.display = 'none';

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
```
function renderSymbolButtons() {
  const container = document.getElementById('symbolButtons');
  if (!container) return;

  container.innerHTML = '';

  const symbols = Object.keys(globalBySymbol).sort();

  const allStats = buildStats(globalTrades);
  const allNet = allStats ? (allStats.grossProfit - allStats.grossLoss) : 0;

  const allBtn = document.createElement('button');
  allBtn.className = 'symbol-btn active';
  allBtn.dataset.symbol = 'ALL';
  allBtn.innerHTML = `<span>All Symbols</span><span class="value">${allNet.toFixed(0)}</span>`;
  allBtn.onclick = () => {
    container.querySelectorAll('.symbol-btn').forEach((b) => b.classList.remove('active'));
    allBtn.classList.add('active');
    renderSymbol('ALL');
  };
  container.appendChild(allBtn);

  symbols.forEach((sym) => {
    const stats = buildStats(globalBySymbol[sym] || []);
    const net = stats ? (stats.grossProfit - stats.grossLoss) : 0;

    const btn = document.createElement('button');
    btn.className = 'symbol-btn';
    btn.dataset.symbol = sym;
    btn.innerHTML = `<span>${sym}</span><span class="value">${net.toFixed(0)}</span>`;
    btn.onclick = () => {
      container.querySelectorAll('.symbol-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderSymbol(sym);
    };
    container.appendChild(btn);
  });
}

function renderSymbol(symbol) {
  const trades = symbol === 'ALL' ? globalTrades : (globalBySymbol[symbol] || []);
  if (!trades.length) return;

  const symbolDetailSection = document.getElementById('symbolDetailSection');
  const swotSection = document.getElementById('swotSection');

  if (symbolDetailSection) symbolDetailSection.style.display = 'block';
  if (swotSection) swotSection.style.display = 'block';

  expandBody('symbolDetailBody');
  expandBody('swotBody');

  const symbolTitle = document.getElementById('symbolTitle');
  if (symbolTitle) {
    symbolTitle.textContent =
      symbol === 'ALL' ? '5. Symbol - All Symbols' : `5. Symbol - ${symbol}`;
  }

  const cumWrap = document.getElementById('cumSwitchWrapper');
  if (cumWrap) {
    cumWrap.style.display = symbol === 'ALL' ? 'inline-flex' : 'none';
  }

  const stats = buildStats(trades);
  renderSymbolStats(stats);

  const rule =
    typeof EARULES !== 'undefined' && EARULES[globalEAKey]
      ? EARULES[globalEAKey]
      : (typeof EARULES !== 'undefined' ? EARULES.OtherBasic : null);

  const eaTag = document.getElementById('eaTag');
  if (eaTag && rule) eaTag.textContent = rule.name || 'EA';

  let martinSummary = null;

  if (rule && rule.martin && symbol !== 'ALL') {
    const m = buildMartinForSymbol(trades);
    martinSummary = m.martinSummary;
    renderMartinTables(symbol, m.tablePerSide);

    const martinSection = document.getElementById('martinSection');
    if (martinSection) martinSection.style.display = 'block';
  } else {
    const martinSection = document.getElementById('martinSection');
    if (martinSection) martinSection.style.display = 'none';
  }

  renderMfeMaeHoldingCharts(trades);
  renderSymbolExtraCharts(symbol, trades);

  if (typeof buildSwotForEA === 'function') {
    const swot = buildSwotForEA(globalEAKey, symbol, stats, martinSummary);
    renderSwot(swot);
  }
}

function renderSymbolStats(stats) {
  const el = document.getElementById('symbolStats');
  if (!el || !stats) return;

  const net = stats.grossProfit - stats.grossLoss;
  const pfText = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);

  el.innerHTML = `
    <div class="symbol-row">
      <span>Symbol Trades ${stats.totalTrades}</span>
      <span>${(stats.winRate * 100).toFixed(1)}%</span>
      <span>${net.toFixed(2)}</span>
      <span>PF ${pfText}</span>
    </div>
    <div class="symbol-row">
      <span>${stats.expectancy.toFixed(2)}</span>
      <span>Max DD ${stats.maxDrawdown.toFixed(2)}</span>
      <span>${stats.maxConsecLoss}</span>
    </div>
  `;
}

function buildMartinForSymbol(trades) {
  const map = {};

  for (const t of trades) {
    const key = `${t.symbol}_${t.type}_${t.lots.toFixed(2)}`;

    if (!map[key]) {
      map[key] = {
        symbol: t.symbol,
        side: String(t.type || '').toUpperCase(),
        lots: t.lots,
        tradeCount: 0,
        sumProfit: 0,
        sumPips: 0,
        winCount: 0,
        lossCount: 0,
        minWinProfit: null
      };
    }

    const m = map[key];
    m.tradeCount += 1;
    m.sumProfit += t.netProfit;
    m.sumPips += t.netPips;

    if (t.netProfit > 0) {
      m.winCount += 1;
      if (m.minWinProfit === null || t.netProfit < m.minWinProfit) {
        m.minWinProfit = t.netProfit;
      }
    } else if (t.netProfit < 0) {
      m.lossCount += 1;
    }
  }

  const rows = Object.values(map);
  const bySide = {};

  for (const r of rows) {
    const key = `${r.symbol}_${r.side}`;
    if (!bySide[key]) bySide[key] = [];
    bySide[key].push(r);
  }

  const tablePerSide = [];
  const martinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  for (const key of Object.keys(bySide)) {
    const [symbol, side] = key.split('_');
    const arr = bySide[key].sort((a, b) => a.lots - b.lots);

    let totalProfit = 0;
    let totalPips = 0;
    let totalTrades = 0;
    let cum = 0;
    let levelIndex = 0;
    let firstPositiveLevel = null;

    const rowsOut = [];

    for (const r of arr) {
      totalProfit += r.sumProfit;
      totalPips += r.sumPips;
      totalTrades += r.tradeCount;
      levelIndex += 1;
      cum += r.sumProfit;

      if (cum > 0 && firstPositiveLevel === null) {
        firstPositiveLevel = levelIndex;
      }

      const levelWinRate = r.tradeCount > 0 ? (r.winCount / r.tradeCount) * 100 : 0;
      const levelMinWin = r.minWinProfit;

      rowsOut.push({
        symbol,
        side,
        level: levelIndex,
        lots: r.lots,
        levelTrades: r.tradeCount,
        levelSumProfit: r.sumProfit,
        levelSumPips: r.sumPips,
        cumulativeProfit: cum,
        totalProfit,
        totalPips,
        totalTrades,
        levelWinRate,
        levelMinWin
      });
    }

    tablePerSide.push({
      symbol,
      side,
      totalProfit,
      totalPips,
      totalTrades,
      rows: rowsOut,
      firstPositiveLevel,
      maxLevel: levelIndex
    });

    martinSummary.totalProfit += totalProfit;

    if (levelIndex > martinSummary.maxLevel) {
      martinSummary.maxLevel = levelIndex;
    }

    if (totalProfit < 0) {
      martinSummary.worstSideNegative = { symbol, side, totalProfit };
    }

    if (firstPositiveLevel !== null) {
      if (
        martinSummary.firstPositiveLevel === null ||
        firstPositiveLevel < martinSummary.firstPositiveLevel
      ) {
        martinSummary.firstPositiveLevel = firstPositiveLevel;
      }
    }
  }

  return { tablePerSide, martinSummary };
}

function renderMartinTables(symbol, tablePerSide) {
  const container = document.getElementById('martinTables');
  if (!container) return;

  container.innerHTML = '';

  tablePerSide.forEach((block) => {
    const title = document.createElement('div');
    title.className = 'martin-header';

    const totalClass =
      block.totalProfit < 0 ? 'row-total-negative' : 'row-total-positive';

    title.innerHTML = `
      <span>${block.symbol} - ${block.side}</span>
      <span style="margin-left:8px;">
        TOTAL Profit <span class="${totalClass}">${block.totalProfit.toFixed(2)}</span>,
        Trades ${block.totalTrades}
      </span>
    `;
    container.appendChild(title);

    const wrap = document.createElement('div');
    wrap.className = 'martin-table-wrapper';

    const table = document.createElement('table');
    table.className = 'martin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Lots</th>
          <th>Trades</th>
          <th>SUM Profit</th>
          <th>SUM Pips</th>
          <th>Cum Profit</th>
          <th>Win Rate</th>
          <th>Min Win Profit</th>
          <th>SymbolSide TOTAL Profit</th>
          <th>Total Trades</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    block.rows.forEach((r) => {
      const tr = document.createElement('tr');

      let cls = '';
      if (block.totalProfit < 0) {
        cls = 'row-total-negative';
      } else if (
        block.firstPositiveLevel !== null &&
        r.level >= block.firstPositiveLevel
      ) {
        cls = 'level-safe';
      } else {
        cls = 'level-risk';
      }

      if (cls) tr.classList.add(cls);

      const winRate = r.levelWinRate || 0;
      const minWinText =
        r.levelMinWin !== null && Number.isFinite(r.levelMinWin)
          ? r.levelMinWin.toFixed(2)
          : '-';

      if (winRate >= 80) tr.classList.add('level-high-winrate');

      tr.innerHTML = `
        <td>${r.level}</td>
        <td>${r.lots.toFixed(2)}</td>
        <td>${r.levelTrades}</td>
        <td>${r.levelSumProfit.toFixed(2)}</td>
        <td>${r.levelSumPips.toFixed(1)}</td>
        <td>${r.cumulativeProfit.toFixed(2)}</td>
        <td>${winRate.toFixed(1)}</td>
        <td>${minWinText}</td>
        <td>${r.totalProfit.toFixed(2)}</td>
        <td>${r.totalTrades}</td>
      `;

      tbody.appendChild(tr);
    });

    wrap.appendChild(table);
    container.appendChild(wrap);
  });
}

    function renderSymbolMiniCharts() {
  const container = document.getElementById('symbolMiniCharts');
  if (!container) return;

  container.innerHTML = '';

  addMiniChartCard(container, 'All Symbols', globalTrades);

  const symbols = Object.keys(globalBySymbol).sort();
  symbols.forEach((sym) => {
    addMiniChartCard(container, sym, globalBySymbol[sym]);
  });
}

function addMiniChartCard(container, label, trades) {
  if (!trades || !trades.length) return;

  const stats = buildStats(trades);
  const net = stats ? (stats.grossProfit - stats.grossLoss) : 0;

  const div = document.createElement('div');
  div.className = 'mini-chart-card';

  const canvas = document.createElement('canvas');
  div.appendChild(canvas);

  const title = document.createElement('div');
  title.className = 'mini-chart-title';
  title.innerHTML = `<span>${label}</span><span class="value">${net.toFixed(0)}</span>`;
  div.appendChild(title);

  container.appendChild(div);

  let cum = 0;
  const points = [];
  trades.forEach((t) => {
    cum += Number(t.netProfit || 0);
    points.push(cum);
  });

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: points.map((_, i) => i + 1),
      datasets: [
        {
          data: points,
          borderColor: '#22c55e',
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      }
    }
  });
}

function renderMfeMaeHoldingCharts(trades) {
  const mfeCtx = document.getElementById('mfeChart');
  const maeCtx = document.getElementById('maeChart');
  const holdCtx = document.getElementById('holdingChart');

  if (!mfeCtx || !maeCtx || !holdCtx) return;

  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();

  const xKey = mfeMaeMode === 'pips' ? 'netPips' : 'netProfit';

  const mfeData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.mfe || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const maeData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.mae || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const holdData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.holdingDays || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const xTitle = mfeMaeMode === 'pips' ? 'Result Net Pips' : 'Result Net Profit';

  mfeChart = new Chart(mfeCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'MFE vs Result',
          data: mfeData,
          backgroundColor: mfeData.map((d) => d.c)
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'MFE pips'
          }
        }
      }
    }
  });

  maeChart = new Chart(maeCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'MAE vs Result',
          data: maeData,
          backgroundColor: maeData.map((d) => d.c)
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'MAE pips'
          }
        }
      }
    }
  });

  holdingChart = new Chart(holdCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Holding Time vs Result',
          data: holdData,
          backgroundColor: holdData.map((d) => d.c)
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'Holding Time days'
          }
        }
      }
    }
  });
}

function renderSymbolExtraCharts(symbol, trades) {
  const cumCtx = document.getElementById('symbolCumulativeChart');
  const wdProfitCtx = document.getElementById('symbolWeekdayProfitChart');
  const wdCountCtx = document.getElementById('symbolWeekdayCountChart');
  const hrProfitCtx = document.getElementById('symbolHourlyProfitChart');
  const hrCountCtx = document.getElementById('symbolHourlyCountChart');

  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  if (!trades || !trades.length) return;
  if (!cumCtx || !wdProfitCtx || !wdCountCtx || !hrProfitCtx || !hrCountCtx) return;

  const sorted = [...trades];
  const cumCtx2d = cumCtx.getContext('2d');

  if (symbol === 'ALL' && cumulativeMode === 'separate') {
    const grouped = {};

    sorted.forEach((t) => {
      if (!t.symbol) return;
      if (!grouped[t.symbol]) grouped[t.symbol] = [];
      grouped[t.symbol].push(t);
    });

    const baseColors = ['#22d3ee', '#a855f7', '#f97316', '#22c55e', '#eab308', '#ec4899', '#0ea5e9'];
    let colorIndex = 0;
    const datasets = [];
    let maxLen = 0;

    Object.entries(grouped).forEach(([symKey, arr]) => {
      let cum = 0;
      const data = [];

      arr.forEach((t) => {
        cum += Number(t.netProfit || 0);
        data.push(cum);
      });

      if (data.length > maxLen) maxLen = data.length;

      const c = baseColors[colorIndex % baseColors.length];
      colorIndex += 1;

      datasets.push({
        label: symKey,
        data,
        borderColor: c,
        fill: false,
        pointRadius: 0,
        tension: 0.15
      });
    });

    const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Trade Index per Symbol'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Profit'
            }
          }
        }
      }
    });
  } else {
    let cum = 0;
    const cumLabels = [];
    const cumData = [];

    sorted.forEach((t, idx) => {
      cum += Number(t.netProfit || 0);
      cumLabels.push(idx + 1);
      cumData.push(cum);
    });

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: 'line',
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: 'Cumulative Profit',
            data: cumData,
            borderColor: '#2563eb',
            fill: false,
            pointRadius: 0,
            tension: 0.15
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Trade Index'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Profit'
            }
          }
        }
      }
    });
  }

  const weekdayProfit = Array(7).fill(0);
  const weekdayCount = Array(7).fill(0);

  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const wd = Number.isNaN(d.getTime()) ? 0 : d.getDay();
    weekdayProfit[wd] += Number(t.netProfit || 0);
    weekdayCount[wd] += 1;
  });

  const weekdayNames = ['Sun', 'Mon', 'Tue', '以下係 **Part 5**。  
根據附件，呢段主要係 `renderSymbolMiniCharts`、`addMiniChartCard`、`renderMfeMaeHoldingCharts`、`renderSymbolExtraCharts`，即係 mini equity cards、MFE/MAE/Holding scatter charts、同 symbol cumulative/weekday/hourly charts 呢部分。[file:388]

```javascript
function renderSymbolMiniCharts() {
  const container = document.getElementById('symbolMiniCharts');
  if (!container) return;

  container.innerHTML = '';

  addMiniChartCard(container, 'All Symbols', globalTrades);

  const symbols = Object.keys(globalBySymbol).sort();
  symbols.forEach((sym) => {
    addMiniChartCard(container, sym, globalBySymbol[sym]);
  });
}

function addMiniChartCard(container, label, trades) {
  if (!container || !trades || !trades.length) return;

  const stats = buildStats(trades);
  const net = stats ? (stats.grossProfit - stats.grossLoss) : 0;

  const div = document.createElement('div');
  div.className = 'mini-chart-card';

  const canvas = document.createElement('canvas');
  div.appendChild(canvas);

  const title = document.createElement('div');
  title.className = 'mini-chart-title';
  title.innerHTML = `<span>${label}</span><span class="value">${net.toFixed(0)}</span>`;
  div.appendChild(title);

  container.appendChild(div);

  let cum = 0;
  const points = [];
  trades.forEach((t) => {
    cum += Number(t.netProfit || 0);
    points.push(cum);
  });

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: points.map((_, i) => i + 1),
      datasets: [
        {
          data: points,
          borderColor: '#22c55e',
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      }
    }
  });
}

function renderMfeMaeHoldingCharts(trades) {
  const mfeCtx = document.getElementById('mfeChart');
  const maeCtx = document.getElementById('maeChart');
  const holdCtx = document.getElementById('holdingChart');

  if (!mfeCtx || !maeCtx || !holdCtx) return;

  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();

  const xKey = mfeMaeMode === 'pips' ? 'netPips' : 'netProfit';

  const mfeData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.mfe || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const maeData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.mae || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const holdData = trades.map((t) => ({
    x: Number(t[xKey] || 0),
    y: Number(t.holdingDays || 0),
    c: Number(t.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626'
  }));

  const xTitle = mfeMaeMode === 'pips' ? 'Result Net Pips' : 'Result Net Profit';

  mfeChart = new Chart(mfeCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'MFE vs Result',
          data: mfeData,
          backgroundColor: mfeData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'MFE pips'
          }
        }
      }
    }
  });

  maeChart = new Chart(maeCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'MAE vs Result',
          data: maeData,
          backgroundColor: maeData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'MAE pips'
          }
        }
      }
    }
  });

  holdingChart = new Chart(holdCtx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Holding Time vs Result',
          data: holdData,
          backgroundColor: holdData.map((d) => d.c)
        }
      ]
    },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xTitle
          }
        },
        y: {
          title: {
            display: true,
            text: 'Holding Time days'
          }
        }
      }
    }
  });
}

function renderSymbolExtraCharts(symbol, trades) {
  const cumCtx = document.getElementById('symbolCumulativeChart');
  const wdProfitCtx = document.getElementById('symbolWeekdayProfitChart');
  const wdCountCtx = document.getElementById('symbolWeekdayCountChart');
  const hrProfitCtx = document.getElementById('symbolHourlyProfitChart');
  const hrCountCtx = document.getElementById('symbolHourlyCountChart');

  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  if (!trades || !trades.length) return;
  if (!cumCtx || !wdProfitCtx || !wdCountCtx || !hrProfitCtx || !hrCountCtx) return;

  const sorted = trades.slice();
  const cumCtx2d = cumCtx.getContext('2d');

  if (symbol === 'ALL' && cumulativeMode === 'separate') {
    const grouped = {};
    sorted.forEach((t) => {
      if (!t.symbol) return;
      if (!grouped[t.symbol]) grouped[t.symbol] = [];
      grouped[t.symbol].push(t);
    });

    const baseColors = ['#22d3ee', '#a855f7', '#f97316', '#22c55e', '#eab308', '#ec4899', '#0ea5e9'];
    let colorIndex = 0;
    const datasets = [];
    let maxLen = 0;

    Object.entries(grouped).forEach(([symKey, arr]) => {
      let cum = 0;
      const data = [];

      arr.forEach((t) => {
        cum += Number(t.netProfit || 0);
        data.push(cum);
      });

      if (data.length > maxLen) maxLen = data.length;

      const c = baseColors[colorIndex % baseColors.length];
      colorIndex += 1;

      datasets.push({
        label: symKey,
        data,
        borderColor: c,
        fill: false,
        pointRadius: 0,
        tension: 0.15
      });
    });

    const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Trade Index per Symbol'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Profit'
            }
          }
        }
      }
    });
  } else {
    let cum = 0;
    const cumLabels = [];
    const cumData = [];

    sorted.forEach((t, idx) => {
      cum += Number(t.netProfit || 0);
      cumLabels.push(idx + 1);
      cumData.push(cum);
    });

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: 'line',
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: 'Cumulative Profit',
            data: cumData,
            borderColor: '#2563eb',
            fill: false,
            pointRadius: 0,
            tension: 0.15
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Trade Index'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Profit'
            }
          }
        }
      }
    });
  }

  const weekdayProfit = Array(7).fill(0);
  const weekdayCount = Array(7).fill(0);

  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const wd = isNaN(d.getTime()) ? 0 : d.getDay();
    weekdayProfit[wd] += Number(t.netProfit || 0);
    weekdayCount[wd] += 1;
  });

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  symbolWeekdayProfitChart = new Chart(wdProfitCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: 'Profit',
          data: weekdayProfit,
          backgroundColor: weekdayProfit.map((v) => (v >= 0 ? '#22d3ee' : '#ef4444'))
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Profit'
          }
        }
      }
    }
  });

  symbolWeekdayCountChart = new Chart(wdCountCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: 'Count',
          data: weekdayCount,
          backgroundColor: '#6366f1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Trades'
          }
        }
      }
    }
  });

  const hourlyProfit = Array(24).fill(0);
  const hourlyCount = Array(24).fill(0);

  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const h = isNaN(d.getTime()) ? 0 : d.getHours();
    hourlyProfit[h] += Number(t.netProfit || 0);
    hourlyCount[h] += 1;
  });

  const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  symbolHourlyProfitChart = new Chart(hrProfitCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: 'Profit',
          data: hourlyProfit,
          backgroundColor: hourlyProfit.map((v) => (v >= 0 ? '#22d3ee' : '#ef4444'))
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Hour'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Profit'
          }
        }
      }
    }
  });

  symbolHourlyCountChart = new Chart(hrCountCtx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: 'Count',
          data: hourlyCount,
          backgroundColor: '#3b82f6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Hour'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Trades'
          }
        }
      }
    }
  });
}
```

function renderSwot(swot) {
  if (!swot) return;

  const setHtml = (id, title, arr) => {
    const el = document.getElementById(id);
    if (!el) return;
    const rows = Array.isArray(arr) ? arr : [];
    el.innerHTML = `<strong>${title}</strong><br>${rows.join('<br>')}`;
  };

  setHtml('swotST', 'ST', swot.ST);
  setHtml('swotS', 'S', swot.S);
  setHtml('swotSW', 'SW', swot.SW);
  setHtml('swotT', 'T', swot.T);
  setHtml('swotW', 'W', swot.W);
  setHtml('swotOT', 'OT', swot.OT);
  setHtml('swotO', 'O', swot.O);
  setHtml('swotOW', 'OW', swot.OW);

  const centerText =
    (Array.isArray(swot.centerAnalysis) && swot.centerAnalysis.length
      ? swot.centerAnalysis.join('<br>')
      : '') ||
    (Array.isArray(swot.center) && swot.center.length
      ? swot.center.join('<br>')
      : '') ||
    '';

  const swotCenterText = document.getElementById('swotCenterText');
  if (swotCenterText) swotCenterText.innerHTML = centerText;

  const eaCenterAnalysis = document.getElementById('eaCenterAnalysis');
  if (eaCenterAnalysis) eaCenterAnalysis.innerHTML = centerText;
}

document.addEventListener('DOMContentLoaded', () => {
  setupThemeSwitch();
  setupCumSwitch();
  setupTradeAnalyzerModal();

  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add('active');

  const body = document.body;
  if (body && !body.dataset.theme) {
    body.dataset.theme = 'light';
  }
});
