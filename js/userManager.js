// js/userManager.js
const USERS_KEY = "typing_users_v2";
const LAST_KEY  = "typing_last_user_v2";

export class UserManager {
  constructor(selectEl) {
    this.selectEl = selectEl;

    const raw = localStorage.getItem(USERS_KEY);
    this.users = [];
    try {
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) this.users = parsed;
    } catch {}

    this.current = localStorage.getItem(LAST_KEY) || this.users[0] || "ユーザー1";
    if (!this.users.includes(this.current)) this.users.unshift(this.current);

    this.users = this.users.slice(0, 10);
    this._save();
    this._render();
  }

  add(name) {
    const n = (name || "").trim();
    if (!n) return;

    this.users = this.users.filter(x => x !== n);
    this.users.unshift(n);
    this.users = this.users.slice(0, 10);
    this.current = n;

    this._save();
    this._render();
  }

  select(name) {
    const n = (name || "").trim();
    if (!n) return;
    this.current = n;
    this._save();
    this._render();
  }

  _save() {
    localStorage.setItem(USERS_KEY, JSON.stringify(this.users));
    localStorage.setItem(LAST_KEY, this.current);
  }

  _render() {
    this.selectEl.innerHTML = "";
    for (const u of this.users) {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      opt.selected = (u === this.current);
      this.selectEl.appendChild(opt);
    }
  }
}
