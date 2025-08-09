
function playSfx(key) {
  const a = SFX[key];
  if (!a) return;
  try { a.currentTime = 0; } catch {}
  a.loop = false; // make sure it's one-shot
  a.play?.().catch(()=>{});
}
const ICONS = {
  check: "https://i.imgur.com/tkWJE9b.png",       // green check
  redo: "https://i.imgur.com/At7BaBd.png",        // redo / restart
  heartEmpty: "https://i.imgur.com/bhgILNf.png",  // empty heart
  heartFull: "https://i.imgur.com/55ivOQd.png",   // full heart
  x: "https://i.imgur.com/v0qWql5.png",           // red X
  gameOver: "https://i.imgur.com/mNS95Hw.png"     // game over image
};
let SFX = {}; // ← add this once at the top

// --- AUDIO SETUP ---
function initAudio() {
  SFX = {
    correct: document.getElementById("sound-correct"),
    wrong:   document.getElementById("sound-wrong"),
    over:    document.getElementById("sound-over"),
    restart: document.getElementById("sound-restart"),
    tick:    document.getElementById("sound-tick"),   // Sonic "almost up"
    clock:   document.getElementById("sound-clock"),  // ← NEW ticking loop
  };
  if (SFX.correct) SFX.correct.volume = 0.8;
  if (SFX.wrong)   SFX.wrong.volume   = 0.9;
  if (SFX.over)    SFX.over.volume    = 0.9;
  if (SFX.restart) SFX.restart.volume = 0.8;
  if (SFX.tick)    SFX.tick.volume    = 0.7;
  if (SFX.clock)   SFX.clock.volume   = 0.35; // subtle under the action
}

function playLoop(key) {
  const a = SFX[key];
  if (!a) return;
  try { a.currentTime = 0; } catch {}
  a.loop = true;
  a.play?.().catch(()=>{});
}

function stopSfx(key) {
  const a = SFX[key];
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch {}
}

// Initialize audio once DOM is ready

// Unlock audio on first user gesture (mobile autoplay policies)
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  Object.values(SFX).forEach(a => {
    if (!a) return;
    try {
      a.muted = true;
      a.play()?.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
               .catch(() => {});
    } catch {}
  });
}

// make startGame visible to inline onclick and bind the button too
window.startGame = startGame;
document.addEventListener('DOMContentLoaded', () => {
  initAudio(); // make sure SFX{} has the elements
  const btn = document.getElementById('startBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      unlockAudio();          // iOS/Android autoplay policies
      playSfx('restart');     // quick audible ping to confirm audio works
      await new Promise(r => setTimeout(r, 50)); // tiny delay
      startGame();
    });
  }
});
// Fix mobile vh so panels don't jump when the URL bar shows/hides
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', setVH);
setVH();

// Preload a bunch of images (gifs) quietly
function preloadImages(urls = []) {
  urls.forEach(u => {
    const img = new Image();
    img.src = u;
  });
}

// Fetch questions if we don't already have them
async function ensureQuestionsLoaded() {
  if (originalQuestions && originalQuestions.length) return;
  try {
    const sheetData = await fetchMovesFromSheet();
    if (sheetData && sheetData.length) originalQuestions = sheetData;
  } catch (e) {
    console.warn("Preload fetch failed:", e);
  }
}

// --- CSV helpers (handles commas inside quotes) ---
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { // escaped quote ""
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^"(.*)"$/, '$1'));
}

async function fetchMovesFromSheet() {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjTkm6ab0rZjsvftj4H8ckey5R67X2zLd1yssFyS23zBsjK2Q5i6NtPqG3OzuVUenFOmL6QM1VDI5b/pub?gid=1644159541&single=true&output=csv";

  const resp = await fetch(url, { cache: "no-store" });
  const raw = await resp.text();

  // Strip BOM and split lines
  const text = raw.replace(/^\uFEFF/, "");
  const rows = text.split(/\r?\n/).filter(r => r.trim().length);
  rows.shift(); // drop header row

  const parsed = rows.map(row => {
    const cells = parseCSVLine(row);
    while (cells.length < 6) cells.push(""); // make sure we have 6 cells

    const [moveName, image, option1, option2, option3, option4] = cells;
    return {
      moveName: (moveName || "").trim(),
      image: (image || "").trim(),
      option1: (option1 || "").trim(),
      option2: (option2 || "").trim(),
      option3: (option3 || "").trim(),
      option4: (option4 || "").trim(),
    };
  }).filter(q =>
    q.moveName && q.image && q.option1 && q.option2 && q.option3 && q.option4
  );

  // Debug once: see the first parsed item in the console
  console.log("First parsed question:", parsed[0]);

  return parsed;
}

// ---------- LOADER / SPLASH ----------
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader');
  const loaderVideo = document.getElementById('loaderVideo');
  const startScreen = document.getElementById('startScreen');
  const game = document.getElementById('game');

  // show loader; hide others
  if (loader) loader.style.display = 'flex';
  if (startScreen) startScreen.style.display = 'none';
  if (game) game.style.display = 'none';

  // begin fetching after 1s
  setTimeout(async () => {
    await ensureQuestionsLoaded().catch(() => {});
    if (originalQuestions.length) {
      preloadImages(originalQuestions.slice(0, 4).map(q => q.image));
    }
  }, 1000);

  // reveal start screen when video ends OR after a timeout
  let revealed = false;
  const revealStart = () => {
    if (revealed) return;
    revealed = true;
    if (loader) loader.style.display = 'none';
    if (startScreen) startScreen.style.display = 'block';
  };

  if (loaderVideo) {
    loaderVideo.play?.().catch(() => {});
    loaderVideo.addEventListener('ended', revealStart, { once: true });
  }
  setTimeout(revealStart, 2600);
});

// ---------- GAME STATE ----------
let questionLocked = false;
let originalQuestions = [];
let questions = [];
let streak = 0;
let score = 0;
let strikes = 0;
let currentQuestion = 0;
let highScore = Number(localStorage.getItem("wrestlingHighScore")) || 0;
let timeLeft = 10;
let timerInterval = null;

function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }

// ---------- TIMER ----------
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  let timeLeft = 10;
  const timerEl = document.getElementById("timeLeft");
  timerEl.textContent = timeLeft;
  timerEl.style.color = "red";

  // Start the soft ticking loop as soon as answers are visible
  playLoop('clock');

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;

    // At 3 seconds: stop the loop and play the Sonic "almost up" sfx
    if (timeLeft === 3) {
      stopSfx('clock');
      playSfx('tick');
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      // Safety: make sure the clock is off
      stopSfx('clock');
      if (!questionLocked) {
        questionLocked = true;
        strikes++;
        streak = 0;
        document.getElementById("feedback").innerHTML =
          `<img src="${ICONS.x}" alt="x" style="height:20px;vertical-align:middle;"> Time’s up!`;
        updateScoreDisplay();

        if (strikes >= 3) {
          setTimeout(gameOver, 1000);
        } else {
          currentQuestion++;
          setTimeout(showQuestion, 1000);
        }
      }
    }
  }, 1000);
}


// ---------- START GAME ----------
async function startGame() {
  unlockAudio(); // important for mobile

  document.getElementById("startScreen").style.display = "none";
  document.getElementById("game").style.display = "block";

  try {
    if (!originalQuestions.length) {
      const sheetData = await fetchMovesFromSheet();
      if (!sheetData || !sheetData.length) throw new Error("Empty sheet");
      originalQuestions = sheetData;
    }
  } catch (e) {
    console.warn("Sheet fetch failed:", e);
    if (!originalQuestions.length) {
      alert("Couldn’t load questions from the sheet. Please check the share link or CSV format.");
      return;
    }
  }

  questions = shuffle([...originalQuestions]);
  score = 0; strikes = 0; streak = 0; currentQuestion = 0;

  showQuestion();
}

// ---------- SHOW QUESTION ----------
function showQuestion() {
  questionLocked = false;
  if (strikes >= 3) return gameOver();

  if (currentQuestion >= questions.length) {
    questions = shuffle([...originalQuestions]);
    currentQuestion = 0;
  }

  const q = questions[currentQuestion];
  const moveImage = document.getElementById("moveImage");
  const choices = document.getElementById("choices");
  const timerEl = document.getElementById("timer");
  const wrap = document.getElementById("choicesWrapper");

  // show background art while answers are hidden
  wrap?.classList.remove("showingAnswers");

  // hide answers + timer while GIF loads
  choices.style.visibility = "hidden";
  timerEl.style.visibility = "hidden";
  choices.style.opacity = 0;
  timerEl.style.opacity = 0;
  choices.style.pointerEvents = "none";

  // load GIF then delay to let it play a bit
  moveImage.onload = () => setTimeout(fadeInAndStartTimer, 3000);
  moveImage.onerror = () => {
    moveImage.src = "https://via.placeholder.com/300x200?text=Image+not+available";
    setTimeout(fadeInAndStartTimer, 800);
  };
  moveImage.src = q.image;

  const opts = shuffle([q.option1, q.option2, q.option3, q.option4]);
  document.getElementById("button1").innerText = opts[0];
  document.getElementById("button2").innerText = opts[1];
  document.getElementById("button3").innerText = opts[2];
  document.getElementById("button4").innerText = opts[3];

  document.getElementById("button1").onclick = () => checkAnswer(opts[0], q.moveName);
  document.getElementById("button2").onclick = () => checkAnswer(opts[1], q.moveName);
  document.getElementById("button3").onclick = () => checkAnswer(opts[2], q.moveName);
  document.getElementById("button4").onclick = () => checkAnswer(opts[3], q.moveName);

  document.getElementById("feedback").innerHTML = "";
  document.getElementById("finalScore").innerHTML = "";

  updateScoreDisplay();
}

// ---------- FADE IN ANSWERS + START TIMER ----------
function fadeInAndStartTimer() {
  const choices = document.getElementById("choices");
  const timerEl = document.getElementById("timer");
  const wrap = document.getElementById("choicesWrapper");

  wrap?.classList.add("showingAnswers"); // hide the background image

  choices.style.visibility = "visible";
  timerEl.style.visibility = "visible";

  choices.style.opacity = 0;
  timerEl.style.opacity = 0;

  requestAnimationFrame(() => {
    choices.style.transition = "opacity .4s";
    timerEl.style.transition  = "opacity .4s";
    choices.style.opacity = 1;
    timerEl.style.opacity  = 1;
  });

  setTimeout(() => {
    choices.style.pointerEvents = "auto";
    startTimer();
  }, 450);
}

// ---------- FEEDBACK / SCORE ----------
function heartsMarkup() {
  return [0,1,2].map(i => {
    const src = (strikes > i) ? ICONS.heartEmpty : ICONS.heartFull;
    return `<img src="${src}" alt="heart" style="height:18px;margin:0 2px;vertical-align:middle;">`;
  }).join("");
}

function updateScoreDisplay() {
  document.getElementById("score").innerHTML = `
    Score: ${score} <br>
    High Score: ${highScore} <br>
    <div id="hearts">${heartsMarkup()}</div>
  `;
}

// ---------- ANSWER HANDLER ----------
function checkAnswer(selected, correct) {
  // Stop the ticking as soon as a choice is made
  stopSfx('clock');
  if (questionLocked) return;

  questionLocked = true;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  if (selected === correct) {
    score++;
    streak++;
    document.getElementById("feedback").innerHTML =
      `<img src="${ICONS.check}" alt="correct" style="height:20px;vertical-align:middle;"> Correct!`;
    playSfx("correct");
  } else {
    strikes++;
    streak = 0;
    document.getElementById("feedback").innerHTML =
      `<img src="${ICONS.x}" alt="wrong" style="height:20px;vertical-align:middle;"> Wrong! Correct: ${correct}`;
    playSfx("wrong");
  }

  updateScoreDisplay();
  currentQuestion++;

  if (strikes >= 3) {
    setTimeout(gameOver, 800);
  } else {
    setTimeout(showQuestion, 800);
  }
}


// ---------- GAME OVER ----------
function gameOver() {
  // Safety: ensure loop/timer are off
  stopSfx('clock');
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("wrestlingHighScore", highScore);
  }

  playSfx("over");

  document.getElementById("gameOverScreen").style.display = "flex";
  document.getElementById("finalStats").innerHTML = `
    <div style="text-align:center;">
      <img src="${ICONS.gameOver}" alt="game over" style="height:64px;display:block;margin:0 auto 12px;">
      <p>Final Score: ${score}</p>
      <p>Strikes: ${strikes} <img src="${ICONS.x}" alt="x" style="height:16px;vertical-align:middle;"></p>
      <p>High Score: ${highScore}</p>
    </div>
  `;

  const btn = document.querySelector("#gameOverScreen button");
  if (btn && !btn.dataset.iconified) {
    btn.dataset.iconified = "true";
    btn.innerHTML = `<img src="${ICONS.redo}" alt="redo" style="height:18px;vertical-align:middle;margin-right:6px;"> Play Again`;
  }
}

// ---------- RESTART GAME ----------
function restartGame() {
  playSfx("restart");
  score = 0; strikes = 0; streak = 0; currentQuestion = 0;
  questions = shuffle([...originalQuestions]);
  document.getElementById("gameOverScreen").style.display = "none";
  showQuestion();
}
