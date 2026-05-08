/* ============================================
   FOCUSFLOW — script.js
   Fully functional AI-powered focus assistant by Afreed
   
   ============================================ */

"use strict";

/* ── State ── */
const state = {
  apiKey: localStorage.getItem("ff_apiKey") || "",
  focusDuration: parseInt(localStorage.getItem("ff_focus") || "25"),
  shortBreak: parseInt(localStorage.getItem("ff_short") || "5"),
  longBreak: parseInt(localStorage.getItem("ff_long") || "15"),
  timerRunning: false,
  timerMode: "focus",   // 'focus' | 'short' | 'long'
  timeLeft: 0,
  timerInterval: null,
  totalTime: 0,
  sessionsCompleted: parseInt(localStorage.getItem("ff_sessions") || "0"),
  streakDays: parseInt(localStorage.getItem("ff_streak") || "1"),
  quoteIndex: 0,
  currentTask: "",
};

/* ── DOM Refs ── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  initParticles();
  initSidebar();
  initTaskInput();
  initTimer();
  initMotivation();
  initSettings();
  initNavHighlight();
});

/* ─────────────────────────────────────────────
   LOADER
───────────────────────────────────────────── */
function initLoader() {
  const screen = $("loadingScreen");
  setTimeout(() => {
    screen.classList.add("hidden");
    screen.addEventListener("transitionend", () => screen.remove(), { once: true });
  }, 2000);
}

/* ─────────────────────────────────────────────
   PARTICLE BACKGROUND
───────────────────────────────────────────── */
function initParticles() {
  const canvas = $("particleCanvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let animFrame;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x   = Math.random() * canvas.width;
      this.y   = initial ? Math.random() * canvas.height : canvas.height + 10;
      this.r   = Math.random() * 1.5 + 0.3;
      this.vy  = -(Math.random() * 0.4 + 0.15);
      this.vx  = (Math.random() - 0.5) * 0.2;
      this.o   = Math.random() * 0.4 + 0.05;
      const hue = Math.random() < 0.5 ? 252 : 195;
      this.color = `hsla(${hue}, 80%, 70%, ${this.o})`;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < -10) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function spawnParticles() {
    const count = Math.floor((canvas.width * canvas.height) / 9000);
    particles = Array.from({ length: Math.min(count, 120) }, () => new Particle());
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    animFrame = requestAnimationFrame(loop);
  }

  resize();
  spawnParticles();
  loop();

  window.addEventListener("resize", () => {
    cancelAnimationFrame(animFrame);
    resize();
    spawnParticles();
    loop();
  });
}

/* ─────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────── */
function initSidebar() {
  const sidebar   = $("sidebar");
  const toggleBtn = $("sidebarToggle");

  toggleBtn.addEventListener("click", () => {
    const isMobile = window.innerWidth < 720;
    if (isMobile) {
      sidebar.classList.toggle("mobile-open");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });

  // Close sidebar on mobile overlay click
  document.addEventListener("click", e => {
    if (window.innerWidth < 720 &&
        sidebar.classList.contains("mobile-open") &&
        !sidebar.contains(e.target)) {
      sidebar.classList.remove("mobile-open");
    }
  });
}

function initNavHighlight() {
  const navItems = $$(".nav-item");
  const sections = $$(".section");

  navItems.forEach(item => {
    item.addEventListener("click", e => {
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // Intersection observer for scroll-spy
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach(i => {
          i.classList.toggle("active", i.dataset.section === id);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

/* ─────────────────────────────────────────────
   TASK INPUT
───────────────────────────────────────────── */
function initTaskInput() {
  const input      = $("taskInput");
  const charCount  = $("charCount");
  const breakBtn   = $("breakdownBtn");
  const prompts    = $$(".prompt-chip");
  const clearBtn   = $("clearBtn");
  const regenBtn   = $("regenerateBtn");
  const copyBtn    = $("copyBtn");

  // Char counter
  input.addEventListener("input", () => {
    charCount.textContent = input.value.length;
    charCount.style.color = input.value.length > 450
      ? "var(--amber)" : "var(--text-muted)";
  });

  // Enter (Ctrl/Cmd + Enter) to submit
  input.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") breakBtn.click();
  });

  // Quick prompts
  prompts.forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.prompt;
      charCount.textContent = input.value.length;
      input.focus();
      breakBtn.click();
    });
  });

  // Break down button
  breakBtn.addEventListener("click", async () => {
    const task = input.value.trim();
    if (!task) { showToast("Please enter a task first 💡"); input.focus(); return; }
    state.currentTask = task;
    await runBreakdown(task);
  });

  // Clear
  clearBtn && clearBtn.addEventListener("click", () => {
    $("taskResult").style.display = "none";
    $("emptyState").style.display = "block";
    input.value = "";
    charCount.textContent = "0";
    state.currentTask = "";
  });

  // Regenerate
  regenBtn && regenBtn.addEventListener("click", async () => {
    if (state.currentTask) await runBreakdown(state.currentTask);
  });

  // Copy steps
  copyBtn && copyBtn.addEventListener("click", () => {
    const steps = $$(".step-text");
    if (!steps.length) return;
    const text = Array.from(steps).map((s, i) => `${i+1}. ${s.textContent}`).join("\n");
    navigator.clipboard.writeText(text)
      .then(() => showToast("✅ Steps copied to clipboard!"))
      .catch(() => showToast("Couldn't copy — try manually"));
  });
}

/* ── AI Breakdown ── */
async function runBreakdown(task) {
  const btn = $("breakdownBtn");
  btn.classList.add("loading");
  btn.disabled = true;

  $("emptyState").style.display = "none";
  $("taskResult").style.display  = "none";

  try {
    let steps;
    if (state.apiKey) {
      steps = await callGeminiAPI(task);
    } else {
      await fakeDelay(1400 + Math.random() * 600);
      steps = getDemoResponse(task);
    }

    renderSteps(task, steps);
    $("breakdown").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Breakdown error:", err);
    const fallback = getDemoResponse(task);
    renderSteps(task, fallback);
    showToast("⚠ AI unavailable — showing smart demo steps");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

async function callGeminiAPI(task) {
  const prompt = `You are a productivity coach specialized in helping people with ADHD and overwhelm. 
Break down this task into 6-8 small, concrete, actionable steps. 
Each step should be specific, achievable in under 30 minutes, and written in a calm, encouraging tone.

Task: "${task}"

Respond ONLY with a JSON array of objects. Each object must have:
- "step": a concise action (max 12 words)
- "detail": one helpful sentence explaining it (max 20 words)  
- "tag": one of these labels: "Start here", "Quick win", "Deep work", "Research", "Creative", "Review", "Finish"

Example format:
[{"step":"...", "detail":"...", "tag":"..."}]

Return ONLY valid JSON, no markdown, no explanation.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
      })
    }
  );

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ── Demo responses ── */
function getDemoResponse(task) {
  const t = task.toLowerCase();
  const bank = {
    portfolio: [
      { step: "Pick 3-5 projects worth showing off",      detail: "Choose your best work — quality beats quantity every time.", tag: "Start here" },
      { step: "Choose a clean portfolio template",         detail: "GitHub Pages, Netlify, or Framer are beginner-friendly options.", tag: "Research" },
      { step: "Write a short, clear bio about yourself",   detail: "2–3 sentences: who you are, what you do, what you're seeking.", tag: "Quick win" },
      { step: "Create a project card for each item",       detail: "Include title, screenshot, description, and a live/code link.", tag: "Deep work" },
      { step: "Add a simple contact section",              detail: "Email link or a minimal form — keep it frictionless.", tag: "Quick win" },
      { step: "Deploy and test on mobile",                 detail: "Share the URL with one trusted person for first feedback.", tag: "Review" },
      { step: "Post your portfolio link publicly",         detail: "LinkedIn, Twitter/X, or a dev community to start getting eyes.", tag: "Finish" },
    ],
    exam: [
      { step: "List every topic that might appear",        detail: "Scan lecture notes, syllabus, and past papers for key themes.", tag: "Start here" },
      { step: "Rate each topic: know it / shaky / lost",   detail: "Honest self-assessment saves precious study hours.", tag: "Quick win" },
      { step: "Block 25-minute sessions per topic",        detail: "Use this app's timer — one topic per Pomodoro session.", tag: "Deep work" },
      { step: "Summarize 'shaky' topics in your words",    detail: "Writing in your own words is proven to boost retention.", tag: "Deep work" },
      { step: "Do 5 practice questions per weak area",     detail: "Active recall beats re-reading by 2–3×.", tag: "Research" },
      { step: "Create a one-page cheat-sheet (don't cheat)", detail: "Summarizing forces you to prioritize the most important ideas.", tag: "Creative" },
      { step: "Final review night before: 30 minutes only", detail: "Sleep is more valuable than late-night cramming.", tag: "Finish" },
    ],
    room: [
      { step: "Grab a trash bag and do one quick pass",    detail: "Just remove obvious rubbish — don't organize yet.", tag: "Start here" },
      { step: "Put everything in one of 3 zones",         detail: "Keep / Donate / Trash — don't get sentimental yet.", tag: "Quick win" },
      { step: "Clear all surfaces first",                  detail: "Desk, floor, bed — empty surfaces feel immediately better.", tag: "Deep work" },
      { step: "Deal with laundry as one block",            detail: "Wash, dry, fold, put away — finish the cycle.", tag: "Deep work" },
      { step: "Organize one drawer or shelf at a time",    detail: "Small wins build momentum. Celebrate each one.", tag: "Quick win" },
      { step: "Vacuum or sweep the floor",                 detail: "The physical feeling of a clean floor is genuinely satisfying.", tag: "Review" },
      { step: "Add one small nice touch",                  detail: "A candle, a plant, or tidy cables — make it feel like yours.", tag: "Finish" },
    ],
    freelance: [
      { step: "Write down your top 3 marketable skills",   detail: "What can you do for someone today that they'd pay for?", tag: "Start here" },
      { step: "Set your starter rate (lower is okay)",     detail: "Research rates on Upwork or Fiverr for your niche.", tag: "Research" },
      { step: "Create a simple one-page service offer",    detail: "What, for whom, how long, how much — clear and direct.", tag: "Quick win" },
      { step: "List 10 people who might need your skill",  detail: "Friends, old classmates, local businesses — warm leads first.", tag: "Deep work" },
      { step: "Send 3 personalized outreach messages",     detail: "Reference something specific about them. Be brief and genuine.", tag: "Creative" },
      { step: "Create a basic invoice template",           detail: "Wave, PayPal, or a simple PDF — look professional from day one.", tag: "Quick win" },
      { step: "Land your first tiny project",              detail: "Even free or discounted work builds proof. Testimonials are gold.", tag: "Finish" },
    ],
    default: [
      { step: "Write down everything on your mind about it", detail: "A full brain-dump removes the mental load. Nothing is too small.", tag: "Start here" },
      { step: "Identify the single most important first action", detail: "What one thing, if done, would make the rest easier?", tag: "Quick win" },
      { step: "Set a 25-minute timer and start only that",  detail: "Commitment to starting is 80% of completion.", tag: "Deep work" },
      { step: "List what you'll need before you begin",     detail: "Tools, resources, people, information — gather it now.", tag: "Research" },
      { step: "Break the hardest part into two smaller parts", detail: "If it feels too big, divide it again until it doesn't.", tag: "Deep work" },
      { step: "Do a mid-point check-in with yourself",      detail: "Am I on track? What's the next micro-step?", tag: "Review" },
      { step: "Define what 'done' actually looks like",     detail: "A clear finish line prevents endless perfectionism.", tag: "Finish" },
    ],
  };

  if (t.includes("portfolio") || t.includes("website") || t.includes("site"))
    return bank.portfolio;
  if (t.includes("exam") || t.includes("study") || t.includes("test") || t.includes("course"))
    return bank.exam;
  if (t.includes("clean") || t.includes("room") || t.includes("tidy") || t.includes("organis") || t.includes("organiz"))
    return bank.room;
  if (t.includes("freelance") || t.includes("business") || t.includes("client") || t.includes("launch"))
    return bank.freelance;

  // Generate slightly varied generic response
  return bank.default;
}

/* ── Render Steps ── */
function renderSteps(task, steps) {
  $("resultTaskName").textContent = task.length > 50 ? task.slice(0, 47) + "…" : task;
  const container = $("stepsContainer");
  container.innerHTML = "";

  steps.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.innerHTML = `
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <div class="step-text"></div>
        <span class="step-tag">${s.tag || "Action"}</span>
      </div>
      <div class="step-check">✓</div>
    `;

    div.addEventListener("click", () => {
      div.classList.toggle("done");
    });

    container.appendChild(div);

    // Staggered visibility
    setTimeout(() => div.classList.add("visible"), i * 80);

    // Typing effect for step text
    typeText(div.querySelector(".step-text"), s.step + (s.detail ? " — " + s.detail : ""), i * 80 + 100);
  });

  $("taskResult").style.display = "block";
}

/* ── Typing Effect ── */
function typeText(el, text, delay = 0) {
  setTimeout(() => {
    let i = 0;
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    el.appendChild(cursor);

    const interval = setInterval(() => {
      el.insertBefore(document.createTextNode(text[i]), cursor);
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        cursor.remove();
      }
    }, 18);
  }, delay);
}

/* ── Fake delay ── */
function fakeDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─────────────────────────────────────────────
   POMODORO TIMER
───────────────────────────────────────────── */
function initTimer() {
  const startBtn   = $("startBtn");
  const resetBtn   = $("resetBtn");
  const skipBtn    = $("skipBtn");
  const modeTabs   = $$(".mode-tab");
  const circumference = 2 * Math.PI * 96; // r=96

  $("timerProgress").style.strokeDasharray  = circumference;
  $("timerProgress").style.strokeDashoffset = 0;

  setTimerMode("focus");

  startBtn.addEventListener("click", () => {
    if (state.timerRunning) pauseTimer(); else startTimer();
  });
  resetBtn.addEventListener("click", resetTimer);
  skipBtn.addEventListener("click",  skipTimer);

  modeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      modeTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      resetTimer();
      setTimerMode(tab.dataset.mode);
    });
  });

  updateSessionDots();
}

function setTimerMode(mode) {
  state.timerMode = mode;
  const durations = {
    focus: state.focusDuration * 60,
    short: state.shortBreak * 60,
    long:  state.longBreak * 60,
  };
  const labels = { focus: "Focus Session", short: "Short Break", long: "Long Break" };

  state.totalTime = durations[mode];
  state.timeLeft  = state.totalTime;
  $("timerModeLabel").textContent = labels[mode];
  updateTimerDisplay();
  updateTimerArc();
}

function startTimer() {
  if (state.timeLeft <= 0) { setTimerMode(state.timerMode); }
  state.timerRunning = true;
  $("startBtn").textContent = "⏸";
  state.timerInterval = setInterval(tickTimer, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  $("startBtn").textContent = "▶";
  clearInterval(state.timerInterval);
}

function resetTimer() {
  pauseTimer();
  setTimerMode(state.timerMode);
  $("startBtn").textContent = "▶";
}

function skipTimer() {
  pauseTimer();
  completeSession();
}

function tickTimer() {
  if (state.timeLeft <= 0) {
    completeSession();
    return;
  }
  state.timeLeft--;
  updateTimerDisplay();
  updateTimerArc();
}

function completeSession() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  $("startBtn").textContent = "▶";

  if (state.timerMode === "focus") {
    state.sessionsCompleted++;
    localStorage.setItem("ff_sessions", state.sessionsCompleted);
    updateSessionDots();
    showToast("🎉 Focus session complete! Take a break.");
    // Auto switch to break
    const nextMode = state.sessionsCompleted % 4 === 0 ? "long" : "short";
    const tab = document.querySelector(`.mode-tab[data-mode="${nextMode}"]`);
    if (tab) tab.click();
  } else {
    showToast("☕ Break over. Time to focus!");
    const tab = document.querySelector(`.mode-tab[data-mode="focus"]`);
    if (tab) tab.click();
  }
}

function updateTimerDisplay() {
  const m = Math.floor(state.timeLeft / 60).toString().padStart(2, "0");
  const s = (state.timeLeft % 60).toString().padStart(2, "0");
  $("timerDisplay").textContent = `${m}:${s}`;
}

function updateTimerArc() {
  const circumference = 2 * Math.PI * 96;
  const progress  = state.timeLeft / state.totalTime;
  const offset    = circumference * (1 - progress);
  $("timerProgress").style.strokeDashoffset = offset;
}

function updateSessionDots() {
  const dots = $$(".dot");
  dots.forEach((dot, i) => {
    dot.className = "dot";
    if (i < state.sessionsCompleted % 4) dot.classList.add("completed");
    if (i === state.sessionsCompleted % 4 && state.timerRunning && state.timerMode === "focus")
      dot.classList.add("active");
  });
}

/* ─────────────────────────────────────────────
   MOTIVATION / QUOTES
───────────────────────────────────────────── */
const quotes = [
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Progress, not perfection. One step forward is still forward.", author: "FocusFlow" },
  { text: "Your brain isn't broken — it's just wired differently. Work with it, not against it.", author: "ADHD Wisdom" },
  { text: "Done is better than perfect. Ship it, improve it, repeat.", author: "Reid Hoffman" },
  { text: "The hardest part is sitting down to start. After that, momentum takes over.", author: "FocusFlow" },
  { text: "Neurodivergence is not a limitation — it's a different kind of power.", author: "ADDitude Magazine" },
  { text: "Small steps, taken consistently, outperform giant leaps taken occasionally.", author: "James Clear" },
  { text: "Focus is not about doing more — it's about doing less, better.", author: "Greg McKeown" },
  { text: "Overwhelm is a sign you need a smaller next step, not a longer day.", author: "FocusFlow" },
  { text: "You are not behind. You are on your own timeline.", author: "FocusFlow" },
  { text: "Every expert was once a beginner who refused to give up.", author: "Helen Hayes" },
  { text: "The task is not the enemy. Ambiguity is. Break it down.", author: "FocusFlow" },
  { text: "Rest is not giving up. Rest is fueling the comeback.", author: "FocusFlow" },
];

function initMotivation() {
  state.quoteIndex = Math.floor(Math.random() * quotes.length);
  renderQuote();

  $("nextQuoteBtn").addEventListener("click", () => {
    $("motivationCard").style.opacity = "0.4";
    $("motivationCard").style.transform = "translateY(4px)";
    setTimeout(() => {
      state.quoteIndex = (state.quoteIndex + 1) % quotes.length;
      renderQuote();
      $("motivationCard").style.opacity = "";
      $("motivationCard").style.transform = "";
    }, 220);
  });

  $("streakCount").textContent = state.streakDays;
  updateStreakBar();
}

function renderQuote() {
  const q = quotes[state.quoteIndex];
  $("quoteText").textContent  = q.text;
  $("quoteAuthor").textContent = `— ${q.author}`;
}

function updateStreakBar() {
  const milestones = [7, 14, 30, 60, 100];
  const next = milestones.find(m => m > state.streakDays) || 100;
  const prev = milestones[milestones.indexOf(next) - 1] || 0;
  const pct  = ((state.streakDays - prev) / (next - prev)) * 100;
  document.querySelector(".streak-fill").style.width = `${Math.min(pct, 100)}%`;
  document.querySelector(".streak-next").textContent = `Next milestone: ${next} days`;
}

/* ─────────────────────────────────────────────
   SETTINGS
───────────────────────────────────────────── */
function initSettings() {
  const modal     = $("settingsModal");
  const openBtn   = $("settingsBtn");
  const closeBtn  = $("modalClose");
  const saveBtn   = $("saveSettings");

  // Pre-fill
  $("apiKeyInput").value    = state.apiKey;
  $("focusDuration").value  = state.focusDuration;
  $("shortBreak").value     = state.shortBreak;
  $("longBreak").value      = state.longBreak;

  openBtn.addEventListener("click", () => modal.classList.add("open"));
  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });

  saveBtn.addEventListener("click", () => {
    const key    = $("apiKeyInput").value.trim();
    const focus  = parseInt($("focusDuration").value) || 25;
    const short  = parseInt($("shortBreak").value) || 5;
    const longB  = parseInt($("longBreak").value) || 15;

    state.apiKey        = key;
    state.focusDuration = focus;
    state.shortBreak    = short;
    state.longBreak     = longB;

    localStorage.setItem("ff_apiKey", key);
    localStorage.setItem("ff_focus",  focus);
    localStorage.setItem("ff_short",  short);
    localStorage.setItem("ff_long",   longB);

    // Update status indicator
    const dot   = $("statusDot");
    const label = $("statusLabel");
    if (key) {
      dot.classList.add("live");
      label.textContent = "Gemini Live";
    } else {
      dot.classList.remove("live");
      label.textContent = "Demo Mode";
    }

    // Reset timer to reflect new durations
    resetTimer();
    setTimerMode(state.timerMode);

    modal.classList.remove("open");
    showToast("✅ Settings saved!");
  });

  // Set initial status
  if (state.apiKey) {
    $("statusDot").classList.add("live");
    $("statusLabel").textContent = "Gemini Live";
  }
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let toastTimeout;
function showToast(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ─────────────────────────────────────────────
   MOBILE SIDEBAR TOGGLE (top bar)
───────────────────────────────────────────── */
document.addEventListener("click", e => {
  const toggleBtn = $("sidebarToggle");
  if (toggleBtn && e.target.closest(".sidebar-toggle")) {
    // handled by initSidebar
    return;
  }
});
