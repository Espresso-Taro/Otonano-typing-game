// js/ranking.js
import { collection, addDoc, query, getDocs, orderBy, limit } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class Ranking {
  constructor(db) {
    this.db = db;
  }

  score(cpm, kpm) {
    const eff = cpm / kpm;
    return Math.round(cpm + eff * 100 - (kpm - cpm) * 0.3);
  }

  async saveDaily({ uid, name, theme, dailyTheme, cpm, kpm, rank }) {
    if (theme !== dailyTheme) return; // ★完全遮断

    await addDoc(
      collection(this.db, `daily_${dailyTheme}`),
      {
        uid, name, theme,
        cpm, kpm, rank,
        rankingScore: this.score(cpm, kpm),
        createdAt: Date.now()
      }
    );
  }

  async loadDaily(theme) {
    const q = query(
      collection(this.db, `daily_${theme}`),
      orderBy("rankingScore", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }
}
