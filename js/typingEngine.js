// js/typingEngine.js
export class TypingEngine {
  constructor(textEl, inputEl, resultEl) {
    this.textEl = textEl;
    this.inputEl = inputEl;
    this.resultEl = resultEl;
    this.target = "";
    this.startTime = null;
    this.keystrokes = 0;
  }

  setText(text) {
    this.target = text;
    this.textEl.textContent = text;
    this.inputEl.value = "";
    this.resultEl.textContent = "";
    this.startTime = null;
    this.keystrokes = 0;
  }

  start() {
    this.inputEl.disabled = false;
    this.inputEl.focus();
  }

  onKey(e) {
    if (!this.startTime) this.startTime = Date.now();
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === " ") {
      this.keystrokes++;
    }
  }

  checkFinish() {
    return this.inputEl.value === this.target;
  }

  finish() {
    const sec = (Date.now() - this.startTime) / 1000;
    const cpm = Math.round(this.target.length / (sec / 60));
    const kpm = Math.round(this.keystrokes / (sec / 60));
    return { cpm, kpm };
  }
}
