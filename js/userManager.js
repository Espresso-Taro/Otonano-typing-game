// js/userManager.js
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * 目的：
 * - 同一端末で userName を切り替え可能
 * - 端末(=auth.uid)ごとに「最後に使った userName」を localStorage に保持
 * - その端末で userName が未選択/存在しない場合は、必ず新規 guest-****** を作って選択
 * - userName削除/改名時は localStorage の関連キーも掃除（currentGroupId_v1:* を消す）
 */
export class UserManager {
  constructor({ selectEl, addBtn, renameBtn, deleteBtn, db }) {
    if (!db) throw new Error("UserManager: Firestore db is required");

    this.db = db;

    this.userSelect = selectEl || null;
    this.addBtn = addBtn || null;
    this.renameBtn = renameBtn || null;
    this.deleteBtn = deleteBtn || null;

    this.users = [];
    this.currentUserName = "";
    this._authUid = ""; // 端末ごと(匿名認証 uid)
    this._listeners = new Set();

    this._bindEvents();
  }

  /* =========================
     init（auth.uid が確定してから呼ぶ）
  ========================= */
  async init(authUid) {
    this._authUid = (authUid || "").toString();
    if (!this._authUid) throw new Error("UserManager.init: authUid is required");

    // 一覧取得
    this.users = await this.listUsers();

    // 端末の最後の userName を復元
    const last = this._getLastUserName();

    // last が有効なら採用、なければ「必ずこの端末の guest を新規作成」
    if (last && this.users.includes(last)) {
      this.currentUserName = last;
    } else {
      // 重要：他端末の userNames が既にあっても「最初の1件を拾わない」
      const guest = await this._createUniqueGuestUser();
      this.currentUserName = guest;

      // users 再取得（create後）
      this.users = await this.listUsers();
    }

    this._setLastUserName(this.currentUserName);
    this.render();
    this._emitChanged();

    return this.currentUserName;
  }

  /* =========================
     イベント
  ========================= */
  onUserChanged(fn) {
    if (typeof fn !== "function") return () => {};
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emitChanged() {
    for (const fn of this._listeners) {
      try {
        fn(this.currentUserName);
      } catch (e) {
        console.error("onUserChanged handler error:", e);
      }
    }
  }

  _bindEvents() {
    // select change
    if (this.userSelect) {
      this.userSelect.addEventListener("change", () => {
        const v = (this.userSelect.value || "").toString();
        if (!v) return;

        this.currentUserName = v;
        this._setLastUserName(v);
        this._emitChanged();
      });
    }

    // add
    if (this.addBtn) {
      this.addBtn.addEventListener("click", async () => {
        const name = prompt("ユーザー名を入力してください（全体で一意）");
        if (!name) return;

        try {
          await this.addUser(name);
        } catch (e) {
          console.error("addUser failed", e);
          alert(e.message || "ユーザー作成に失敗しました");
        }
      });
    }

    // rename
    if (this.renameBtn) {
      this.renameBtn.addEventListener("click", async () => {
        if (!this.currentUserName) return;

        const newName = prompt("新しいユーザー名", this.currentUserName);
        if (!newName || newName === this.currentUserName) return;

        try {
          await this.renameUser(this.currentUserName, newName);
        } catch (e) {
          console.error("renameUser failed", e);
          alert(e.message || "改名に失敗しました");
        }
      });
    }

    // delete
    if (this.deleteBtn) {
      this.deleteBtn.addEventListener("click", async () => {
        if (!this.currentUserName) return;
        if (!confirm(`ユーザー「${this.currentUserName}」を削除しますか？`)) return;

        try {
          await this.deleteUser(this.currentUserName);
        } catch (e) {
          console.error("deleteUser failed", e);
          alert(e.message || "削除に失敗しました");
        }
      });
    }
  }

  /* =========================
     UI
  ========================= */
  render() {
    if (!this.userSelect) return;

    this.userSelect.innerHTML = "";
    for (const name of this.users) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      this.userSelect.appendChild(opt);
    }

    if (this.currentUserName) {
      this.userSelect.value = this.currentUserName;
    }
  }

  getCurrentUserName() {
    return this.currentUserName;
  }

  /* =========================
     Firestore
  ========================= */
  async listUsers() {
    const snap = await getDocs(collection(this.db, "userNames"));
    return snap.docs.map(d => d.id).sort();
  }

  async addUser(nameRaw) {
    const name = (nameRaw || "").toString().trim();
    if (!name) throw new Error("ユーザー名が空です");

    const ref = doc(this.db, "userNames", name);
    const snap = await getDoc(ref);
    if (snap.exists()) throw new Error("このユーザー名は既に使われています");

    await setDoc(ref, { createdAt: serverTimestamp() });

    this.users = await this.listUsers();
    this.currentUserName = name;
    this._setLastUserName(name);
    this.render();
    this._emitChanged();
  }

  async renameUser(oldNameRaw, newNameRaw) {
    const oldName = (oldNameRaw || "").toString().trim();
    const newName = (newNameRaw || "").toString().trim();
    if (!oldName || !newName) throw new Error("ユーザー名が不正です");

    const oldRef = doc(this.db, "userNames", oldName);
    const newRef = doc(this.db, "userNames", newName);

    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) throw new Error("元のユーザーが存在しません");

    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) throw new Error("新しいユーザー名は既に使われています");

    await setDoc(newRef, { createdAt: serverTimestamp() });
    await deleteDoc(oldRef);

    // localStorage 掃除（グループ選択など userName 紐付けキー）
    this._cleanupLocalStorageForUser(oldName);
    // 改名後のキーは app.js 側が新Nameで保存し直す想定なので、ここでは作らない

    this.users = await this.listUsers();
    this.currentUserName = newName;
    this._setLastUserName(newName);
    this.render();
    this._emitChanged();
  }

  async deleteUser(nameRaw) {
    const name = (nameRaw || "").toString().trim();
    if (!name) return;

    await deleteDoc(doc(this.db, "userNames", name));

    // localStorage 掃除（グループ選択など userName 紐付けキー）
    this._cleanupLocalStorageForUser(name);

    this.users = await this.listUsers();

    // この端末で「ユーザーが0人 or lastが消えた」なら必ず新規guestを作る
    if (this.users.length === 0) {
      const guest = await this._createUniqueGuestUser();
      this.users = await this.listUsers();
      this.currentUserName = guest;
    } else {
      // current を消した場合：last が残ってないので、先頭ではなく last を試し、無ければ先頭
      const last = this._getLastUserName();
      this.currentUserName = (last && this.users.includes(last)) ? last : this.users[0];
    }

    this._setLastUserName(this.currentUserName);
    this.render();
    this._emitChanged();
  }

  /* =========================
     guest を全端末で被らせない（Firestore で一意確定）
  ========================= */
  async _createUniqueGuestUser() {
    // 重要：端末が違っても同じ guest が作られないよう、transaction で「未使用」を確定させる
    const maxTry = 30;

    for (let i = 0; i < maxTry; i++) {
      const suffix = this._randBase36(10); // 十分長く
      const name = `guest-${suffix}`;
      const ref = doc(this.db, "userNames", name);

      const created = await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) return null;
        tx.set(ref, { createdAt: serverTimestamp() });
        return name;
      });

      if (created) return created;
    }

    throw new Error("guestユーザー名の生成に失敗しました（リトライ上限）");
  }

  _randBase36(n) {
    // crypto があれば優先
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(n);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map(b => (b % 36).toString(36))
        .join("");
    }
    // fallback
    let s = "";
    while (s.length < n) s += Math.random().toString(36).slice(2);
    return s.slice(0, n);
  }

  /* =========================
     localStorage（端末ごとに last userName を保持）
  ========================= */
  _lastKey() {
    return `lastUserName_v1:${this._authUid || "unknown"}`;
  }

  _getLastUserName() {
    try {
      return (localStorage.getItem(this._lastKey()) || "").toString();
    } catch {
      return "";
    }
  }

  _setLastUserName(name) {
    try {
      if (!name) localStorage.removeItem(this._lastKey());
      else localStorage.setItem(this._lastKey(), name);
    } catch {
      // ignore
    }
  }

  _cleanupLocalStorageForUser(userName) {
    // app.js が使っている userName紐付けキーの掃除
    // - currentGroupId_v1:${userName}
    try {
      localStorage.removeItem(`currentGroupId_v1:${userName}`);
    } catch {
      // ignore
    }
  }
}
