// js/typingEngine.js
// IME（日本語変換）中は判定しない / 確定文字だけで青赤表示 / CPM=文章長÷時間
export class TypingEngine {
  constructor(opts = {}) {
    this.textEl = opts.textEl || null;
    this.inputEl = opts.inputEl || null;
    this.resultEl = opts.resultEl || null;
    this.onFinish = typeof opts.onFinish === "function" ? opts.onFinish : null;

    this.target = "";
    this.targetMeta = null;

    this.started = false;
    this.ended = false;
    this.startTimeMs = 0;

    this.isComposing = false;
    this.lastCommittedValue = "";
    this.keystrokes = 0; // 参考値

    this.guideChar = "";

    // textarea の元paddingを復元するために保持
    this._basePaddingTop = null;
    this._basePaddingBottom = null;
  }

  _ensureBasePadding() {
    if (!this.inputEl) return;
    if (this._basePaddingTop != null && this._basePaddingBottom != null) return;

    const cs = getComputedStyle(this.inputEl);
    this._basePaddingTop = cs.paddingTop;
    this._basePaddingBottom = cs.paddingBottom;
  }

  _restoreBasePadding() {
    if (!this.inputEl) return;
    this._ensureBasePadding();
    if (this._basePaddingTop != null) this.inputEl.style.paddingTop = this._basePaddingTop;
    if (this._basePaddingBottom != null) this.inputEl.style.paddingBottom = this._basePaddingBottom;
  }

  setTarget(text, meta = null) {
    this.target = (text ?? "").toString();
    this.targetMeta = meta;

    this.started = false;
    this.ended = false;
    this.startTimeMs = 0;

    this.isComposing = false;
    this.lastCommittedValue = "";
    this.keystrokes = 0;

    this.guideChar = this.target.charAt(0) || "";

    if (this.inputEl) {
      this._ensureBasePadding();
      this.inputEl.classList.remove("countdown");
      this.inputEl.classList.remove("input-guide");
      this._restoreBasePadding();

      this.inputEl.value = "";
      this.inputEl.disabled = true;
    }

    if (this.resultEl) this.resultEl.textContent = "";

    this._renderByCommitted("");
    this._showGuideCharInTextarea();
  }

  enableReadyState() {
    // app.js側で start まで disabled 管理する前提（ここでは ready 表示だけ整える）
    if (!this.inputEl) return;
    this.started = false;
    this.ended = false;
    this.startTimeMs = 0;
    this.isComposing = false;
    this.lastCommittedValue = "";
    this.keystrokes = 0;

    this.inputEl.disabled = true;
    this._showGuideCharInTextarea();
  }

  async showCountdownInTextarea(sec = 3) {
    if (!this.inputEl) return;

    const el = this.inputEl;
    this._ensureBasePadding();

    el.disabled = true;
    el.classList.remove("input-guide");
    el.classList.add("countdown");

    for (let i = Number(sec) || 3; i > 0; i--) {
      el.value = String(i);
      this._applyVerticalCenterPadding();
      await this._sleep(1000);
    }

    el.value = "";
    el.classList.remove("countdown");
    this._restoreBasePadding();
  }

  startNow() {
    if (!this.inputEl) return;

    this.started = true;
    this.ended = false;
    this.startTimeMs = Date.now();
    this.keystrokes = 0;

    this.isComposing = false;
    this.lastCommittedValue = "";

    this.inputEl.classList.remove("countdown");
    this.inputEl.classList.remove("input-guide");
    this._restoreBasePadding();

    this.inputEl.value = "";
    this.inputEl.disabled = false;
    this.inputEl.focus();
  }

  attach() {
    if (!this.inputEl) return;

    // keydown: 打鍵カウント（参考）
    this.inputEl.addEventListener("keydown", (e) => {
      if (!this.started || this.ended) return;

      const k = e.key;
      const isPrintable = (k.length === 1);
      const isEdit = (k === "Backspace" || k === "Delete");
      const isImeOps = (k === " " || k === "Enter");
      if (isPrintable || isEdit || isImeOps) this.keystrokes++;
    });

    // composition: 変換中は判定しない・色を変えない
    this.inputEl.addEventListener("compositionstart", () => {
      this.isComposing = true;
      this.lastCommittedValue = this._getCommittedValueSafe();
      this._renderByCommitted(this.lastCommittedValue);
    });

    this.inputEl.addEventListener("compositionend", () => {
      this.isComposing = false;
      this.lastCommittedValue = this._getCommittedValueSafe();
      this._renderByCommitted(this.lastCommittedValue);
      this._tryFinishIfMatched();
    });

    // input: composing中は「色を変えない」
    this.inputEl.addEventListener("input", () => {
      if (!this.started || this.ended) return;

      if (this.isComposing) {
        this._renderByCommitted(this.lastCommittedValue);
        return;
      }

      this.lastCommittedValue = this._getCommittedValueSafe();
      this._renderByCommitted(this.lastCommittedValue);
      this._tryFinishIfMatched();
    });
  }

  _getCommittedValueSafe() {
    return this.inputEl?.value ?? "";
  }

  _tryFinishIfMatched() {
    if (this.ended) return;
    const committed = this.lastCommittedValue;

    if (committed === this.target) {
      this.ended = true;

      const endMs = Date.now();
      const timeSec = Math.max(0.001, (endMs - this.startTimeMs) / 1000);

      const metrics = this.computeMetrics({
        committed,
        timeSec,
        keystrokes: this.keystrokes
      });

      if (this.resultEl) {
        this.resultEl.innerHTML = `完了！ スコア(CPM): ${metrics.cpm}　ランク: ${metrics.rank}`;
      }

      this.onFinish?.({ metrics, meta: this.targetMeta });

      if (this.inputEl) this.inputEl.disabled = true;
    }
  }

  // CPM（=スコア）は「文章長 ÷ 完了時間」
  computeMetrics({ committed, timeSec, keystrokes }) {
    const minutes = timeSec / 60;
    const targetLen = (this.target ?? "").length;

    const cpm = Math.round((targetLen / minutes));
    const kpm = Math.round(((Number(keystrokes) || 0) / minutes));

    const rank = this.calcRank(cpm);

    return {
      cpm,
      rank,
      timeSec: Math.round(timeSec * 1000) / 1000,
      length: targetLen,
      kpm,
      // 互換用
      seconds: Math.round(timeSec * 1000) / 1000
    };
  }

  calcRank(cpm) {
    if (cpm >= 520) return "SSS";
    if (cpm >= 440) return "SS";
    if (cpm >= 380) return "S";
    if (cpm >= 300) return "A";
    if (cpm >= 220) return "B";
    if (cpm >= 150) return "C";
    return "D";
  }

  _renderByCommitted(committed) {
    if (!this.textEl) return;

    const t = this.target ?? "";
    const v = committed ?? "";

    let mismatch = -1;
    const minLen = Math.min(v.length, t.length);
    for (let i = 0; i < minLen; i++) {
      if (v[i] !== t[i]) { mismatch = i; break; }
    }
    if (mismatch === -1 && v.length > t.length) mismatch = t.length;

    const esc = (s) => String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

    let html = "";
    if (mismatch === -1) {
      const okPart = t.slice(0, v.length);
      const rest = t.slice(v.length);
      html = `<span class="ok">${esc(okPart)}</span>${esc(rest)}`;
    } else {
      const okPart = t.slice(0, mismatch);
      const ngPart = t.slice(mismatch, Math.min(v.length, t.length));
      const rest = t.slice(Math.min(v.length, t.length));
      html = `<span class="ok">${esc(okPart)}</span><span class="ng">${esc(ngPart)}</span>${esc(rest)}`;
    }

    this.textEl.innerHTML = html;
  }

  _showGuideCharInTextarea() {
    if (!this.inputEl) return;
    if (!this.guideChar) return;

    const el = this.inputEl;
    this._ensureBasePadding();

    el.disabled = true;
    el.classList.remove("countdown");
    el.classList.add("input-guide");

    el.value = this.guideChar;

    this._applyVerticalCenterPadding();
  }

  _applyVerticalCenterPadding() {
    if (!this.inputEl) return;

    const el = this.inputEl;

    // textareaの高さから padding-top を計算して縦中央寄せ（%は使わない）
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 0;
    const h = el.clientHeight;
    const padTop = Math.max(0, Math.floor((h - fontSize) / 2));

    el.style.paddingTop = `${padTop}px`;
    el.style.paddingBottom = "0px";
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
