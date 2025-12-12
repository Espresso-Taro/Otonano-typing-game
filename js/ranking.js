// js/ranking.js
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class RankingService {
  constructor({ db }) {
    this.db = db;
  }

  toKey(s) {
    return String(s ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, "_")
      .replace(/[\/\\?%*:|"<>]/g, "_")
      .replace(/[^0-9A-Za-zぁ-んァ-ン一-龥_（）()・、。-]/g, "_")
      .slice(0, 120) || "empty";
  }

  diffKey(difficulty) {
    return (difficulty === "all") ? "diff_all" : `diff_${difficulty}`;
  }

  calcRankingScore({ cpm, kpm }) {
    const eff = (kpm > 0) ? (cpm / kpm) : 0;
    const waste = Math.max(0, kpm - cpm);
    return Math.round(
      cpm +
      eff * 100 -
      waste * 0.3
    );
  }

  collectionName({ scope, difficulty, category, theme, todayTheme }) {
    const d = this.diffKey(difficulty);
    if (scope === "overall") return `rankings__overall__${d}`;
    if (scope === "category") return `rankings__category__${this.toKey(category)}__${d}`;
    if (scope === "theme") return `rankings__theme__${this.toKey(theme)}__${d}`;
    if (scope === "daily") return `rankings__daily__${this.toKey(todayTheme)}__${d}`;
    return `rankings__overall__${d}`;
  }

  async saveToBoards({
    name,
    uid,
    metrics,
    filters,
    itemMeta
  }) {
    const rankingScore = this.calcRankingScore(metrics);

    const payload = {
      name,
      uid,
      rankingScore,
      cpm: metrics.cpm,
      kpm: metrics.kpm,
      rank: metrics.rank,
      eff: Math.round(metrics.eff * 10000) / 10000,
      wpm: metrics.wpm,
      diff: metrics.diff,
      createdAt: serverTimestamp()
    };

    const scopes = ["overall", "category", "theme", "daily"];
    const tasks = scopes.map(scope => {
      const col = this.collectionName({
        scope,
        difficulty: filters.difficulty,
        category: filters.category,
        theme: filters.theme,
        todayTheme: filters.todayTheme
      });
      return addDoc(collection(this.db, col), payload);
    });

    await Promise.allSettled(tasks);
  }

  async loadTop10({ scope, difficulty, category, theme, todayTheme }) {
    const col = this.collectionName({ scope, difficulty, category, theme, todayTheme });

    const q = query(
      collection(this.db, col),
      orderBy("rankingScore", "desc"),
      limit(10)
    );

    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
  }

  renderList(ul, rows) {
    ul.innerHTML = "";
    if (!rows.length) {
      ul.innerHTML = "<li>まだスコアがありません。</li>";
      return;
    }
    for (const r of rows) {
      const li = document.createElement("li");
      li.textContent =
        `${r.name}｜Score ${r.rankingScore}｜CPM ${r.cpm}｜KPM ${r.kpm}｜${r.rank}`;
      ul.appendChild(li);
    }
  }
}
