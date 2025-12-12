// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { RankingManager } from "./ranking.js";

/* =========================
   Firebase 初期化
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
   認証（必須）
========================= */
await signInAnonymously(auth);

/* =========================
   RankingManager
========================= */
const rankingManager = new RankingManager(db);

/* =========================
   DOM
========================= */
const dailyRankingUL = document.getElementById("dailyRanking");
const rankingUL = document.getElementById("ranking");
const rankLabel = document.getElementById("rankLabel");
const dailyRankLabel = document.getElementById("dailyRankLabel");

const difficultySelect = document.getElementById("difficulty");
const categorySelect = document.getElementById("category");
const themeSelect = document.getElementById("theme");
const dailyThemeCheckbox = document.getElementById("dailyTheme");
const rankScopeSelect = document.getElementById("rankScope");

/* =========================
   Utils
========================= */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function clearList(ul) {
  ul.innerHTML = "";
}

function renderEmpty(ul, msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  ul.appendChild(li);
}

function renderRanking(ul, list) {
  clearList(ul);
  if (!list.length) {
    renderEmpty(ul, "まだスコアがありません");
    return;
  }
  list.forEach((r, i) => {
    const li = document.createElement("li");
    li.textContent =
      `${i+1}. ${r.userName} ｜ CPM ${r.cpm} / KPM ${r.kpm} ｜ ランク ${r.rank}`;
    ul.appendChild(li);
  });
}

/* =========================
   今日のテーマランキング
========================= */
async function loadDailyThemeRanking() {
  clearList(dailyRankingUL);

  const theme = themeSelect.value;
  if (!dailyThemeCheckbox.checked || theme === "すべて") {
    renderEmpty(dailyRankingUL, "日替わりテーマが有効ではありません");
    return;
  }

  try {
    const list = await rankingManager.loadTodayThemeRanking({
      theme,
      difficulty: difficultySelect.value,
      dateKey: todayKey()
    });

    dailyRankLabel.textContent =
      `今日のテーマ「${theme}」ランキング`;

    renderRanking(dailyRankingUL, list);
  } catch (e) {
    console.error(e);
    renderEmpty(dailyRankingUL, "ランキングの読み込みに失敗しました");
  }
}

/* =========================
   通常ランキング
========================= */
async function loadRanking() {
  clearList(rankingUL);

  const scope = rankScopeSelect.value;
  const difficulty = difficultySelect.value;

  try {
    let list = [];

    if (scope === "overall") {
      rankLabel.textContent = "全体ランキング";
      list = await rankingManager.loadOverallRanking({ difficulty });
    }

    if (scope === "category") {
      const category = categorySelect.value;
      rankLabel.textContent = `カテゴリ「${category}」ランキング`;
      list = await rankingManager.loadCategoryRanking({
        category,
        difficulty
      });
    }

    if (scope === "theme") {
      const theme = themeSelect.value;
      rankLabel.textContent = `テーマ「${theme}」ランキング`;
      list = await rankingManager.loadThemeRanking({
        theme,
        difficulty
      });
    }

    renderRanking(rankingUL, list);

  } catch (e) {
    console.error(e);
    renderEmpty(rankingUL, "ランキングの読み込みに失敗しました");
  }
}

/* =========================
   スコア保存（自動）
========================= */
export async function saveScore({
  user,
  cpm,
  kpm,
  rank,
  rankingScore,
  difficulty,
  category,
  theme
}) {
  if (!user) return;

  await addDoc(collection(db, "scores"), {
    uid: user.uid,
    userName: user.displayName || "no-name",
    cpm,
    kpm,
    rank,
    rankingScore,
    difficulty,
    category,
    theme,
    dateKey: todayKey(),
    createdAt: serverTimestamp()
  });
}

/* =========================
   イベント
========================= */
[
  difficultySelect,
  categorySelect,
  themeSelect,
  dailyThemeCheckbox,
  rankScopeSelect
].forEach(el => {
  el.addEventListener("change", async () => {
    await loadDailyThemeRanking();
    await loadRanking();
  });
});

/* =========================
   認証完了後 初期ロード
========================= */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  document.getElementById("authBadge").textContent = "認証：OK（匿名）";

  await loadDailyThemeRanking();
  await loadRanking();
});
