// js/ranking.js
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * RankingManager
 * - scores コレクションから直接集計
 * - rankingScore 降順
 * - Firestore ルールと完全整合
 */
export class RankingManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * 共通：ランキング取得
   */
  async fetchRanking({
    limitCount = 10,
    difficulty = null,
    category = null,
    theme = null,
    dateKey = null
  } = {}) {
    try {
      let q = collection(this.db, "scores");
      const conditions = [];

      if (difficulty && difficulty !== "すべて") {
        conditions.push(where("difficulty", "==", difficulty));
      }
      if (category && category !== "すべて") {
        conditions.push(where("category", "==", category));
      }
      if (theme && theme !== "すべて") {
        conditions.push(where("theme", "==", theme));
      }
      if (dateKey) {
        conditions.push(where("dateKey", "==", dateKey));
      }

      q = query(
        q,
        ...conditions,
        orderBy("rankingScore", "desc"),
        limit(limitCount)
      );

      const snap = await getDocs(q);

      const results = [];
      snap.forEach(doc => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return results;
    } catch (e) {
      console.error("ランキング取得失敗", e);
      throw e;
    }
  }

  /**
   * 全体ランキング
   */
  async loadOverallRanking({ difficulty = null } = {}) {
    return this.fetchRanking({
      difficulty
    });
  }

  /**
   * カテゴリ別ランキング
   */
  async loadCategoryRanking({
    category,
    difficulty = null
  }) {
    return this.fetchRanking({
      category,
      difficulty
    });
  }

  /**
   * テーマ別ランキング
   */
  async loadThemeRanking({
    theme,
    difficulty = null
  }) {
    return this.fetchRanking({
      theme,
      difficulty
    });
  }

  /**
   * 今日のテーマランキング（※完全一致のみ）
   */
  async loadTodayThemeRanking({
    theme,
    difficulty = null,
    dateKey
  }) {
    if (!theme || !dateKey) return [];

    return this.fetchRanking({
      theme,
      difficulty,
      dateKey
    });
  }

  /**
   * ランキング表示用フォーマット
   */
  static formatRanking(list) {
    return list.map((r, idx) => {
      return {
        rankNo: idx + 1,
        userName: r.userName,
        cpm: r.cpm,
        kpm: r.kpm,
        rank: r.rank,
        score: r.rankingScore
      };
    });
  }
}
