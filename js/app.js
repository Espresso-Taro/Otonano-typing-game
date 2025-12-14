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
const dailyRankingUL = document.getElementById("dailyRanking");

const rankLabel = document.getElementById("rankLabel");
const rankingUL = document.getElementById("ranking");

const analyticsTitle = document.getElementById("analyticsTitle");
const bestByDifficultyUL = document.getElementById("bestByDifficulty");
const compareTodayEl = document.getElementById("compareToday");
const scoreChart = document.getElementById("scoreChart");
const myRecentUL = document.getElementById("myRecent");

const modalBackdrop = document.getElementById("resultModalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const nextBtn = document.getElementById("nextBtn");

const mRank = document.getElementById("mRank");
const mCPM = document.getElementById("mCPM");
const mTimeSec = document.getElementById("mTimeSec");
const mLen = document.getElementById("mLen");
const mMeta = document.getElementById("mMeta");

/* =========================
   成績・分析用 難度タブ
========================= */
let activeDiffTab = "normal";

function setActiveDiffTab(diff) {
  if (!diff) return;
  activeDiffTab = diff;
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
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
}
function hideModal() {
  modalBackdrop.style.display = "none";
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
   Ranking + Analytics 表示
========================= */
function updateLabels() {
  const dailyThemeTxt = dailyTheme ?? "—";

  if (dailyRankingTitle) {
    dailyRankingTitle.textContent =
      `今日のテーマランキング（固定表示：${dailyThemeTxt}）`;
  }

  rankLabel.textContent = "全体ランキング";

  const userName = userMgr.getCurrentUserName() || "ゲスト";
  analyticsTitle.textContent = `入力分析（選択ユーザー：${userName}）`;
}

function renderBestForSelectedDifficulty(histories) {
  bestByDifficultyUL.innerHTML = "";
  if (!histories.length) {
    bestByDifficultyUL.innerHTML = "<li>まだ履歴がありません</li>";
    return;
  }

  const best = histories.reduce((a, b) =>
    Number(a.cpm) > Number(b.cpm) ? a : b
  );

  const li = document.createElement("li");
  li.textContent =
    `ランク：${best.rank}` +
    `｜スコア：${best.cpm}` +
    `｜長さ：${lengthLabel(best.lengthGroup)}` +
    `｜テーマ：${best.theme}`;
  bestByDifficultyUL.appendChild(li);
}

function renderRecent(histories) {
  myRecentUL.innerHTML = "";
  histories.slice(0, 12).forEach(h => {
    const li = document.createElement("li");
    li.textContent =
      `${h.userName}` +
      `｜ランク：${h.rank}` +
      `｜スコア：${h.cpm}` +
      `｜長さ：${lengthLabel(h.lengthGroup)}` +
      `｜テーマ：${h.theme}`;
    myRecentUL.appendChild(li);
  });
}

/* =========================
   Events（null安全）
========================= */
if (skipBtn) skipBtn.addEventListener("click", () => { hideModal(); setNewText(); });
if (startBtn) startBtn.addEventListener("click", async () => { hideModal(); await startWithCountdown(); });
if (closeModalBtn) closeModalBtn.addEventListener("click", hideModal);
if (nextBtn) nextBtn.addEventListener("click", () => { hideModal(); setNewText(); });

document.addEventListener("keydown", e => {
  if (e.code === "Space" && inputEl.disabled) {
    e.preventDefault();
    startWithCountdown();
  }
});

/* =========================
   Init
========================= */
authBadge.textContent = "認証：準備中…";
signInAnonymously(auth);

onAuthStateChanged(auth, async user => {
  if (!user) return;
  authBadge.textContent = "認証：OK（匿名）";
  updateLabels();
});
