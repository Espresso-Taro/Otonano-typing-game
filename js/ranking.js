// js/ranking.js
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Utils
========================= */
function lengthLabel(v) {
  if (v === "xs") return "極短";
  if (v === "short") return "短";
  if (v === "medium") return "中";
  if (v === "long") return "長";
  if (v === "xl") return "極長";
  return "-";
}

/* =========================
   Ranking Service
========================= */
export class RankingService {
  constructor({ db }) {
    this.db = db;
  }

  /* =========================
     Fetch scores (core)
     ★ groupId 対応
  ========================= */
  async _fetchScores({
    theme = null,
    category = null,
    dateKey = null,
    difficulty,
    lengthGroup,
    groupId = undefined, // ★追加：undefined=無条件 / null=個人 / string=グループ
    maxFetch = 800
  }) {
    const colRef = collection(this.db, "scores");
    const filters = [];

    // ----- 既存条件 -----
    if (theme) filters.push(where("theme", "==", theme));
    if (category) filters.push(where("category", "==", category));
    if (dateKey) filters.push(where("dateKey", "==", dateKey));
    if (difficulty) filters.push(where("difficulty", "==", difficulty));
    if (lengthGroup) filters.push(where("lengthGroup", "==", lengthGroup));

    // ----- グループ条件 -----
    // undefined → 条件なし（従来互換）
    // null → 個人（groupId == null）
    // string → 特定グループ
    if (groupId !== undefined) {
      if (groupId === null) {
        filters.push(where("groupId", "==", null));
      } else {
        filters.push(where("groupId", "==", groupId));
      }
    }

    const q = query(colRef, ...filters, limit(maxFetch));
    const snap = await getDocs(q);

    const rows = [];
    snap.forEach(d => {
      rows.push({ id: d.id, ...d.data() });
    });

    return rows;
  }

  /* =========================
     Sort & Top10
  ========================= */
  _sortAndTop10(rows) {
    return rows
      .slice()
      .sort((a, b) => {
        const ac = Number(a.cpm ?? -999999);
        const bc = Number(b.cpm ?? -999999);
        if (bc !== ac) return bc - ac;

        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      })
      .slice(0, 10);
  }

  /* =========================
     Public APIs
     （すべて groupId 対応）
  ========================= */
  async loadOverall({ difficulty, lengthGroup, groupId = undefined }) {
    const rows = await this._fetchScores({
      difficulty,
      lengthGroup,
      groupId
    });
    return this._sortAndTop10(rows);
  }

  async loadByCategory({ category, difficulty, lengthGroup, groupId = undefined }) {
    if (!category || category === "all") {
      return this.loadOverall({ difficulty, lengthGroup, groupId });
    }
    const rows = await this._fetchScores({
      category,
      difficulty,
      lengthGroup,
      groupId
    });
    return this._sortAndTop10(rows);
  }

  async loadByTheme({ theme, difficulty, lengthGroup, groupId = undefined }) {
    if (!theme || theme === "all") {
      return this.loadOverall({ difficulty, lengthGroup, groupId });
    }
    const rows = await this._fetchScores({
      theme,
      difficulty,
      lengthGroup,
      groupId
    });
    return this._sortAndTop10(rows);
  }

  async loadDailyTheme({
    theme,
    dateKey,
    difficulty,
    lengthGroup,
    groupId = undefined
  }) {
    if (!theme || !dateKey) return [];

    const rows = await this._fetchScores({
      theme,
      dateKey,
      difficulty,
      lengthGroup,
      groupId
    });
    return this._sortAndTop10(rows);
  }

  /* =========================
     Render
  ========================= */
  renderList(ul, rows) {
    ul.innerHTML = "";

    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "まだスコアがありません。";
      ul.appendChild(li);
      return;
    }

    rows.forEach((r) => {
      const li = document.createElement("li");

      const userName = r.userName ?? "no-name";
      const rank = r.rank ?? "-";
      const score = Number(r.cpm ?? 0);
      const lg = lengthLabel(r.lengthGroup);
      const theme = r.theme ?? "-";

      // ★既存と完全同一フォーマット
      li.textContent = `${userName}｜${rank}｜${score}｜${lg}｜${theme}`;
      ul.appendChild(li);
    });
  }
}
