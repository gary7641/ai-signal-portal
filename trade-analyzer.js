// ============================================================
// trade-analyzer.js  –  AI Signal Portal Trade Analyzer
// ============================================================

"use strict";

// ---------- 全域變數 ----------
let globalTrades = [];
let globalBySymbol = {};
let globalEAKey = "Unknown";

// Chart 實例（destroy 前先要有 reference）
let equityChart = null;
let weekdayChart = null;
let symbolProfitChart = null;
let radarChart = null;
let symbolCumulativeChart = null;
let symbolWeekdayProfitChart = null;
let symbolWeekdayCountChart = null;
let symbolHourlyProfitChart = null;
let symbolHourlyCountChart = null;
let miniCharts = {};

// ---------- 初始化 ----------
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const csvFile = document.getElementById("csvFile");

  if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);
  if (resetBtn) resetBtn.addEventListener("click", resetView);

  // Collapsible headers
  document.addEventListener("click", (e) => {
    const hdr = e.target.closest(".collapsible-header");
    if (!hdr) return;
    const targetId = hdr.dataset.target;
    const body = document.getElementById(targetId);
    const toggle = hdr.querySelector(".collapse-toggle");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    if (toggle) toggle.textContent = isOpen ? "＋" : "－";
  });

  // Symbol detail switch
  const cumSwitch = document.getElementById("cumSwitch");
  if (cumSwitch) {
    cumSwitch.addEventListener("change", () => {
      const sym = document.getElementById("symbolTitle")?.textContent?.replace("5. Symbol 深入分析 📊 – ", "").trim() || "ALL";
      renderSymbol(sym);
    });
  }

  // Details table view buttons
  document.querySelectorAll(".ta-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ta-view-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTaDetailsTable(btn.dataset.view);
    });
  });

  initTradeAnalyzerModal();
});

// ---------- handleAnalyze ----------
function handleAnalyze() {
  const fileInput = document.getElementById("csvFile");
  const eaSelect = document.getElementById("eaSelect");

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert("請先選擇 CSV 檔案");
    return;
  }

  globalEAKey = eaSelect ? eaSelect.value : "Unknown";

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    globalTrades = parseCsv(text);
    if (!globalTrades.length) {
      alert("CSV 內沒有有效交易紀錄，請確認格式正確");
      return;
    }
    globalTrades.sort((a, b) => a.closeTime - b.closeTime);

    globalBySymbol = {};
    globalTrades.forEach((t) => {
      if (!globalBySymbol[t.symbol]) globalBySymbol[t.symbol] = [];
      globalBySymbol[t.symbol].push(t);
    });

    buildAll();
  };
  reader.readAsText(fileInput.files[0]);
}

// ---------- parseCsv ----------
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  // 嘗試找 header 行
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("symbol") || lower.includes("ticket") || lower.includes("type")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const headers = lines[headerIdx].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const trades = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
    if (cols.length < 4) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });

    // 過濾非 trade 行
    const typeVal = (row["type"] || row["action"] || "").toLowerCase();
    if (!typeVal || typeVal === "type" || typeVal === "balance" || typeVal === "credit") continue;
    if (!["buy", "sell", "buy limit", "sell limit", "buy stop", "sell stop"].some((t) => typeVal.includes(t))) continue;

    const symbol = row["symbol"] || row["item"] || "";
    if (!symbol) continue;

    const profit = parseFloat(row["profit"] || row["pnl"] || "0") || 0;
    const lots = parseFloat(row["volume"] || row["lots"] || row["size"] || "0") || 0;

    // 時間解析
    const openTimeStr = row["open time"] || row["opentime"] || row["open"] || "";
    const closeTimeStr = row["close time"] || row["closetime"] || row["close"] || "";
    const openTime = parseDate(openTimeStr);
    const closeTime = parseDate(closeTimeStr);
    if (!closeTime) continue;

    // Pips / MFE / MAE / Holding
    const pips = parseFloat(row["pips"] || "0") || 0;
    const mfe = parseFloat(row["mfe"] || row["max profit"] || "0") || 0;
    const mae = parseFloat(row["mae"] || row["max loss"] || "0") || 0;
    const holdingHours = openTime && closeTime
      ? (closeTime - openTime) / 3600000
      : 0;

    trades.push({
      symbol: symbol.toUpperCase(),
      type: typeVal.includes("buy") ? "buy" : "sell",
      lots,
      profit,
      pips,
      mfe,
      mae,
      holdingHours,
      openTime,
      closeTime,
    });
  }

  return trades;
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str.replace(/\./g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

// ---------- buildStats ----------
function buildStats(trades) {
  if (!trades || !trades.length) return null;

  let grossProfit = 0;
  let grossLoss = 0;
  let profitTrades = 0;
  let lossTrades = 0;
  let totalPips = 0;
  let totalMFE = 0;
  let totalMAE = 0;
  let totalHolding = 0;
  let maxDrawdown = 0;
  let peak = 0;
  let cumulative = 0;
  let maxConsecLoss = 0;
  let curConsecLoss = 0;

  trades.forEach((t) => {
    cumulative += t.profit;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (t.profit >= 0) {
      grossProfit += t.profit;
      profitTrades++;
      curConsecLoss = 0;
    } else {
      grossLoss += Math.abs(t.profit);
      lossTrades++;
      curConsecLoss++;
      if (curConsecLoss > maxConsecLoss) maxConsecLoss = curConsecLoss;
    }

    totalPips += t.pips || 0;
    totalMFE += t.mfe || 0;
    totalMAE += t.mae || 0;
    totalHolding += t.holdingHours || 0;
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? profitTrades / totalTrades : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = profitTrades > 0 ? grossProfit / profitTrades : 0;
  const avgLoss = lossTrades > 0 ? -(grossLoss / lossTrades) : 0;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;
  const avgHolding = totalTrades > 0 ? totalHolding / totalTrades : 0;

  return {
    totalTrades,
    profitTrades,
    lossTrades,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown,
    maxConsecLoss,
    totalPips,
    avgMFE: totalTrades > 0 ? totalMFE / totalTrades : 0,
    avgMAE: totalTrades > 0 ? totalMAE / totalTrades : 0,
    avgHolding,
  };
}

// ---------- buildAccountSummary ----------
function buildAccountSummary() {
  if (!globalTrades.length) return null;

  const stats = buildStats(globalTrades);
  if (!stats) return null;

  // Equity curve
  let cumulative = 0;
  const curve = globalTrades.map((t) => {
    cumulative += t.profit;
    const label = t.closeTime
      ? t.closeTime.toISOString().slice(0, 10)
      : "";
    return { x: label, y: cumulative };
  });

  // Symbol ranking by net profit
  const symbolProfit = {};
  Object.keys(globalBySymbol).forEach((sym) => {
    const s = buildStats(globalBySymbol[sym]);
    symbolProfit[sym] = s ? s.grossProfit - s.grossLoss : 0;
  });
  const symbolRanking = Object.entries(symbolProfit).sort((a, b) => b[1] - a[1]);

  const firstTime = globalTrades[0]?.openTime || globalTrades[0]?.closeTime;
  const lastTime = globalTrades[globalTrades.length - 1]?.closeTime;

  return { stats, curve, symbolRanking, symbolProfit, firstTime, lastTime };
}

// ---------- buildAll ----------
function buildAll() {
  if (!globalTrades.length) {
    alert("CSV 內沒有有效交易紀錄");
    return;
  }

  const acc = buildAccountSummary();

  // 安全檢查：acc 或 acc.stats 係 null 就唔繼續
  if (!acc || !acc.stats) {
    alert("統計資料計算失敗，請檢查 CSV 格式是否正確");
    return;
  }

  renderSummaryCards(acc);

  const summarySection = document.getElementById("summaryCardsSection");
  if (summarySection) summarySection.style.display = "block";
  expandBody("summaryCardsBody");

  renderAccountStatistics(acc.stats);
  renderMinimumArea(acc.stats);

  const accountSection = document.getElementById("accountSection");
  if (accountSection) accountSection.style.display = "block";
  expandBody("accountBody");

  renderSymbolButtons();

  const symbolSection = document.getElementById("symbolSection");
  if (symbolSection) symbolSection.style.display = "block";
  renderSymbolMiniCharts();
  expandBody("symbolBody");

  renderSymbol("ALL");

  const martinSection = document.getElementById("martinSection");
  if (martinSection) martinSection.style.display = "block";
  renderMartinTables();
  expandBody("martinBody");

  const swotSection = document.getElementById("swotSection");
  if (swotSection) swotSection.style.display = "block";
  renderSwot(buildSwotData(acc.stats));
  expandBody("swotBody");

  // Trade Analyzer Dashboard
  const taPanel = document.getElementById("taPanel");
  if (taPanel) taPanel.style.display = "block";

  renderEquityGrowthDashboard();
  renderEaRadarDashboard();
  renderSymbolPerfDashboard();
  renderTaDetailsTable("ea");
}

// ---------- expandBody ----------
function expandBody(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}

// ---------- renderSummaryCards ----------
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
    const from = acc.firstTime.toISOString().slice(0, 10);
    const to = acc.lastTime.toISOString().slice(0, 10);
    setText("growthPeriod", from + " → " + to);
  }

  // Radar text
  setText("radarProfitTrades", s.profitTrades);
  setText("radarLossTrades", s.lossTrades);
  setText("radarMaxDD", s.maxDrawdown.toFixed(2));
  setText("radarActivity", s.totalTrades + " trades");
  setText("radarAlgoScore", globalEAKey);

  // Build radar chart
  buildSummaryRadarChart(s);

  // Build equity mini chart
  buildSummaryEquityChart(acc.curve);
}

// ---------- buildSummaryRadarChart ----------
function buildSummaryRadarChart(s) {
  const ctx = document.getElementById("radarChart");
  if (!ctx) return;

  if (radarChart) { radarChart.destroy(); radarChart = null; }

  const radarData = buildRadarMetricsFromStats(s);
