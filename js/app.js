// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { TypingEngine } from "./typingEngine.js";
import { RankingManager } from "./ranking.js";
import { UserManager } from "./userManager.js";

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "otonano-typing-game.firebaseapp.com",
  projectId: "otonano-typing-game"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
await signInAnonymously(auth);

const userMgr = new UserManager(document.getElementById("userSelect"));
const engine = new TypingEngine(
  document.getElementById("text"),
  document.getElementById("input"),
  document.getElementById("result")
);
const ranking = new RankingManager(app);

const trivia = await fetch("./data/trivia.json").then(r => r.json());
engine.setText(trivia[Math.floor(Math.random() * trivia.length)].text);

document.getElementById("startBtn").onclick = () => engine.start();

document.getElementById("input").addEventListener("keydown", e => engine.onKey(e));
document.getElementById("input").addEventListener("input", async () => {
  if (engine.checkFinish()) {
    const { cpm, kpm } = engine.finish();
    const rankingScore = Math.round(cpm + (cpm / kpm) * 100);

    engine.resultEl.textContent = `CPM ${cpm} / KPM ${kpm}`;

    await addDoc(collection(db, "scores"), {
      uid: auth.currentUser.uid,
      userName: userMgr.getCurrent(),
      cpm,
      kpm,
      rankingScore,
      theme: "戦争・革命",
      category: "歴史（世界史・日本史）",
      dateKey: new Date().toISOString().slice(0,10),
      createdAt: serverTimestamp()
    });
  }
});
