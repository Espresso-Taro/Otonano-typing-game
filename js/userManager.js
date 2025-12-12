// js/userManager.js
// 端末内ユーザー（最大10名）管理：localStorage
// - 直前ユーザーを自動選択
// - 追加/改名/削除
// - 選択変更イベント通知

export class UserManager {
  constructor({
    maxUsers = 10,
    storagePrefix = "otonano_typing"
  } = {}) {
    this.maxUsers = maxUsers;
    this.keyUsers = `${storagePrefix}__users`;
    this.keyLast = `${storagePrefix}__last_user`;

    this.users = this._loadUsers();
    this.current = this._loadLast() ?? (this.users[0] ?? null);

    // current が users にない場合は先頭へ
    if (this.current && !this.users.includes(this.current)) {
      this.users.unshift(this.current);
      this.users = this.users.slice(0, this.maxUsers);
      this._saveUsers();
    }
    if (this.current) this._saveLast(this.current);

    this._listeners = new Set();
  }

  // -----------------
  // storage
  // -----------------
  _loadUsers() {
    try {
      const s = localStorage.getItem(this.keyUsers);
      if (!s) return [];
      const arr = JSON.parse(s);
      if (!Array.isArray(arr)) return [];
      return arr
        .map(x => String(x ?? "").trim())
        .filter(x => x.length > 0);
    } catch {
      return [];
    }
  }

  _saveUsers() {
    try {
      localStorage.setItem(this.keyUsers, JSON.stringify(this.users.slice(0, this.maxUsers)));
    } catch {
      // noop
    }
  }

  _loadLast() {
    try {
      const s = localStorage.getItem(this.keyLast);
      const v = (s ?? "").trim();
      return v.length ? v : null;
    } catch {
      return null;
    }
  }

  _saveLast(name) {
    try {
      localStorage.setItem(this.keyLast, String(name));
    } catch {
      // noop
    }
  }

  // -----------------
  // events
  // -----------------
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn({ users: [...this.users], current: this.current });
      } catch {
        // noop
      }
    }
  }

  // -----------------
  // public
  // -----------------
  list() {
    return [...this.users];
  }

  getCurrent() {
    return this.current;
  }

  setCurrent(name) {
    const n = String(name ?? "").trim();
    if (!n) return { ok: false, reason: "empty" };
    if (!this.users.includes(n)) return { ok: false, reason: "not_found" };

    this.current = n;
    this._saveLast(n);
    this._emit();
    return { ok: true };
  }

  add(name) {
    const n = String(name ?? "").trim();
    if (!n) return { ok: false, reason: "empty" };

    // 重複は先頭に持ってくる
    this.users = this.users.filter(x => x !== n);
    this.users.unshift(n);
    this.users = this.users.slice(0, this.maxUsers);
    this._saveUsers();

    this.current = n;
    this._saveLast(n);
    this._emit();
    return { ok: true };
  }

  rename(oldName, newName) {
    const o = String(oldName ?? "").trim();
    const n = String(newName ?? "").trim();
    if (!o || !n) return { ok: false, reason: "empty" };
    if (!this.users.includes(o)) return { ok: false, reason: "not_found" };

    // n が存在していたら統合（重複排除）
    this.users = this.users.map(x => (x === o ? n : x));
    this.users = [...new Set(this.users)];
    // 先頭優先（最後に選んだユーザーが先頭になりやすい）
    this.users = this.users.filter(x => x !== n);
    this.users.unshift(n);
    this.users = this.users.slice(0, this.maxUsers);

    this._saveUsers();

    if (this.current === o) {
      this.current = n;
      this._saveLast(n);
    }
    this._emit();
    return { ok: true };
  }

  remove(name) {
    const n = String(name ?? "").trim();
    if (!n) return { ok: false, reason: "empty" };
    if (!this.users.includes(n)) return { ok: false, reason: "not_found" };

    this.users = this.users.filter(x => x !== n);
    this._saveUsers();

    if (this.current === n) {
      this.current = this.users[0] ?? null;
      if (this.current) this._saveLast(this.current);
      else localStorage.removeItem(this.keyLast);
    }
    this._emit();
    return { ok: true };
  }
}
