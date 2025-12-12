// js/typingEngine.js
export class TypingEngine {
  constructor({
    textEl,
    inputEl,
    onStart = () => {},
    onUpdate = () => {},
    onComplete = () => {},
    getTargetText = () => "",
  }) {
    this.textEl = textEl;
    this.inputEl = inputEl;

    this.onStart = onStart;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.getTargetText = getTargetText;

    this.target = "";
    this.started = false;
    this.finished = false;

    this.isComposing = false;      // IME変換中フラグ
    this.compositionDirty = false; // 変換中に入力が動いたか（確定時の再評価用）

    this.startTime = 0;
    this.keystrokes = 0;           // KPM（IME寄り：Space/Enterも含む）
  }

  setText(text) {
    this.target = text || "";
    this.textEl.textContent = this.target;

    this.started = false;
    this.finished = false;
    this.isComposing = false;
    this.compositionDirty = false;

    this.startTime = 0;
    this.keystrokes = 0;

    this.inputEl.value = "";
    this.inputEl.disabled = true;
  }

  async startCountdown() {
    if (!this.target) return;

    // 入力欄内にカウント表示
    this.inputEl.disabled = false;
    this.inputEl.readOnly = true;

    this.inputEl.value = "";
    this.inputEl.style.textAlign = "center";
    this.inputEl.style.fontSize = "2rem";

    for (const s of ["3", "2", "1", "START"]) {
      this.inputEl.value = s;
      await new Promise(r => setTimeout(r, 700));
    }

    this.inputEl.value = "";
    this.inputEl.readOnly = false;
    this.inputEl.style.textAlign = "";
    this.inputEl.style.fontSize = "";
    this.inputEl.focus();

    this.started = true;
    this.finished = false;
    this.startTime = 0;
    this.keystrokes = 0;

    this.onStart();
  }

  bind() {
    // IME
    this.inputEl.addEventListener("compositionstart", () => {
      this.isComposing = true;
      this.compositionDirty = false;
    });

    this.inputEl.addEventListener("compositionend", () => {
      this.isComposing = false;

      // 変換確定後にのみ描画・終了判定
      this.renderJudged();
      this.checkFinish();
    });

    // KPM（打鍵）：IME変換負荷も含める
    this.inputEl.addEventListener("keydown", (e) => {
      if (!this.started || this.finished) return;

      const k = e.key;
      const isPrintable = (k.length === 1);
      const isEdit = (k === "Backspace" || k === "Delete");
      const isImeOps = (k === " " || k === "Enter"); // 変換/確定

      if (isPrintable || isEdit || isImeOps) this.keystrokes++;
    });

    // 入力
    this.inputEl.addEventListener("input", () => {
      if (!this.started || this.finished) return;

      const typed = this.inputEl.value;

      // 開始タイミング：最初の1文字確定入力で開始
      // ※ 変換中は startTime を立てない（確定後に実入力が確定するため）
      if (!this.isComposing && typed.length === 1 && this.startTime === 0) {
        this.startTime = Date.now();
        this.keystrokes = 0; // 開始前キーを除外
      }

      if (this.isComposing) {
        // ★変換中は青/赤を更新しない（保持する）
        this.compositionDirty = true;
        return;
      }

      this.renderJudged();
      this.onUpdate({ typed });

      this.checkFinish();
    });
  }

  renderJudged() {
    const t = this.target;
    const typed = this.inputEl.value;

    let html = "";
    for (let i = 0; i < t.length; i++) {
      if (i < typed.length) {
        html += (typed[i] === t[i])
          ? `<span class="ok">${escapeHtml(t[i])}</span>`
          : `<span class="ng">${escapeHtml(t[i])}</span>`;
      } else {
        html += escapeHtml(t[i]);
      }
    }
    this.textEl.innerHTML = html;
  }

  checkFinish() {
    if (this.finished) return;
    if (!this.started) return;

    // ★IME変換中は絶対に終了判定しない
    if (this.isComposing) return;

    const typed = this.inputEl.value;
    const t = this.target;

    // ★「全文一致」したら即終了（余計なSpace/BS不要）
    if (typed.length === t.length && typed === t) {
      this.finish();
    }
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.started = false;

    // startTime が立っていない（超短文等）場合の保険
    const start = this.startTime || Date.now();
    const seconds = Math.max(0.001, (Date.now() - start) / 1000);
    const minutes = seconds / 60;

    const targetText = this.getTargetText() || this.target;

    const cpm = Math.round(targetText.length / minutes);
    const kpm = Math.round(this.keystrokes / minutes);
    const eff = (kpm > 0) ? (cpm / kpm) : 0;

    let rank = "D";
    if (cpm >= 420 && eff >= 0.92) rank = "SSS";
    else if (cpm >= 360 && eff >= 0.88) rank = "SS";
    else if (cpm >= 320 && eff >= 0.84) rank = "S";
    else if (cpm >= 260 && eff >= 0.78) rank = "A";
    else if (cpm >= 200 && eff >= 0.72) rank = "B";
    else if (cpm >= 150) rank = "C";

    // ★alertは「一瞬で消える」ことはない（ユーザー操作で閉じる）
    alert(
      `完了！\n\n` +
      `ランク: ${rank}\n` +
      `CPM: ${cpm}\n` +
      `KPM: ${kpm}\n` +
      `効率: ${(eff * 100).toFixed(1)}%`
    );

    this.onComplete({ cpm, kpm, eff, rank, seconds });
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
