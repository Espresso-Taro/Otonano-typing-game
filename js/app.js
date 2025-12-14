// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { UserManager } from "./userManager.js";
import { TypingEngine } from "./typingEngine.js";
import { RankingService } from "./ranking.js";

/* =========================
   Firebase
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAqDSPE_HkPbi-J-SqPL4Ys-wR4RaA8wKA",
  authDomain: "otonano-typing-game.firebaseapp.com",
  projectId: "otonano-typing-game",
  storageBucket: "otonano-typing-game.appspot.com",
  messagingSenderId: "475283850178",
  appId: "1:475283850178:web:193d28f17be20a232f4c5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================
   DOM
========================= */
const authBadge = document.getElementById("authBadge");
const metaInfoEl = document.getElementById("metaInfo");

const userSelect = document.getElementById("userSelect");
const addUserBtn = document.getElementById("addUserBtn");
const renameUserBtn = document.getElementById("renameUserBtn");
const deleteUserBtn = document.getElementById("deleteUserBtn");

const difficultyEl = document.getElementById("difficulty");
const lengthGroupEl = document.getElementById("lengthGroup");
const categoryEl = document.getElementById("category");
const themeEl = document.getElementById("theme");
const dailyThemeEl = document.getElementById("dailyTheme");
const dailyInfoEl = document.getElementById("dailyInfo");

const skipBtn = document.getElementById("skipBtn");
const startBtn = document.getElementById("startBtn");
const inputEl = document.getElementById("input");
const textEl = document.getElementById("text");
const resultEl = document.getElementById("result");

const dailyRankingTitle = document.getElementById("dailyRankingTitle");
const dailyRankLabel = document.getElementById("dailyRankLabel");
const dailyRankingUL = document.getElementById("dailyRanking");

const rankLabel = document.getElementById("rankLabel");
const rankingUL = document.getElementById("ranking");

const analyticsTitle = document.getElementById("analyticsTitle");
const bestByDifficultyUL = document.getElementById("bestByDifficulty");
const compareTodayEl = document.getElementById("compareToday");
const scoreChart = document.getElementById("scoreChart");
const myRecentUL = document.getElementById("myRecent");
const analyticsLabel = document.getElementById("analyticsLabel");

const modalBackdrop = document.getElementById("resultModalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const nextBtn = document.getElementById("nextBtn");

const mRank = document.getElementById("mRank");
const mCPM = document.getElementById("mCPM");
const mTimeSec = document.getElementById("mTimeSec");
const mLen = document.getElementById("mLen");
const mMeta = document.getElementById("mMeta");

/* =========================
   表示用：難度（成績・分析タブ）
   ※タイピング練習の難易度（difficultyEl）とは連動しない
========================= */
let activeDiffTab = "normal"; // easy/normal/hard

function setActiveDiffTab(diff) {
  if (!diff) return;
  activeDiffTab = diff;

  // 成績・分析タブの見た目更新
  document.querySelectorAll("#diffTabsUnified .diffTab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.diff === activeDiffTab);
  });
}

/* =========================
   Utils
========================= */
function rankByScore(score) {
  if (score >= 800) return "SSS";
  if (score >= 700) return "SS";
  if (score >= 600) return "S";
  if (score >= 500) return "A";
  if (score >= 400) return "B";
  if (score >= 300) return "C";
  return "D";
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// 記号スコア（IME入力の負荷を反映）
// 強・中・弱・基本の4段階
function punctScore(text) {
  // 強い記号：ペア管理・判断負荷が高い
  const strong = (text.match(/[（）「」『』［］【】＜＞”’]/g) || []).length;

  // 中程度：Shift必須・意味は明確
  const middle = (text.match(/[￥＄：；]/g) || []).length;

  // 軽め：頻出だがミス源
  const weak = (text.match(/[ー・＃％＆＋－＝／]/g) || []).length;

  // 基本的な句読点
  const basic = (text.match(/[、。,.!！?？]/g) || []).length;

  // 重み付け（中で合算 → 難易度側でまとめて評価）
  return strong * 3 + middle * 2 + weak * 1 + basic * 1;
}

function digitCount(text) {
  return (text.match(/[0-9]/g) || []).length;
}

function kanjiRatio(text) {
  const total = text.length || 1;
  const kanji = (text.match(/[一-龥]/g) || []).length;
  return kanji / total;
}

/* =========================
   難易度：3段階（出題用）
========================= */
function difficultyByText(text) {
  const score =
    kanjiRatio(text) * 100 +
    punctScore(text) * 6 +
    digitCount(text) * 10;

  if (score < 35) return "easy";     // 易
  if (score < 65) return "normal";   // 普
  return "hard";                     // 難
}

function diffLabel(v) {
  if (v === "easy") return "易";
  if (v === "normal") return "普";
  if (v === "hard") return "難";
  return "-";
}

/* =========================
   文章長：5段階
========================= */
function lengthGroupOf(len) {
  if (len <= 20) return "xs";        // 極短
  if (len <= 40) return "short";     // 短
  if (len <= 80) return "medium";    // 中
  if (len <= 140) return "long";     // 長
  return "xl";                       // 極長
}

function lengthLabel(v) {
  if (v === "xs") return "極短";
  if (v === "short") return "短";
  if (v === "medium") return "中";
  if (v === "long") return "長";
  if (v === "xl") return "極長";
  return "-";
}

function showModal() {
  modalBackdrop.style.display = "flex";
  modalBackdrop.setAttribute("aria-hidden", "false");
}
function hideModal() {
  modalBackdrop.style.display = "none";
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   Services
========================= */
const userMgr = new UserManager({
  selectEl: userSelect,
  addBtn: addUserBtn,
  renameBtn: renameUserBtn,
  deleteBtn: deleteUserBtn
});

const rankingSvc = new RankingService({ db });

/* =========================
   Trivia data
========================= */
let items = []; // enriched
let categories = [];
let themeByCategory = new Map();
let allThemes = [];
let dailyTheme = null;

function getBasePath() {
  const p = location.pathname;
  if (p.endsWith("/")) return p.slice(0, -1);
  return p.replace(/\/index\.html$/, "");
}

async function loadTrivia() {
  const tryUrls = [
    "./data/trivia.json",
    `${getBasePath()}/data/trivia.json`
  ];

  let lastErr = null;
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error(`JSON is not array (${url})`);
      return json;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

function buildIndices(raw) {
  items = raw
    .filter(x => x && typeof x.text === "string")
    .map(x => {
      const len = (typeof x.length === "number") ? x.length : x.text.length;

      const difficulty = difficultyByText(x.text);  // easy/normal/hard
      const lengthGroup = lengthGroupOf(len);       // xs/short/medium/long/xl

      return {
        genre: x.genre ?? "",
        category: x.category ?? "",
        theme: x.theme ?? "",
        text: x.text,
        length: len,
        difficulty,
        lengthGroup
      };
    });

  categories = Array.from(new Set(items.map(x => x.category).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ja"));

  themeByCategory = new Map();
  for (const c of categories) themeByCategory.set(c, new Set());
  for (const it of items) {
    if (!it.category || !it.theme) continue;
    if (!themeByCategory.has(it.category)) themeByCategory.set(it.category, new Set());
    themeByCategory.get(it.category).add(it.theme);
  }

  allThemes = Array.from(new Set(items.map(x => x.theme).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ja"));

  dailyTheme = (allThemes.length > 0)
    ? allThemes[hashString(todayKey()) % allThemes.length]
    : null;
}

/* =========================
   UI Hydrate
========================= */
function hydrateSelects() {
  difficultyEl.innerHTML = `
    <option value="easy">難度：易</option>
    <option value="normal" selected>難度：普</option>
    <option value="hard">難度：難</option>
  `;

  lengthGroupEl.innerHTML = `
    <option value="xs">長さ：極短</option>
    <option value="short">長さ：短</option>
    <option value="medium" selected>長さ：中</option>
    <option value="long">長さ：長</option>
    <option value="xl">長さ：極長</option>
  `;

  categoryEl.innerHTML =
    `<option value="all">カテゴリ：すべて</option>` +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  themeEl.innerHTML = `<option value="all">テーマ：すべて</option>`;
}

function applyThemeOptionsByCategory() {
  const daily = dailyThemeEl.checked && !!dailyTheme;
  if (daily) {
    themeEl.disabled = true;
    categoryEl.disabled = true;
    themeEl.innerHTML = `<option value="${escapeHtml(dailyTheme)}">${escapeHtml(dailyTheme)}</option>`;
    themeEl.value = dailyTheme;
    dailyInfoEl.style.display = "block";
    dailyInfoEl.textContent = `今日（${todayKey()}）のテーマ：${dailyTheme}（固定中）`;
    return;
  }

  themeEl.disabled = false;
  categoryEl.disabled = false;
  dailyInfoEl.style.display = "none";
  dailyInfoEl.textContent = "";

  const cat = categoryEl.value;
  const current = themeEl.value;

  let themes = [];
  if (cat === "all") {
    themes = allThemes;
  } else {
    const set = themeByCategory.get(cat);
    themes = set ? Array.from(set).sort((a, b) => a.localeCompare(b, "ja")) : [];
  }

  themeEl.innerHTML =
    `<option value="all">テーマ：すべて</option>` +
    themes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  themeEl.value = themes.includes(current) ? current : "all";
}

function getActiveFilters() {
  const daily = dailyThemeEl.checked && !!dailyTheme;
  const difficulty = difficultyEl.value;     // 出題用（成績・分析とは連動しない）
  const lengthGroup = lengthGroupEl.value;
  const category = daily ? "all" : categoryEl.value;
  const theme = daily ? dailyTheme : themeEl.value;
  return { daily, difficulty, lengthGroup, category, theme };
}

function filterPool() {
  const { daily, difficulty, lengthGroup, category, theme } = getActiveFilters();
  return items.filter(x => {
    if (x.difficulty !== difficulty) return false;
    if (x.lengthGroup !== lengthGroup) return false;
    if (!daily && category !== "all" && x.category !== category) return false;
    if (theme !== "all" && x.theme !== theme) return false;
    return true;
  });
}

/* =========================
   Recent history (10問再出題回避)
========================= */
const HISTORY_MAX = 10;
const recentTexts = [];
function pushHistory(text) {
  if (!text) return;
  recentTexts.unshift(text);
  if (recentTexts.length > HISTORY_MAX) recentTexts.length = HISTORY_MAX;
}
function isRecentlyUsed(text) {
  return recentTexts.includes(text);
}
function pickNextItem(pool) {
  if (pool.length === 0) return null;
  const notRecent = pool.filter(x => !isRecentlyUsed(x.text));
  const candidates = (notRecent.length > 0) ? notRecent : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/* =========================
   Typing Engine
========================= */
let currentItem = null;

const engine = new TypingEngine({
  textEl,
  inputEl,
  resultEl,
  onFinish: async ({ metrics, meta }) => {
    await onFinished(metrics, meta);
  }
});

engine.attach();

/* =========================
   Countdown + Start
========================= */
let countdownTimer = null;

async function startWithCountdown() {
  if (!currentItem) return;

  // スタートボタンを隠す（入力欄クリックを邪魔しない）
  startBtn.style.display = "none";

  // カウント中に連打させない
  startBtn.disabled = true;
  skipBtn.disabled = true;

  // 開始前ガイドの中央揃えを解除
  inputEl.classList.remove("input-guide");

  engine.showCountdownInTextarea(3);
  let n = 3;

  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    n--;
    if (n >= 0) engine.showCountdownInTextarea(n);

    if (n <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;

      // カウントダウン用スタイル解除（上下中央寄せを元に戻す）
      inputEl.classList.remove("countdown");
      inputEl.style.paddingTop = "";
      inputEl.style.paddingBottom = "";

      engine.enableReadyState();
      engine.startNow();

      startBtn.disabled = false;
      skipBtn.disabled = false;
    }
  }, 800);
}

/* =========================
   New question
========================= */
function setNewText() {
  const pool = filterPool();

  if (pool.length === 0) {
    currentItem = null;
    metaInfoEl.textContent = "- / -";
    engine.setTarget("該当する文章がありません。条件を変更してください。", null);
    textEl.textContent = "該当する文章がありません。条件を変更してください。";
    inputEl.value = "";
    inputEl.disabled = true;
    startBtn.style.display = "none";
    return;
  }

  const pick = pickNextItem(pool);
  currentItem = pick;

  // メタ情報表示（出題）
  const cat = pick.category ?? "-";
  const theme = pick.theme ?? "-";
  metaInfoEl.textContent = `${cat} / ${theme}`;

  pushHistory(pick.text);
  engine.setTarget(pick.text, pick);

  inputEl.value = "スペース or スタートボタンで入力開始";
  inputEl.disabled = true;
  inputEl.classList.add("input-guide");
  startBtn.style.display = "block";

  updateLabels();
}

/* =========================
   Ranking + Analytics
========================= */
function updateLabels() {
  const { lengthGroup, theme, daily } = getActiveFilters();
  const lenTxt = lengthLabel(lengthGroup);
  const diffTxt = diffLabel(activeDiffTab);

  const dailyThemeTxt = dailyTheme ?? "—";

  // ★今日テーマランキングの見出しに、括弧内でテーマ名を表示
  if (dailyRankingTitle) {
    dailyRankingTitle.textContent = `今日のテーマランキング（固定表示：${dailyThemeTxt}）`;
  }

  // 今日テーマランキングの補助ラベル
  dailyRankLabel.textContent =
    `今日：${todayKey()} / 難度：${diffTxt} / 長さ：${lenTxt} / テーマ：${dailyThemeTxt}`;

  // ★ランキング範囲の選択は廃止 → 常に「全体ランキング」
  rankLabel.textContent = `全体（難度：${diffTxt} / 長さ：${lenTxt}）`;

  // ★入力分析タイトルに、括弧内で選択ユーザー名を表示
  const userName = userMgr.getCurrentUserName() || "ゲスト";
  if (analyticsTitle) {
    analyticsTitle.textContent = `入力分析（選択ユーザー：${userName}）`;
  }

  // analyticsLabel（任意の補助情報）
  if (analyticsLabel) {
    const thTxt = daily ? dailyThemeTxt : (theme === "all" ? "すべて" : theme);
    analyticsLabel.textContent = `難度：${diffTxt} / 長さ：${lenTxt} / テーマ：${thTxt}`;
  }
}

async function loadDailyRanking() {
  try {
    const { lengthGroup } = getActiveFilters();
    const rows = await rankingSvc.loadDailyTheme({
      theme: dailyTheme,
      dateKey: todayKey(),
      difficulty: activeDiffTab,
      lengthGroup
    });
    rankingSvc.renderList(dailyRankingUL, rows);
  } catch (e) {
    console.error("daily ranking load error", e);
    dailyRankingUL.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
  }
}

async function loadRanking() {
  try {
    const { lengthGroup } = getActiveFilters();

    // ★ランキング範囲の選択は廃止 → 常に全体
    const rows = await rankingSvc.loadOverall({
      difficulty: activeDiffTab,
      lengthGroup
    });

    rankingSvc.renderList(rankingUL, rows);
  } catch (e) {
    console.error("ranking load error", e);
    rankingUL.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
  }
}

/* =========================
   Analytics（選択ユーザー）
========================= */
function avg(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
}

function renderBestForSelectedDifficulty(histories) {
  bestByDifficultyUL.innerHTML = "";
  if (!histories.length) {
    const li = document.createElement("li");
    // ★難易度表示はやめる（すでに難度タブで選択済みのため）
    li.textContent = "まだ履歴がありません";
    bestByDifficultyUL.appendChild(li);
    return;
  }
  const best = Math.max(...histories.map(h => Number(h.cpm ?? 0)));
  const li = document.createElement("li");
  // ★難易度表示はやめる
  li.textContent = `TOP スコア ${best}`;
  bestByDifficultyUL.appendChild(li);
}

function renderRecent(histories) {
  myRecentUL.innerHTML = "";
  const slice = histories.slice(0, 12);
  if (!slice.length) {
    const li = document.createElement("li");
    li.textContent = "まだ履歴がありません。";
    myRecentUL.appendChild(li);
    return;
  }
  for (const h of slice) {
    const li = document.createElement("li");
    const userName = h.userName ?? "-";
    const rank = h.rank ?? "-";
    const score = Number(h.cpm ?? 0);
    const lg = lengthLabel(h.lengthGroup);
    const theme = h.theme ?? "-";

    // ★統一フォーマット：ユーザー名｜ランク｜スコア｜文章長｜テーマ
    li.textContent = `${userName}｜${rank}｜${score}｜${lg}｜${theme}`;
    myRecentUL.appendChild(li);
  }
}

function buildDailyBestSeries(histories) {
  const map = new Map(); // dateKey -> best cpm
  for (const h of histories) {
    if (!h.dateKey) continue;
    const v = Number(h.cpm ?? 0);
    if (!map.has(h.dateKey) || v > map.get(h.dateKey)) map.set(h.dateKey, v);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, score]) => ({ dateKey, score }));
}

function drawScoreChart(points) {
  const canvas = scoreChart;
  const ctx = canvas.getContext("2d");

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);

  ctx.fillStyle = "#555";
  ctx.font = "12px system-ui";
  ctx.fillText("スコア（CPM）推移：縦=スコア / 横=日付", 12, 14);

  if (!points.length) {
    ctx.fillText("履歴がありません。", 12, 34);
    return;
  }

  const pad = 28;
  const w = cssW - pad * 2;
  const h = cssH - pad * 2;

  const ys = points.map(p => p.score);
  const maxV = Math.max(...ys, 10);
  const minV = Math.min(...ys, 0);

  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + h);
  ctx.lineTo(pad + w, pad + h);
  ctx.stroke();

  ctx.strokeStyle = "#0b5ed7";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const n = points.length;
  for (let i = 0; i < n; i++) {
    const x = pad + (n === 1 ? 0 : (i / (n - 1)) * w);
    const norm = (points[i].score - minV) / (maxV - minV || 1);
    const y = pad + h - norm * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#666";
  ctx.font = "10px system-ui";
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) {
    const x = pad + (n === 1 ? 0 : (i / (n - 1)) * w);
    const label = points[i].dateKey.slice(5); // MM-DD
    ctx.fillText(label, x - 12, pad + h + 14);
  }
}

function summarizeTodayScore(histories) {
  const tKey = todayKey();
  const todays = histories.filter(h => h.dateKey === tKey);
  if (!todays.length) return null;
  return { avg: avg(todays.map(h => h.cpm)), best: Math.max(...todays.map(h => h.cpm)) };
}

function summarize7daysScore(histories) {
  const now = Date.now();
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const last7 = histories.filter(h => h.createdAtMs && h.createdAtMs >= cutoff);
  if (!last7.length) return null;
  return { avg: avg(last7.map(h => h.cpm)), best: Math.max(...last7.map(h => h.cpm)) };
}

function formatCompareScore(todayObj, avg7Obj) {
  if (!todayObj || !avg7Obj) {
    compareTodayEl.textContent = "データが不足しています（履歴が増えると表示されます）。";
    return;
  }
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  const avgDelta = todayObj.avg - avg7Obj.avg;
  const bestDelta = todayObj.best - avg7Obj.best;

  compareTodayEl.innerHTML =
    `今日：平均 ${todayObj.avg} / ベスト ${todayObj.best}<br>` +
    `過去7日平均：平均 ${avg7Obj.avg} / ベスト ${avg7Obj.best}<br>` +
    `差分：平均 ${sign(avgDelta)} / ベスト ${sign(bestDelta)}`;
}

async function loadMyAnalytics(uid, userName) {
  try {
    const colRef = collection(db, "scores");
    const q = query(colRef, where("uid", "==", uid));
    const snap = await getDocs(q);

    const rows = [];
    snap.forEach(docu => {
      const d = docu.data();
      const ts = d.createdAt;
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
      rows.push({
        userName: d.userName ?? "",
        dateKey: d.dateKey ?? "",
        difficulty: d.difficulty ?? "",
        lengthGroup: d.lengthGroup ?? "",
        theme: d.theme ?? "",
        rank: d.rank ?? "-",
        cpm: Number(d.cpm ?? 0),
        createdAtMs: ms
      });
    });

    const mineAll = rows.filter(r => r.userName === userName);

    mineAll.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

    const view = mineAll.filter(r => r.difficulty === activeDiffTab);

    renderRecent(view);
    renderBestForSelectedDifficulty(view);

    const series = buildDailyBestSeries(view);
    drawScoreChart(series);

    const t = summarizeTodayScore(view);
    const a7 = summarize7daysScore(view);
    formatCompareScore(t, a7);

    updateLabels();
  } catch (e) {
    console.error("analytics load error", e);
    bestByDifficultyUL.innerHTML = "<li>分析の読み込みに失敗しました</li>";
    myRecentUL.innerHTML = "<li>分析の読み込みに失敗しました</li>";
    compareTodayEl.textContent = "分析の読み込みに失敗しました。";
    drawScoreChart([]);
  }
}

/* =========================
   Save score (auto)
========================= */
async function saveScoreToScoresCollection({ uid, userName, metrics, item }) {
  const score = metrics.cpm;
  const rank = rankByScore(score);

  await addDoc(collection(db, "scores"), {
    uid,
    userName,
    cpm: score,
    rank,
    difficulty: item.difficulty,
    lengthGroup: item.lengthGroup,
    category: item.category,
    theme: item.theme,
    dateKey: todayKey(),
    createdAt: serverTimestamp()
  });
}

/* =========================
   Finish handler
========================= */
async function onFinished(metrics, meta) {
  const user = auth.currentUser;
  if (!user) return;

  const userName = userMgr.getCurrentUserName() || "ゲスト";

  try {
    await saveScoreToScoresCollection({
      uid: user.uid,
      userName,
      metrics,
      item: meta
    });
  } catch (e) {
    console.error("save score failed", e);
  }

  const rank = rankByScore(metrics.cpm);
  mRank.textContent = rank;
  mCPM.textContent = String(metrics.cpm);
  mTimeSec.textContent = String(metrics.seconds ?? "-");
  mLen.textContent = String(metrics.length ?? "-");

  const th = meta?.theme ?? "-";
  const df = meta?.difficulty ?? "-";
  const lg = meta?.lengthGroup ?? "-";
  mMeta.textContent = `ユーザー：${userName} / 難度：${diffLabel(df)} / 文長：${lengthLabel(lg)} / テーマ：${th} / 日付：${todayKey()}`;

  showModal();

  updateLabels();
  await loadDailyRanking();
  await loadRanking();
  await loadMyAnalytics(user.uid, userName);
}

/* =========================
   Events（null安全版）
========================= */
if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    hideModal();
    setNewText();
  });
}

if (startBtn) {
  startBtn.addEventListener("click", async () => {
    hideModal();
    await startWithCountdown();
  });
}

if (dailyThemeEl) {
  dailyThemeEl.addEventListener("change", () => {
    applyThemeOptionsByCategory();
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });
}

// ★出題難度の変更：成績・分析タブには連動しない
if (difficultyEl) {
  difficultyEl.addEventListener("change", () => {
    setNewText();
  });
}

// 出題側の長さ変更：ランキング・分析の長さにも反映
if (lengthGroupEl) {
  lengthGroupEl.addEventListener("change", () => {
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });
}

if (categoryEl) {
  categoryEl.addEventListener("change", () => {
    applyThemeOptionsByCategory();
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });
}

if (themeEl) {
  themeEl.addEventListener("change", () => {
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => hideModal());
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    hideModal();
    setNewText();
  });
}

userMgr.onChange = async () => {
  const user = auth.currentUser;
  if (user) await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  updateLabels();
};

// Spaceキーでスタート（document は null にならない）
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (!currentItem) return;
  if (engine.started || countdownTimer) return;
  if (!inputEl || !inputEl.disabled) return;

  e.preventDefault();
  startWithCountdown();
});

/* =========================
   ★成績・分析タブイベント
   タブ変更 → 出題難度・出題文は変えない（完全に非連動）
========================= */
function attachUnifiedDiffTabs() {
  const root = document.getElementById("diffTabsUnified");
  if (!root) return;

  root.querySelectorAll(".diffTab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const diff = btn.dataset.diff;

      // 成績・分析側の難度だけ変更
      setActiveDiffTab(diff);

      updateLabels();
      await loadDailyRanking();
      await loadRanking();

      const user = auth.currentUser;
      if (user) {
        await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
      }
    });
  });
}


/* =========================
   Init
========================= */
async function init() {
  updateLabels();

  textEl.textContent = "初期化中...";
  inputEl.value = "";
  inputEl.disabled = true;

  let raw = null;
  try {
    raw = await loadTrivia();
  } catch (e) {
    console.error("trivia load failed", e);
    textEl.textContent = "見本文の初期化に失敗しました。Consoleを確認してください。";
    inputEl.disabled = true;
    return;
  }

  buildIndices(raw);
  hydrateSelects();

  // 成績・分析タブは初期値 normal（出題難度とは同期しない）
  setActiveDiffTab("normal");

  applyThemeOptionsByCategory();
  setNewText();

  attachUnifiedDiffTabs();

  await loadDailyRanking();
  await loadRanking();
}

// 匿名認証必須
authBadge.textContent = "認証：準備中…";
signInAnonymously(auth).catch((e) => {
  console.error("anonymous auth failed", e);
  authBadge.textContent = "認証：失敗（Consoleを確認）";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  authBadge.textContent = `認証：OK（匿名）`;

  await init();
  await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
});

