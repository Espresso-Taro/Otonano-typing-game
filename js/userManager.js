// js/userManager.js
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class UserManager {
  constructor({ selectEl, addBtn, renameBtn, deleteBtn, db }) {
    if (!db) {
      throw new Error("UserManager: Firestore db is required");
    }

    this.db = db;

    // ===== DOM（外から渡される／無い場合もある）=====
    this.userSelect = selectEl || null;
    this.addBtn = addBtn || null;
    this.renameBtn = renameBtn || null;
    this.deleteBtn = deleteBtn || null;

    // ===== state =====
    this.users = [];
    this.currentUserName = "";

    // ===== init =====
    this._init();
    this._bindEvents();
  }

  /* =========================
     初期化
  ========================= */
  async _init() {
    try {
      this.users = await this.listUsers();

      if (this.users.length > 0) {
        this.currentUserName = this.users[0];
      }

      this.render();
    } catch (e) {
      console.error("UserManager init failed", e);
    }
  }

  /* =========================
     イベントバインド（完全ガード）
  ========================= */
  _bindEvents() {
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

    if (this.deleteBtn) {
      this.deleteBtn.addEventListener("click", async () => {
        if (!this.currentUserName) return;
        if (!confirm(`ユーザー「${this.currentUserName}」を削除しますか？`)) return;

        try {
          await this.deleteUser(this.currentUserName);
        } catch (e) {
          console.error("deleteUser failed", e);
          alert("削除に失敗しました");
        }
      });
    }

    if (this.userSelect) {
      this.userSelect.addEventListener("change", () => {
        this.currentUserName = this.userSelect.value;
      });
    }
  }

  /* =========================
     描画（UIが無い場合は何もしない）
  ========================= */
  render() {
    if (!this.userSelect) return;

    this.userSelect.innerHTML = "";

    this.users.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      this.userSelect.appendChild(opt);
    });

    if (this.currentUserName) {
      this.userSelect.value = this.currentUserName;
    }
  }

  /* =========================
     Public API
  ========================= */
  getCurrentUserName() {
    return this.currentUserName;
  }

  setCurrentUserName(name) {
    this.currentUserName = name;
    if (this.userSelect) {
      this.userSelect.value = name;
    }
  }

  /* =========================
     Firestore 操作
  ========================= */
  async listUsers() {
    const snap = await getDocs(collection(this.db, "userNames"));
    return snap.docs.map(d => d.id);
  }

  async addUser(name) {
    const ref = doc(this.db, "userNames", name);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      throw new Error("このユーザー名は既に使われています");
    }

    await setDoc(ref, { createdAt: serverTimestamp() });

    this.users = await this.listUsers();
    this.currentUserName = name;
    this.render();
  }

  async renameUser(oldName, newName) {
    const oldRef = doc(this.db, "userNames", oldName);
    const newRef = doc(this.db, "userNames", newName);

    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) {
      throw new Error("元のユーザーが存在しません");
    }

    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) {
      throw new Error("新しいユーザー名は既に使われています");
    }

    await setDoc(newRef, { createdAt: serverTimestamp() });
    await deleteDoc(oldRef);

    this.users = await this.listUsers();
    this.currentUserName = newName;
    this.render();
  }

  async deleteUser(name) {
    await deleteDoc(doc(this.db, "userNames", name));

    this.users = await this.listUsers();
    this.currentUserName = this.users[0] || "";
    this.render();
  }

  /* =========================
     履歴（分析用：将来拡張）
  ========================= */
  async getHistories(uid) {
    const snap = await getDocs(
      collection(this.db, "users", uid, "profiles", "default", "histories")
    );
    return snap.docs.map(d => d.data());
  }
}
