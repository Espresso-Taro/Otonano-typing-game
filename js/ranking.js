// js/ranking.js
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class RankingService {
  constructor({ db }) {
    this.db = db;
  }

  // 安全に取得（インデックス依存を避ける）
  async _fetchScores({
    theme = null,
    category = null,
    dateKey = null,
    difficulty = null,
    maxFetch = 800
  }) {
    const colRef = collection(this.db, "scores");
    const filters = [];

    if (theme) filters.push(where("theme", "==", theme));
    if (category) filters.push(where("category", "==", category));
    if (dateKey) filters.push(where("dateKey", "==", dateKey));
    if (difficulty && difficulty !== "all") filters.push(where("difficulty", "==", difficulty));

    const q = query(colRef, ...filters, limit(maxFetch));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
  }

  _sortAndTop10(rows) {
    // rankingScore desc, tie: cpm desc, tie: kpm desc
    const sorted = rows.slice().sort((a, b) => {
      const as = Number(a.rankingScore ?? -999999);
      const bs = Number(b.rankingScore ?? -999999);
      if (bs !== as) return bs - as;
      const ac = Number(a.cpm ?? -999999);
      const bc = Number(b.cpm ?? -999999);
      if (bc !== ac) return bc - ac;
      const ak = Number(a.kpm ?? -999999);
      const bk = Number(b.kpm ?? -999999);
      return bk - ak;
    });
    return sorted.slice(0, 10);
  }

  async loadOverall({ difficulty = "all" }) {
    const rows = await this._fetchScores({ difficulty, maxFetch: 800 });
    return this._sortAndTop10(rows);
  }

  async loadByCategory({ category, difficulty = "all" }) {
    if (!category || category === "all") return this.loadOverall({ difficulty });
    const rows = await this._fetchScores({ category, difficulty, maxFetch: 800 });
    return this._sortAndTop10(rows);
  }

  async loadByTheme({ theme, difficulty = "all" }) {
    if (!theme || theme === "all") return this.loadOverall({ difficulty });
    const rows = await this._fetchScores({ theme, difficulty, maxFetch: 800 });
    return this._sortAndTop10(rows);
  }

  // 今日のテーマランキング：theme + dateKey 完全一致（別テーマ混入防止）
  async loadDailyTheme({ theme, dateKey, difficulty = "all" }) {
    if (!theme || !dateKey) return [];
    const rows = await this._fetchScores({ theme, dateKey, difficulty, maxFetch: 800 });
    return this._sortAndTop10(rows);
  }

  renderList(ul, rows) {
    ul.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "まだスコアがありません。";
      ul.appendChild(li);
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const li = document.createElement("li");
      const name = r.userName ?? "no-name";
      const cpm = r.cpm ?? "-";
      const kpm = r.kpm ?? "-";
      const rank = r.rank ?? "-";
      const score = r.rankingScore ?? "-";
      li.textContent = `${i + 1}. ${name}｜Score ${score}｜CPM ${cpm}｜KPM ${kpm}｜${rank}`;
      ul.appendChild(li);
    }
  }
}
