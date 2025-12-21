---

```md
<!-- README.en.md -->

# Kanji Conversion Typing Game (IME-aware)
### Japanese typing practice for office work

Live: https://espresso-taro.github.io/Otonano-typing-game/

> 日本語版: [README.md](./README.md)

---

## Screenshot

> Place an image at `docs/screenshot.png` in your repository.

![App screenshot](docs/screenshot.png)

---

## What is this?

This is a **Japanese typing practice game that includes IME (Kanji conversion) operations**.  
Many typing trainers focus on raw keystroke speed, but real office work requires:

- reading and composing sentences
- converting Kana to Kanji with IME
- selecting candidates and confirming conversion
- fixing mis-conversions quickly

This project is designed to practice that full workflow.

No account required. Free to use. Works on both desktop and mobile.

---

## Key Features

- **IME-aware scoring** (Kanji conversion included)
- **Adult / office-oriented Japanese texts**
- **CPM (Characters Per Minute)** as the primary metric
- **Progress chart** to visualize improvement
- **Rankings and group battles** (friends / colleagues / classes)
- **Mobile support** (flick input and external keyboards)

---

## Why IME-aware?

In real Japanese writing, the bottleneck is often not typing speed but:

- conversion timing
- candidate selection
- fixing wrong conversions
- maintaining accuracy while composing sentences

This app focuses on those office-relevant skills, not only raw key speed.

---

## Run locally (example)

It’s a static site—serve the folder and open it in a browser.

```bash
python -m http.server 8000