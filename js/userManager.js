import {
  getAuth,
  onAuthStateChanged
} from "firebase/auth";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

class UserManager {
  constructor() {
    this.auth = getAuth();
    this.db = getFirestore();

    this.authUser = null;
    this.currentUserName = null;

    this.onChangeCallbacks = [];
  }

  /* =========================
     初期化
  ========================= */

  init() {
    onAuthStateChanged(this.auth, async (user) => {
      this.authUser = user || null;

      if (!user) {
        this.currentUserName = null;
        this._notify();
        return;
      }

      // uid に紐づく userName を読み込む
      const names = await this.loadMyUserNames();

      if (names.length === 0) {
        // ★ userName が1つも無い場合は自動生成
        const autoName = this._generateGuestName();
        await this.createUserName(autoName);
        this.currentUserName = autoName;
      } else {
        // localStorage に保存されている userName を優先
        const saved = localStorage.getItem(this._storageKey());
        this.currentUserName = names.includes(saved)
          ? saved
          : names[0];
      }

      this._saveCurrent();
      this._notify();
    });
  }

  /* =========================
     public API
  ========================= */

  getAuthUser() {
    return this.authUser;
  }

  getCurrentUserName() {
    return this.currentUserName;
  }

  onChange(cb) {
    this.onChangeCallbacks.push(cb);
  }

  async loadMyUserNames() {
    if (!this.authUser) return [];

    const q = query(
      collection(this.db, "userUserNames"),
      where("uid", "==", this.authUser.uid)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().userName);
  }

  async createUserName(userName) {
    if (!this.authUser) {
      throw new Error("not signed in");
    }

    const uid = this.authUser.uid;

    // ① 全体一意（userNames）
    const nameRef = doc(this.db, "userNames", userName);
    const exists = await getDoc(nameRef);
    if (exists.exists()) {
      throw new Error("userName already exists");
    }

    await setDoc(nameRef, {
      createdByUid: uid,
      createdAt: serverTimestamp()
    });

    // ② uid 所有（userUserNames）
    await setDoc(
      doc(this.db, "userUserNames", `${uid}_${userName}`),
      {
        uid,
        userName,
        createdAt: serverTimestamp()
      }
    );

    this.currentUserName = userName;
    this._saveCurrent();
    this._notify();
  }

  async deleteUserName(userName) {
    if (!this.authUser) return;
    if (this.currentUserName === userName) {
      throw new Error("cannot delete current user");
    }

    const uid = this.authUser.uid;

    await deleteDoc(doc(this.db, "userNames", userName));
    await deleteDoc(doc(this.db, "userUserNames", `${uid}_${userName}`));

    this._notify();
  }

  async switchUserName(userName) {
    const names = await this.loadMyUserNames();
    if (!names.includes(userName)) {
      throw new Error("userName not owned by this uid");
    }

    this.currentUserName = userName;
    this._saveCurrent();
    this._notify();
  }

  /* =========================
     private
  ========================= */

  _storageKey() {
    return `currentUserName:${this.authUser?.uid ?? ""}`;
  }

  _saveCurrent() {
    if (!this.authUser || !this.currentUserName) return;
    localStorage.setItem(this._storageKey(), this.currentUserName);
  }

  _notify() {
    for (const cb of this.onChangeCallbacks) {
      cb(this.currentUserName);
    }
  }

  _generateGuestName() {
    // 絶対衝突しない（uid + 時刻）
    const uidPart = this.authUser.uid.slice(-6);
    const timePart = Date.now().toString(36);
    return `guest-${uidPart}-${timePart}`;
  }
}

export const userMgr = new UserManager();
