// js/userManager.js
export class UserManager {
  constructor(select) {
    this.select = select;
    this.key = "typing_users";
    this.last = "typing_last";

    this.users = JSON.parse(localStorage.getItem(this.key) || "[]");
    this.current = localStorage.getItem(this.last) || this.users[0];

    if (!this.current) this.current = "ユーザー1";
    if (!this.users.includes(this.current)) this.users.unshift(this.current);

    this.users = this.users.slice(0, 10);
    this.save();
    this.render();
  }

  render() {
    this.select.innerHTML = "";
    this.users.forEach(u => {
      const o = document.createElement("option");
      o.value = u;
      o.textContent = u;
      o.selected = u === this.current;
      this.select.appendChild(o);
    });
  }

  add(name) {
    if (!name) return;
    this.users = this.users.filter(u => u !== name);
    this.users.unshift(name);
    this.users = this.users.slice(0, 10);
    this.current = name;
    this.save();
    this.render();
  }

  save() {
    localStorage.setItem(this.key, JSON.stringify(this.users));
    localStorage.setItem(this.last, this.current);
  }
}
