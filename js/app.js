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
import { GroupService } from "./groupService.js";

/* =========================
   Firebase init
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAqDSPE_HkPbi-J-SqPL4Ys-wR4RaA8wKA",
  authDomain: "otonano-typing-game.firebaseapp.com",
  projectId: "otonano-typing-game",
  storageBucket: "otonano-typing-game.firebasestorage.app",
  messagingSenderId: "475283850178",
  appId: "1:475283850178:web:193d28f17be20a232f4c5b",
  measurementId: "G-JE1X0NCNHB"
  
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

const dailyThemeEl = document.getElementById("dailyTask"); // index.html 側の id に合わせる（重要）
const inputEl = document.getElementById("typingInput");
const textEl = document.getElementById("typingText");
const skipBtn = document.getElementById("skipBtn");
const startBtn = document.getElementById("startBtn");

const modalEl = document.getElementById("modal");
const modalTitleEl = document.getElementById("modalTitle");
const modalMsgEl = document.getElementById("modalMsg");
const modalOkBtn = document.getElementById("modalOkBtn");

const analyticsBox = document.getElementById("analyticsBox");
const analyticsLabel = document.getElementById("analyticsLabel");
const analyticsUL = document.getElementById("analytics");

const dailyRankingUL = document.getElementById("dailyRanking");

// 元の app.js は rankScopeEl / rankLabel を参照しているため残す（HTML 側に無い場合も落ちないよう後でガード）
const rankScopeEl = document.getElementById("rankScope");
const rankLabel = document.getElementById("rankLabel");
const rankingUL = document.getElementById("ranking");

// グループランキング用（index.html に groupRankingBox / groupRankLabel / groupRanking がある前提）
const groupRankingBox = document.getElementById("groupRankingBox");
const groupRankLabel = document.getElementById("groupRankLabel");
const groupRankingUL = document.getElementById("groupRanking");

const bestByDifficultyUL = document.getElementById("bestByDifficulty");
const compareTodayEl = document.getElementById("compareToday");
const scoreChart = document.getElementById("scoreChart");
const scoreChartModeEl = document.getElementById("scoreChartMode");
const scoreChartScopeEl = document.getElementById("scoreChartScope");

const unifiedDiffTabs = document.getElementById("unifiedDiffTabs");

/* =========================
   Group UI (存在する場合のみ)
========================= */
const groupUI = document.getElementById("groupUI");
const groupCreateName = document.getElementById("groupCreateName");
const groupCreateBtn = document.getElementById("groupCreateBtn");
const groupSearchKey = document.getElementById("groupSearchKey");
const groupSearchBtn = document.getElementById("groupSearchBtn");
const groupSearchResult = document.getElementById("groupSearchResult");
const joinBtn = document.getElementById("joinBtn");
const currentGroupSelect = document.getElementById("currentGroupSelect");
const leaveGroupBtn = document.getElementById("leaveGroupBtn");
const deleteGroupBtn = document.getElementById("deleteGroupBtn");
const pendingBox = document.getElementById("pendingBox");
const pendingList = document.getElementById("pendingList");

/* =========================
   Services
========================= */
const userMgr = new UserManager(db);
const engine = new TypingEngine();
const rankingSvc = new RankingService(db);
const groupSvc = new GroupService(db);

/* =========================
   State
========================= */
let triviaRaw = null;
let allTrivia = [];
let pool = [];
let currentItem = null;

let activeDiffTab = "easy"; // "easy" | "normal" | "hard"
let dailyTheme = null;      // 今日の課題テーマ（既存コードとの整合のため残す）

// 参加中グループ
const GROUP_STORAGE_KEY = "currentGroupId";
let currentGroupId = "";
let currentGroupRole = null;

// グループUIイベント重複防止
let groupEventsBound = false;

/* =========================
   Utils
========================= */
function hasGroupUI() {
  return !!groupUI && !!currentGroupSelect && !!groupSvc;
}

function showModal(title, msg) {
  if (!modalEl) return;
  modalTitleEl.textContent = title || "";
  modalMsgEl.textContent = msg || "";
  modalEl.style.display = "block";
}

function hideModal() {
  if (!modalEl) return;
  modalEl.style.display = "none";
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffLabel(diff) {
  if (diff === "easy") return "易";
  if (diff === "normal") return "普";
  if (diff === "hard") return "難";
  return diff;
}

/* =========================
   Daily Task 固定ルール
========================= */
function getDailyLengthByDifficulty(diff) {
  if (diff === "easy") return "xs";        // 易 → 極短
  if (diff === "normal") return "medium";  // 普 → 中
  if (diff === "hard") return "xl";        // 難 → 極長
  return null;
}

function pickDailyItem(poolArr, difficulty, dateKey) {
  if (!poolArr || poolArr.length === 0) return null;
  const seed = `${dateKey}-${difficulty}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const idx = hash % poolArr.length;
  return poolArr[idx];
}

/* =========================
   Trivia load/build
========================= */
async function loadTrivia() {
  const res = await fetch("./trivia.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("trivia.json load failed");
  return await res.json();
}

function buildIndices(raw) {
  triviaRaw = raw;
  allTrivia = Array.isArray(raw) ? raw : (raw?.items || []);
  pool = allTrivia.slice();
}

function hydrateSelects() {
  // 既存コード準拠（ここでは triviaRaw の実データ構造に依存）
  // 必要な option 生成が既にある前提で、あなたの元コードに合わせる
}

function applyThemeOptionsByCategory() {
  const daily = !!(dailyThemeEl && dailyThemeEl.checked);

  // ★今日の課題中は文章長を固定（操作不可）
  if (lengthGroupEl) {
    lengthGroupEl.disabled = daily;
  }

  // 今日の課題ON時は lengthGroup の表示も同期する
  if (daily && lengthGroupEl) {
    const forced = getDailyLengthByDifficulty(difficultyEl.value);
    if (forced) lengthGroupEl.value = forced;
  }
}

/* =========================
   Filters / Picking
========================= */
function getActiveFilters() {
  const daily = !!(dailyThemeEl && dailyThemeEl.checked && !!dailyTheme);
  const difficulty = difficultyEl.value;

  // ★今日の課題中は lengthGroup を難度で強制
  const lengthGroup = daily
    ? getDailyLengthByDifficulty(difficulty)
    : lengthGroupEl.value;

  const category = daily ? "all" : categoryEl.value;
  const theme = daily ? dailyTheme : themeEl.value;

  return { daily, difficulty, lengthGroup, category, theme };
}

function filterPool() {
  const { difficulty, lengthGroup, category, theme, daily } = getActiveFilters();

  let arr = allTrivia.slice();

  // 難度
  if (difficulty) {
    arr = arr.filter(t => (t.difficulty || "easy") === difficulty);
  }

  // 長さ
  if (lengthGroup) {
    arr = arr.filter(t => (t.lengthGroup || "") === lengthGroup);
  }

  // カテゴリ（dailyでは all）
  if (category && category !== "all") {
    arr = arr.filter(t => (t.category || "") === category);
  }

  // テーマ（dailyでは dailyTheme）
  if (theme && theme !== "all" && theme !== "random") {
    arr = arr.filter(t => (t.theme || "") === theme);
  }

  pool = arr;
}

function pickNextItem(poolArr) {
  if (!poolArr || poolArr.length === 0) return null;
  const idx = Math.floor(Math.random() * poolArr.length);
  return poolArr[idx];
}

function setNewText() {
  filterPool();

  if (!pool || pool.length === 0) {
    textEl.textContent = "該当する文章がありません。条件を変えてください。";
    currentItem = null;
    return;
  }

  const { daily, difficulty } = getActiveFilters();

  // ★今日の課題は「日付×難度」で1文固定
  const pick = daily
    ? pickDailyItem(pool, difficulty, todayKey())
    : pickNextItem(pool);

  if (!pick) {
    textEl.textContent = "文章の取得に失敗しました。";
    currentItem = null;
    return;
  }

  currentItem = pick;
  textEl.textContent = pick.text || pick.sentence || "";
  engine.reset(textEl.textContent);

  inputEl.value = "";
  inputEl.disabled = false;
  inputEl.focus();
}

/* =========================
   Labels / UI
========================= */
function updateLabels() {
  const { difficulty, lengthGroup, category, theme } = getActiveFilters();
  const diffTxt = diffLabel(difficulty);
  const lenTxt = lengthGroup || "-";
  const catTxt = category || "-";
  const thTxt = theme || "-";

  if (metaInfoEl) {
    metaInfoEl.textContent = `難度：${diffTxt} / 長さ：${lenTxt} / カテゴリ：${catTxt} / テーマ：${thTxt}`;
  }
}

/* =========================
   Ranking loaders
========================= */
async function loadDailyRanking() {
  try {
    const { lengthGroup, difficulty } = getActiveFilters();

    const rows = await rankingSvc.loadDailyTheme({
      theme: dailyTheme,
      dateKey: todayKey(),
      difficulty,
      lengthGroup,
      groupId: currentGroupId ? currentGroupId : null
    });

    rankingSvc.renderList(dailyRankingUL, rows);
  } catch (e) {
    console.error("daily ranking load error", e);
    if (dailyRankingUL) dailyRankingUL.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
  }
}

async function loadRanking() {
  try {
    const scope = rankScopeEl ? rankScopeEl.value : "overall";

    let rows = [];
    if (scope === "overall") {
      // ★全国ランキング：難度のみ（長さ/テーマはフィルタしない）
      rows = await rankingSvc.loadOverall({
        difficulty: activeDiffTab
      });
    } else if (scope === "category") {
      // 互換：UIが残っている場合のため（ただし長さ/テーマはフィルタしない仕様に寄せるなら difficulty のみ推奨）
      const category = categoryEl ? categoryEl.value : "all";
      rows = await rankingSvc.loadByCategory({
        category,
        difficulty: activeDiffTab
      });
    } else if (scope === "theme") {
      const th = themeEl ? themeEl.value : "all";
      rows = await rankingSvc.loadByTheme({
        theme: th,
        difficulty: activeDiffTab
      });
    } else {
      rows = await rankingSvc.loadOverall({
        difficulty: activeDiffTab
      });
    }

    rankingSvc.renderList(rankingUL, rows);
  } catch (e) {
    console.error("ranking load error", e);
    if (rankingUL) rankingUL.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
  }
}

async function loadGroupRanking() {
  // UI が無い場合（index.html 未更新など）は何もしない
  if (!groupRankingBox || !groupRankingUL) return;

  // グループ未参加なら非表示
  if (!currentGroupId) {
    groupRankingBox.style.display = "none";
    groupRankingUL.innerHTML = "";
    if (groupRankLabel) groupRankLabel.textContent = "";
    return;
  }

  groupRankingBox.style.display = "block";

  try {
    // ★グループランキング：難度のみ（長さ/テーマはフィルタしない）＋ groupId
    const rows = await rankingSvc.loadOverall({
      difficulty: activeDiffTab,
      groupId: currentGroupId
    });

    if (groupRankLabel) {
      const sel = (hasGroupUI() && currentGroupSelect && currentGroupSelect.selectedOptions && currentGroupSelect.selectedOptions[0])
        ? currentGroupSelect.selectedOptions[0]
        : null;
      const gName = sel?.textContent || currentGroupId;
      groupRankLabel.textContent = `グループ：${gName} / 難度：${diffLabel(activeDiffTab)}`;
    }

    rankingSvc.renderList(groupRankingUL, rows);
  } catch (e) {
    console.error("group ranking load error", e);
    groupRankingUL.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
  }
}

/* =========================
   Analytics（選択ユーザー）
========================= */
async function loadMyAnalytics(uid, userName) {
  if (!analyticsBox || !analyticsUL) return;

  try {
    const histories = await userMgr.getHistories(uid);
    analyticsUL.innerHTML = "";
    if (!histories || histories.length === 0) {
      const li = document.createElement("li");
      li.textContent = "履歴がありません";
      analyticsUL.appendChild(li);
      return;
    }

    const best = Math.max(...histories.map(h => Number(h.cpm ?? 0)));
    const li = document.createElement("li");
    li.textContent = `ベスト: ${best} CPM`;
    analyticsUL.appendChild(li);

    if (analyticsLabel) {
      const { difficulty, lengthGroup, theme } = getActiveFilters();
      const diffTxt = diffLabel(difficulty);
      const lenTxt = lengthGroup || "-";
      const thTxt = theme || "-";
      analyticsLabel.textContent = `難度：${diffTxt} / 長さ：${lenTxt} / テーマ：${thTxt}`;
    }
  } catch (e) {
    console.error("analytics load error", e);
  }
}

/* =========================
   Score submit
========================= */
async function submitScore(cpm) {
  const user = auth.currentUser;
  if (!user) return;

  const name = userMgr.getCurrentUserName() || "(no name)";
  const { daily, difficulty, lengthGroup, category, theme } = getActiveFilters();

  const docData = {
    uid: user.uid,
    userName: name,
    cpm: Number(cpm),
    createdAt: serverTimestamp(),

    // ranking filters
    daily: !!daily,
    dateKey: todayKey(),
    difficulty,
    lengthGroup,
    category,
    theme,

    // group
    groupId: currentGroupId ? currentGroupId : null
  };

  await addDoc(collection(db, "scores"), docData);
}

/* =========================
   Typing events
========================= */
function bindTyping() {
  inputEl.addEventListener("input", async () => {
    const v = inputEl.value || "";
    const result = engine.input(v);
    if (result.done) {
      inputEl.disabled = true;
      const cpm = result.cpm;

      try {
        await submitScore(cpm);
      } catch (e) {
        console.error("submitScore failed", e);
        showModal("エラー", "スコアの保存に失敗しました。");
        return;
      }

      showModal("結果", `CPM: ${cpm}`);

      // ランキング更新
      await loadDailyRanking();
      await loadRanking();
      await loadGroupRanking();

      const user = auth.currentUser;
      if (user) {
        await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
      }
    }
  });

  skipBtn.addEventListener("click", () => {
    hideModal();

    // ★今日の課題が ON なら自動で OFF にする
    if (dailyThemeEl && dailyThemeEl.checked) {
      dailyThemeEl.checked = false;

      // 今日の課題用 UI 状態を通常に戻す
      applyThemeOptionsByCategory();
    }

    // 通常モードで別の文章を出す
    setNewText();
    updateLabels();

    // ランキング更新
    loadDailyRanking();
    loadRanking();
    loadGroupRanking();
  });

  startBtn?.addEventListener("click", () => {
    hideModal();
    setNewText();
    updateLabels();
  });

  modalOkBtn?.addEventListener("click", () => {
    hideModal();
    inputEl.focus();
  });
}

/* =========================
   Difficulty unified tabs
========================= */
function setActiveDiffTab(diff, opts = {}) {
  activeDiffTab = diff;
  if (opts.syncDifficultySelect !== false && difficultyEl) {
    difficultyEl.value = diff;
  }
}

function attachUnifiedDiffTabs() {
  if (!unifiedDiffTabs) return;
  const btns = unifiedDiffTabs.querySelectorAll("[data-diff]");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const diff = btn.dataset.diff;
      if (!diff) return;
      setActiveDiffTab(diff, { syncDifficultySelect: true });

      // 今日の課題中は長さUIも追従
      if (dailyThemeEl && dailyThemeEl.checked && lengthGroupEl) {
        const forced = getDailyLengthByDifficulty(difficultyEl.value);
        if (forced) lengthGroupEl.value = forced;
      }

      applyThemeOptionsByCategory();
      setNewText();
      updateLabels();

      loadDailyRanking();
      loadRanking();
      loadGroupRanking();

      const user = auth.currentUser;
      if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
    });
  });
}

/* =========================
   Group feature
========================= */
function hasGroupUIElements() {
  return hasGroupUI()
    && groupCreateName && groupCreateBtn
    && groupSearchKey && groupSearchBtn
    && groupSearchResult && joinBtn
    && leaveGroupBtn && deleteGroupBtn
    && pendingBox && pendingList;
}

function bindGroupEventsOnce() {
  if (!hasGroupUIElements()) return;
  if (groupEventsBound) return;
  groupEventsBound = true;

  groupCreateBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const name = (groupCreateName.value || "").trim();
    if (!name) {
      showModal("注意", "グループ名を入力してください。");
      return;
    }

    try {
      const gid = await groupSvc.createGroup(name, user.uid, userMgr.getCurrentUserName());
      showModal("作成", "グループを作成しました。");

      groupCreateName.value = "";
      await refreshMyGroups();
      currentGroupSelect.value = gid;
      await onGroupChanged();
    } catch (e) {
      console.error("createGroup failed", e);
      showModal("エラー", "グループ作成に失敗しました。");
    }
  });

  groupSearchBtn.addEventListener("click", async () => {
    const key = (groupSearchKey.value || "").trim();
    if (!key) {
      groupSearchResult.textContent = "検索キーワードを入力してください。";
      groupSearchResult.dataset.groupId = "";
      return;
    }

    try {
      const list = await groupSvc.searchGroups(key);
      if (!list || list.length === 0) {
        groupSearchResult.textContent = "見つかりませんでした。";
        groupSearchResult.dataset.groupId = "";
        return;
      }

      // 先頭のみ表示（簡易）
      const g = list[0];
      groupSearchResult.textContent = `${g.name}（owner: ${g.ownerName || g.ownerUid}）`;
      groupSearchResult.dataset.groupId = g.id;
    } catch (e) {
      console.error("searchGroups failed", e);
      groupSearchResult.textContent = "検索に失敗しました。";
      groupSearchResult.dataset.groupId = "";
    }
  });

  joinBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const gid = groupSearchResult?.dataset?.groupId || "";
    if (!gid) {
      showModal("注意", "加入したいグループを検索して選択してください。");
      return;
    }

    try {
      await groupSvc.requestJoin(gid, user.uid, userMgr.getCurrentUserName());
      showModal("申請", "参加申請しました。承認されるまでお待ちください。");
    } catch (e) {
      console.error("requestJoin failed", e);
      showModal("エラー", "参加申請に失敗しました。");
    }
  });

  currentGroupSelect.addEventListener("change", onGroupChanged);

  leaveGroupBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!currentGroupId) return;

    try {
      await groupSvc.leaveGroup(currentGroupId, user.uid);
      showModal("退出", "グループから退出しました。");
      await refreshMyGroups();
    } catch (e) {
      console.error("leaveGroup failed", e);
      showModal("エラー", "退出に失敗しました。");
    }
  });

  deleteGroupBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!currentGroupId) return;

    if (currentGroupRole !== "owner") {
      showModal("注意", "グループ削除はオーナーのみ可能です。");
      return;
    }

    try {
      await groupSvc.deleteGroup(currentGroupId);
      showModal("削除", "グループを削除しました。");
      await refreshMyGroups();
    } catch (e) {
      console.error("deleteGroup failed", e);
      showModal("エラー", "グループ削除に失敗しました。");
    }
  });
}

async function refreshMyGroups() {
  if (!hasGroupUI()) return;

  const user = auth.currentUser;
  if (!user) return;

  let groups = [];
  try {
    groups = await groupSvc.getMyGroups(user.uid);
  } catch (e) {
    console.error("getMyGroups failed", e);
    groups = [];
  }

  currentGroupSelect.innerHTML = "";

  // (未選択)
  {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "（グループ未選択）";
    currentGroupSelect.appendChild(opt);
  }

  for (const g of groups) {
    const opt = document.createElement("option");
    opt.value = g.groupId;
    opt.textContent = g.name ?? "(no name)";
    opt.dataset.role = g.role ?? "member";
    currentGroupSelect.appendChild(opt);
  }

  const saved = localStorage.getItem(GROUP_STORAGE_KEY) || "";
  const exists = Array.from(currentGroupSelect.options).some(o => o.value === saved);
  currentGroupSelect.value = exists ? saved : "";

  await onGroupChanged();
}

async function onGroupChanged() {
  if (!hasGroupUI()) return;

  const sel = currentGroupSelect.selectedOptions[0];
  currentGroupId = sel?.value ?? "";
  currentGroupRole = sel?.dataset?.role ?? null;

  localStorage.setItem(GROUP_STORAGE_KEY, currentGroupId);

  // ボタン活性
  leaveGroupBtn.disabled = !currentGroupId;

  // owner のときだけ削除可能
  deleteGroupBtn.disabled = !(currentGroupId && currentGroupRole === "owner");

  // owner のときだけ承認待ち一覧を表示
  if (currentGroupId && currentGroupRole === "owner") {
    pendingBox.style.display = "block";
    await loadPendingRequests();
  } else {
    pendingBox.style.display = "none";
    pendingList.innerHTML = "";
  }

  // ★グループ切替に応じてランキングを再読込
  await loadDailyRanking();
  await loadRanking();
  await loadGroupRanking();
}

async function loadPendingRequests() {
  if (!hasGroupUI()) return;
  if (!currentGroupId) return;

  try {
    const list = await groupSvc.getPendingRequests(currentGroupId);
    pendingList.innerHTML = "";

    if (!list || list.length === 0) {
      const li = document.createElement("li");
      li.textContent = "承認待ちはありません。";
      pendingList.appendChild(li);
      return;
    }

    for (const r of list) {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.gap = "8px";
      li.style.alignItems = "center";

      const span = document.createElement("span");
      span.textContent = `${r.userName || r.uid}`;

      const ok = document.createElement("button");
      ok.textContent = "承認";

      const ng = document.createElement("button");
      ng.textContent = "却下";

      ok.addEventListener("click", async () => {
        try {
          await groupSvc.approveMember(r);
          await loadPendingRequests();
          await refreshMyGroups();
        } catch (e) {
          console.error("approve failed", e);
          showModal("エラー", "承認に失敗しました。");
        }
      });

      ng.addEventListener("click", async () => {
        try {
          await groupSvc.rejectMember(r.id);
          await loadPendingRequests();
        } catch (e) {
          console.error("reject failed", e);
          showModal("エラー", "却下に失敗しました。");
        }
      });

      li.appendChild(span);
      li.appendChild(ok);
      li.appendChild(ng);
      pendingList.appendChild(li);
    }
  } catch (e) {
    console.error("getPendingRequests failed", e);
    pendingList.innerHTML = "<li>承認待ち一覧の取得に失敗しました</li>";
  }
}

/* =========================
   User UI
========================= */
function bindUserUI() {
  addUserBtn.addEventListener("click", async () => {
    const name = prompt("ユーザー名を入力してください（全体で一意）");
    if (!name) return;
    try {
      await userMgr.addUser(name);
      await rebuildUserSelect();
    } catch (e) {
      console.error("addUser failed", e);
      showModal("エラー", "ユーザー作成に失敗しました。");
    }
  });

  renameUserBtn.addEventListener("click", async () => {
    const oldName = userMgr.getCurrentUserName();
    if (!oldName) return;
    const newName = prompt("新しいユーザー名", oldName);
    if (!newName || newName === oldName) return;

    try {
      await userMgr.renameUser(oldName, newName);
      await rebuildUserSelect();
    } catch (e) {
      console.error("renameUser failed", e);
      showModal("エラー", "改名に失敗しました。");
    }
  });

  deleteUserBtn.addEventListener("click", async () => {
    const name = userMgr.getCurrentUserName();
    if (!name) return;
    if (!confirm(`ユーザー「${name}」を削除しますか？`)) return;

    try {
      await userMgr.deleteUser(name);
      await rebuildUserSelect();
    } catch (e) {
      console.error("deleteUser failed", e);
      showModal("エラー", "削除に失敗しました。");
    }
  });

  userSelect.addEventListener("change", async () => {
    const name = userSelect.value;
    userMgr.setCurrentUserName(name);

    const user = auth.currentUser;
    if (user) await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });
}

async function rebuildUserSelect() {
  const list = await userMgr.listUsers();
  userSelect.innerHTML = "";
  for (const u of list) {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    userSelect.appendChild(opt);
  }

  const cur = userMgr.getCurrentUserName();
  if (cur && list.includes(cur)) {
    userSelect.value = cur;
  } else {
    userSelect.value = list[0] || "";
    userMgr.setCurrentUserName(userSelect.value);
  }
}

/* =========================
   Events
========================= */
function bindOptionEvents() {
  difficultyEl.addEventListener("change", () => {
    setActiveDiffTab(difficultyEl.value, { syncDifficultySelect: false });

    // ★ 今日の課題中は長さUIも追従させる
    if (dailyThemeEl && dailyThemeEl.checked && lengthGroupEl) {
      const forced = getDailyLengthByDifficulty(difficultyEl.value);
      if (forced) {
        lengthGroupEl.value = forced;
      }
    }

    applyThemeOptionsByCategory();
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    loadGroupRanking();

    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });

  lengthGroupEl.addEventListener("change", () => {
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    loadGroupRanking();

    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });

  categoryEl.addEventListener("change", () => {
    applyThemeOptionsByCategory();
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    loadGroupRanking();

    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });

  themeEl.addEventListener("change", () => {
    setNewText();
    updateLabels();
    loadDailyRanking();
    loadRanking();
    loadGroupRanking();

    const user = auth.currentUser;
    if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
  });

  if (dailyThemeEl) {
    dailyThemeEl.addEventListener("change", () => {
      // 今日の課題 ON 時は長さUIを同期
      if (dailyThemeEl.checked && lengthGroupEl) {
        const forced = getDailyLengthByDifficulty(difficultyEl.value);
        if (forced) lengthGroupEl.value = forced;
      }

      applyThemeOptionsByCategory();
      setNewText();
      updateLabels();

      // 今日ランキングはチェックに関わらず表示する仕様
      loadDailyRanking();
      loadRanking();
      loadGroupRanking();

      const user = auth.currentUser;
      if (user) loadMyAnalytics(user.uid, userMgr.getCurrentUserName());
    });
  }
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

  // 初期難度は出題セレクトに合わせて、統合タブも同期
  setActiveDiffTab(difficultyEl.value, { syncDifficultySelect: false });

  applyThemeOptionsByCategory();
  setNewText();

  // 統合タブだけ有効化
  attachUnifiedDiffTabs();

  await loadDailyRanking();
  await loadRanking();
  await loadGroupRanking();
}

/* =========================
   Start
========================= */
bindTyping();
bindUserUI();
bindOptionEvents();

// 認証
signInAnonymously(auth).catch((e) => {
  console.error("anonymous auth failed", e);
  authBadge.textContent = "認証：失敗（Consoleを確認）";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  authBadge.textContent = `認証：OK（匿名）`;

  // グループUIがある場合だけイベントを貼る
  bindGroupEventsOnce();

  await init();
  await loadMyAnalytics(user.uid, userMgr.getCurrentUserName());

  // グループUIがある場合だけ参加中グループをロード
  if (hasGroupUI()) {
    await refreshMyGroups();
  }
});

