// js/typingEngine.js

export class TypingEngine {
  constructor(opts = {}) {
    this.textEl = opts.textEl || null;
    this.inputEl = opts.inputEl || null;
    this.resultEl = opts.resultEl || null;
    this.onFinish = typeof opts.onFinish === "function" ? opts.onFinish : null;

    // state
    this.targetText = "";
    this.meta = {};
    this.startTime = 0;
    this.finished = false;
    this.ready = false;

    // bind
    this._onInput = this._onInput.bind(this);
  }

  /* =========================
     attach events
  ========================= */
  attach() {
    if (!this.inputEl) return;
    this.inputEl.addEventListener("input", this._onInput);
  }

  /* =========================
     set target text
  ========================= */
  setTarget(text = "", meta = {}) {
    this.targetText = String(text);
    this.meta = meta || {};
    this.finished = false;
    this.ready = false;
    this.startTime = 0;

    if (this.textEl) {
      this.textEl.textContent = this.targetText;
    }

    if (this.inputEl) {
      this.inputEl.value = "";
      this.inputEl.disabled = true; // startNow() まで入力不可
    }
  }

  /* =========================
     enable ready state
  ========================= */
  enableReadyState() {
    this.ready = true;
    this.finished = false;
    this.startTime = 0;
  }

  /* =========================
     start typing now
  ========================= */
  startNow() {
    if (!this.ready || !this.inputEl) return;
    this.startTime = performance.now();
    this.finished = false;
    this.inputEl.disabled = false;
    this.inputEl.focus();
  }

  /* =========================
     input handler
  ========================= */
  _onInput() {
    if (!this.ready || this.finished) return;
    if (!this.inputEl) return;

    const value = this.inputEl.value || "";

    // 完全一致で終了
    if (value === this.targetText) {
      this.finished = true;
      this.inputEl.disabled = true;

      const metrics = this._computeMetrics();

      if (this.onFinish) {
        this.onFinish({
          metrics,
          meta: this.meta
        });
      }
    }
  }

  /* =========================
     metrics
  ========================= */
  _computeMetrics() {
    const end = performance.now();
    const timeMs = Math.max(1, end - this.startTime);
    const timeSec = timeMs / 1000;

    const chars = this.targetText.length;
    const cpm = Math.round((chars / timeSec) * 60);

    return {
      chars,
      timeSec,
      cpm,
      rank: this._rankByCPM(cpm)
    };
  }

  _rankByCPM(cpm) {
    if (cpm >= 800) return "SSS";
    if (cpm >= 700) return "SS";
    if (cpm >= 600) return "S";
    if (cpm >= 500) return "A";
    if (cpm >= 400) return "B";
    if (cpm >= 300) return "C";
    return "D";
  }

  /* =========================
     countdown helper
  ========================= */
  async showCountdownInTextarea(sec = 3) {
    if (!this.inputEl) return;

    this.inputEl.disabled = true;
    this.inputEl.value = "";

    for (let i = sec; i > 0; i--) {
      this.inputEl.value = String(i);
      await this._sleep(1000);
    }

    this.inputEl.value = "";
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
