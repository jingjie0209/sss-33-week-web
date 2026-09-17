/* Daily loop, activity library, rewards, reading and parent controls. Content stays on the local SSS data model. */
const SUSAN_WORD_KEY = "sss-word-mastery-v1";
const SUSAN_READING_KEY = "sss-reading-days-v1";
const SUSAN_GAME_KEY = "sss-today-games-v1";
const SUSAN_SETTINGS_KEY = "sss-parent-settings-v1";
const SUSAN_CHALLENGE_KEY = "sss-challenge-stars-v1";
const susanRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const susanWrite = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let susanWordState = susanRead(SUSAN_WORD_KEY, {});
let susanReadingState = susanRead(SUSAN_READING_KEY, {});
let susanGameState = susanRead(SUSAN_GAME_KEY, []);
let susanSettings = susanRead(SUSAN_SETTINGS_KEY, { age: "3-4", minutes: 12 });
let susanChallengeStars = Number(localStorage.getItem(SUSAN_CHALLENGE_KEY) || 0);
let susanQuiz = null;

const SUSAN_STEPS = [
  ["1", "暖场输入", "先听一遍儿歌，边听边做动作"],
  ["2", "今日闪卡", "选 3 张词卡，指认并说两遍"],
  ["3", "句型替换", "把本周句型换一个词再说"],
  ["4", "游戏输出", "选一个游戏，动起来说英语"],
  ["5", "亲子阅读", "睡前翻一本书，指图提问"],
];
const SUSAN_GAMES = (window.SUSAN_GAMES_DATA || []).map((game) => ({
  ...game,
  typeLabel: game.type === "intro" ? "引入·动起来" : game.type === "review" ? "复习·Zoom in" : "闯关情景",
  ageLabel: `${game.age}岁`,
}));
const legacyGameNames = { "拍卡找词": "拍打游戏", "抽卡造句": "摇摇乐抽卡造句", "分类收集": "分类收纳", "音乐停停": "木头人跳舞 Freeze", "投篮造句": "投篮造句" };
susanGameState = susanGameState.map((value) => {
  if (SUSAN_GAMES.some((game) => game.id === value)) return value;
  const name = legacyGameNames[value] || value;
  return SUSAN_GAMES.find((game) => game.name === name)?.id || null;
}).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 3);
susanWrite(SUSAN_GAME_KEY, susanGameState);
const susanAllWords = (() => {
  const map = new Map();
  songs.forEach((song) => (song.words || []).forEach((word) => {
    const key = normalize(word.english);
    if (!key) return;
    if (!map.has(key)) map.set(key, { ...word, english: word.english, songs: [] });
    const item = map.get(key);
    if (!item.songs.includes(song.sheet)) item.songs.push(song.sheet);
  }));
  return [...map.values()].sort((a, b) => a.english.localeCompare(b.english, "en"));
})();
const susanToday = () => {
  const start = new Date(2026, 8, 14);
  const now = new Date();
  const day = Math.max(0, Math.floor((now - start) / 86400000));
  const weekIndex = Math.min(weeks.length - 1, Math.floor(day / 7));
  const dayIndex = day % 7;
  const week = weeks[weekIndex] || weeks[0];
  const songItem = week.songs[dayIndex % week.songs.length] || week.songs[0];
  return { day, dayIndex, weekIndex, week, song: songItem ? songBySheet.get(songItem.sheet) : songs[0] };
};
const susanStars = () => songs.filter(isDone).length + Object.values(susanWordState).filter(Boolean).length + Object.keys(susanReadingState).length * 2 + susanChallengeStars;
const susanDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const susanToast = (message) => { document.querySelector(".integration-toast")?.remove(); const toast = document.createElement("div"); toast.className = "integration-toast"; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.remove(), 1800); };

function renderTodayIntegration() {
  const root = $("#today-view");
  if (!root) return;
  const { dayIndex, weekIndex, week, song } = susanToday();
  const doneCount = songs.filter(isDone).length;
  const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const weekSongs = week.songs.map((item) => songBySheet.get(item.sheet)).filter(Boolean);
  const selectedGameCount = susanGameState.length;
  root.innerHTML = `<div class="today-hero"><section class="today-feature"><p class="today-kicker">第 ${week.week} 周 · ${escapeHtml(themeCategory(week.theme))} · ${dayNames[dayIndex]}</p><h1>${escapeHtml(song?.title || "今天的 SSS 学习")}</h1><p>${escapeHtml(song?.meta || "用一首儿歌完成今天的输入、互动和输出。")}</p><div class="today-actions"><button class="button" data-song-sheet="${escapeHtml(song?.sheet || "")}">打开歌曲拆解</button><button class="button secondary" data-today-done="${escapeHtml(song?.sheet || "")}">${song && isDone(song) ? "今天已完成" : "完成今日歌曲"}</button></div></section><aside class="today-side"><div class="today-stat"><span>今日目标</span><strong>${Number(susanSettings.minutes) || 12} 分钟</strong><small>5 个轻量环节</small></div><div class="today-stat"><span>歌曲进度</span><strong>${doneCount}/${songs.length}</strong><div class="progress-track"><i style="width:${(doneCount / songs.length) * 100}%"></i></div></div><div class="today-stat"><span>我的星星</span><strong>${susanStars()} ⭐</strong><small>完成歌曲、词卡和阅读都会累计</small></div></aside></div><div class="today-strip">${weekSongs.map((item, index) => `<button class="today-day${item.sheet === song?.sheet ? " active" : ""}" data-song-sheet="${escapeHtml(item.sheet)}"><small>本周第 ${index + 1} 首</small><b>${escapeHtml(item.title)}</b><span>${isDone(item) ? "已完成" : "待学习"}</span></button>`).join("")}</div><section class="integration-section"><h2>这一周的每日环节</h2><p>每天只推进一点点，先建立参与感，再自然增加宝宝的开口机会。</p><div class="step-flow">${SUSAN_STEPS.map(([number, title, copy]) => `<article class="step-flow-item"><strong>${number}</strong><b>${title}</b><span>${copy}</span></article>`).join("")}</div></section><section class="integration-section"><div class="integration-card"><h2>今天可以从哪里开始</h2><p>把同一份内容放进不同入口，家长和宝宝都能按当下状态选择。</p><div class="quick-links"><button class="quick-link" data-view="noun-cards"><span><b>看一张词卡</b><small>从名词、动词或形容词开始</small></span><b>→</b></button><button class="quick-link" data-view="games"><span><b>选一个游戏</b><small>${selectedGameCount ? `今日已选 ${selectedGameCount} 个` : "动起来再说"}</small></span><b>→</b></button><button class="quick-link" data-view="reading"><span><b>睡前读一本</b><small>用今天的歌曲做讨论线索</small></span><b>→</b></button></div></div></section>`;
}

function renderGamesIntegration() {
  const root = $("#games-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>游戏库</h1><p>全部 ${SUSAN_GAMES.length} 个游戏，按引入、复习、闯关筛选；点开查看玩法、场景、道具和英文话术。</p></div><div class="summary"><div class="metric"><span>今日已选</span><strong>${susanGameState.length}/3</strong></div></div></div><div class="integration-card game-library-note"><b>游戏分三类：</b>引入类（新句型日大动作）、复习类（Zoom in 串联已知内容）、闯关情景类（周末高能输出）。每个游戏都可以直接加入今日游戏。</div><div class="game-filter-row"><input id="integration-game-search" class="control integration-search" type="search" placeholder="搜索游戏名 / 场景 / 玩法"><button class="integration-pill active" data-game-filter="all">全部 ${SUSAN_GAMES.length}</button><button class="integration-pill" data-game-filter="intro">引入 ${SUSAN_GAMES.filter((game) => game.type === "intro").length}</button><button class="integration-pill" data-game-filter="review">复习 ${SUSAN_GAMES.filter((game) => game.type === "review").length}</button><button class="integration-pill" data-game-filter="challenge">闯关 ${SUSAN_GAMES.filter((game) => game.type === "challenge").length}</button></div><p id="integration-game-note" class="result-note"></p><div id="integration-game-grid" class="integration-game-grid"></div>`;
  let filter = "all";
  const draw = () => {
    const query = $("#integration-game-search").value.trim().toLowerCase();
    const list = SUSAN_GAMES.filter((game) => (filter === "all" || game.type === filter) && (!query || `${game.name}${game.scene}${game.how}${game.move}${game.props.join("")}`.toLowerCase().includes(query)));
    $("#integration-game-note").textContent = `显示 ${list.length} 个游戏 · 今日已选 ${susanGameState.length} 个`;
    $("#integration-game-grid").innerHTML = list.map((game, index) => { const selected = susanGameState.includes(game.id); const dialogue = game.dialogue.map((line) => `<div class="game-dialogue"><span class="${line.who === "kid" ? "kid" : "mom"}">${line.who === "kid" ? "🧒 宝宝" : "👩 妈妈"}</span><p>${escapeHtml(line.text)}</p></div>`).join(""); return `<article class="integration-game${index === 0 ? " open" : ""}" data-game-card="${escapeHtml(game.id)}"><button class="integration-game-head" data-game-toggle="${escapeHtml(game.id)}"><span class="game-number">${SUSAN_GAMES.indexOf(game) + 1}</span><span class="game-title">${escapeHtml(game.name)}</span><span class="integration-tags"><span>${escapeHtml(game.ageLabel)}</span><span>${escapeHtml(game.typeLabel)}</span><span>${escapeHtml(game.move)}</span></span><span class="game-chevron">▾</span></button><div class="integration-game-body"><div class="game-scene">🎬 场景：${escapeHtml(game.scene)}</div><p class="game-how">${escapeHtml(game.how)}</p>${game.props.length ? `<div class="game-props">${game.props.map((prop) => `<span>${escapeHtml(prop)}</span>`).join("")}</div>` : ""}<div class="game-en-title">英文话术（照着说就行）</div>${dialogue}${game.tip ? `<div class="game-tip">${escapeHtml(game.tip)}</div>` : ""}<button class="button ${selected ? "secondary" : ""}" data-add-game="${escapeHtml(game.id)}">${selected ? "已加入今日" : "＋ 加为今日游戏"}</button></div></article>`; }).join("");
  };
  $("#integration-game-search").oninput = draw;
  root.querySelectorAll("[data-game-filter]").forEach((button) => { button.onclick = () => { filter = button.dataset.gameFilter; root.querySelectorAll("[data-game-filter]").forEach((item) => item.classList.toggle("active", item === button)); draw(); }; });
  draw();
}

function susanNewQuiz() {
  const target = susanAllWords[Math.floor(Math.random() * susanAllWords.length)] || { english: "hello", meaning: "你好" };
  const pool = susanAllWords.filter((item) => item.english !== target.english).sort(() => Math.random() - .5).slice(0, 3);
  const options = [target, ...pool].sort(() => Math.random() - .5);
  susanQuiz = { target, options };
}
function renderChallengeIntegration() {
  const root = $("#challenge-view");
  if (!root) return;
  if (!susanQuiz) susanNewQuiz();
  const doneReading = susanReadingState[susanDateKey()];
  root.innerHTML = `<div class="page-head"><div><h1>闯关与奖励</h1><p>每次只挑战 5 题，完成后把星星换成真实的亲子奖励。</p></div></div><div class="stars-panel"><div><span>宝宝的小星星</span><strong>${susanStars()} ⭐</strong></div><div><span>已完成歌曲</span><strong>${songs.filter(isDone).length}/${songs.length}</strong></div><div><span>今日阅读</span><strong>${doneReading ? "已打卡" : "未打卡"}</strong></div></div><div class="challenge-grid"><article class="challenge-card"><h3>猜词 · 看中文选英文</h3><p>用最短时间认出一个核心词，答对就得 1 颗星。</p><div class="quiz-box"><b>“${escapeHtml(susanQuiz.target.meaning || "中文释义")}” 对应哪个词？</b><div class="quiz-options">${susanQuiz.options.map((item) => `<button class="quiz-option" data-quiz-answer="${escapeHtml(item.english)}">${escapeHtml(item.english)}</button>`).join("")}</div></div></article><article class="challenge-card"><h3>我演你猜 · 做动作</h3><p>家长做一个 TPR 动作，宝宝说出对应英文；轮流当出题人。</p><button class="button" data-quick-star="动作闯关">完成一题 +1 ⭐</button></article><article class="challenge-card"><h3>是真的吗 · 判断句子</h3><p>从今天的歌曲里挑一句，把正确或错误说出来，再改成完整表达。</p><button class="button" data-quick-star="判断闯关">完成一题 +1 ⭐</button></article></div><section class="integration-section"><div class="integration-card"><h2>星星商城</h2><p>奖励由家长确认，建议优先选择陪伴型活动。</p><div class="quick-links"><div class="quick-link"><span><b>贴纸 1 张</b><small>5 ⭐</small></span><b>${susanStars() >= 5 ? "可兑换" : "还差 " + (5 - susanStars())}</b></div><div class="quick-link"><span><b>挑一本睡前故事</b><small>8 ⭐</small></span><b>${susanStars() >= 8 ? "可兑换" : "还差 " + (8 - susanStars())}</b></div><div class="quick-link"><span><b>去公园玩一次</b><small>20 ⭐</small></span><b>${susanStars() >= 20 ? "可兑换" : "还差 " + (20 - susanStars())}</b></div></div></div></section>`;
}

function renderReadingIntegration() {
  const root = $("#reading-view");
  if (!root) return;
  const { week, song } = susanToday();
  const todayKey = susanDateKey();
  const month = new Date().getMonth() + 1;
  const monthDays = new Date(new Date().getFullYear(), month, 0).getDate();
  root.innerHTML = `<div class="page-head"><div><h1>亲子阅读</h1><p>阅读不另起炉灶：从今天的歌曲和词卡里带一个问题进绘本。</p></div><div class="summary"><div class="metric"><span>本月阅读</span><strong>${Object.keys(susanReadingState).filter((key) => key.startsWith(`${new Date().getFullYear()}-${String(month).padStart(2, "0")}`)).length} 天</strong></div></div></div><div class="reading-layout"><article class="reading-card"><span class="today-kicker">今日阅读线 · 第 ${week.week} 周</span><h2>${escapeHtml(song?.title || "亲子共读")}</h2><p>随便翻一页，指着图让宝宝先观察，再用本周内容说一小句。重点是互动，不是读完多少页。</p><ul class="reading-prompts"><li><b>1</b>这本书讲了什么？</li><li><b>2</b>你最喜欢哪个角色或画面？</li><li><b>3</b>能不能用一个今天的词描述它？</li></ul><button class="button" data-reading-done>${susanReadingState[todayKey] ? "今日阅读已完成" : "读完打卡 +2 ⭐"}</button></article><aside class="reading-card"><h2>本月阅读日历</h2><p>每天读一点，形成可见的连续感。</p><div class="calendar-grid">${Array.from({ length: monthDays }, (_, index) => { const day = index + 1; const key = `${new Date().getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; return `<span class="${susanReadingState[key] ? "done" : ""}">${day}</span>`; }).join("")}</div></aside></div>`;
}

function renderParentIntegration() {
  const root = $("#parent-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>家长设置</h1><p>把计划调到家里真正能坚持的节奏，数据只保存在当前浏览器。</p></div></div><div class="settings-grid"><article class="setting-card"><label for="parent-age">孩子年龄段</label><select id="parent-age"><option value="2-3" ${susanSettings.age === "2-3" ? "selected" : ""}>2-3 岁</option><option value="3-4" ${susanSettings.age === "3-4" ? "selected" : ""}>3-4 岁</option><option value="4-6" ${susanSettings.age === "4-6" ? "selected" : ""}>4-6 岁</option></select></article><article class="setting-card"><label for="parent-minutes">每日目标分钟数</label><input id="parent-minutes" type="number" min="5" max="30" step="1" value="${Number(susanSettings.minutes) || 12}"></article></div><div class="setting-actions"><button class="button" data-save-settings>保存设置</button><button class="button secondary" data-export-backup>导出学习备份</button><button class="button danger" data-reset-integration>清空本功能数据</button></div><p class="integration-note">导出备份包含歌曲完成状态、词卡掌握、阅读打卡和家长设置；不会上传到网络。清空只影响本页新增的学习数据，不会删除原有歌曲内容。</p><section class="integration-section"><div class="integration-card"><h2>当前学习概览</h2><div class="quick-links"><div class="quick-link"><span><b>歌曲</b><small>已完成</small></span><b>${songs.filter(isDone).length}/${songs.length}</b></div><div class="quick-link"><span><b>词卡</b><small>已掌握</small></span><b>${Object.values(susanWordState).filter(Boolean).length}/${susanAllWords.length}</b></div><div class="quick-link"><span><b>星星</b><small>累计</small></span><b>${susanStars()} ⭐</b></div></div></div></section>`;
}

function bindIntegrationNavigation() {
  document.querySelectorAll("button[data-view]").forEach((button) => {
    const view = button.dataset.view;
    if (!["today", "games", "challenge", "reading", "parent"].includes(view)) return;
    button.onclick = () => {
      showView(view);
      if (view === "today") renderTodayIntegration();
      if (view === "games") renderGamesIntegration();
      if (view === "challenge") renderChallengeIntegration();
      if (view === "reading") renderReadingIntegration();
      if (view === "parent") renderParentIntegration();
    };
  });
}
function renderIntegrationViews() { renderTodayIntegration(); renderGamesIntegration(); renderChallengeIntegration(); renderReadingIntegration(); renderParentIntegration(); bindIntegrationNavigation(); }

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav && ["today", "games", "challenge", "reading", "parent"].includes(nav.dataset.view)) {
    const view = nav.dataset.view;
    if (view === "today") renderTodayIntegration();
    if (view === "games") renderGamesIntegration();
    if (view === "challenge") renderChallengeIntegration();
    if (view === "reading") renderReadingIntegration();
    if (view === "parent") renderParentIntegration();
  }
  const todayDone = event.target.closest("[data-today-done]");
  if (todayDone) { toggleSong(todayDone.dataset.todayDone); renderTodayIntegration(); renderChallengeIntegration(); }
  const addGame = event.target.closest("[data-add-game]");
  if (addGame) {
    const id = addGame.dataset.addGame;
    const alreadySelected = susanGameState.includes(id);
    if (!alreadySelected && susanGameState.length >= 3) {
      susanToast("今日最多选择 3 个游戏");
      return;
    }
    susanGameState = alreadySelected ? susanGameState.filter((item) => item !== id) : [...susanGameState, id];
    susanWrite(SUSAN_GAME_KEY, susanGameState);
    renderGamesIntegration();
    renderTodayIntegration();
    susanToast(alreadySelected ? "已从今日移除" : "已加入今日游戏");
  }
  const gameToggle = event.target.closest("[data-game-toggle]");
  if (gameToggle) { const card = gameToggle.closest("[data-game-card]"); card?.classList.toggle("open"); }
  const answer = event.target.closest("[data-quiz-answer]");
  if (answer && susanQuiz) { if (answer.dataset.quizAnswer === susanQuiz.target.english) { susanWordState[normalize(susanQuiz.target.english)] = true; susanWrite(SUSAN_WORD_KEY, susanWordState); susanToast("答对了，获得 1 颗星 ⭐"); } else susanToast(`正确答案是 ${susanQuiz.target.english}`); susanNewQuiz(); renderChallengeIntegration(); renderTodayIntegration(); }
  const quickStar = event.target.closest("[data-quick-star]");
  if (quickStar) { susanChallengeStars += 1; localStorage.setItem(SUSAN_CHALLENGE_KEY, String(susanChallengeStars)); susanToast("完成一题，获得 1 颗星 ⭐"); renderChallengeIntegration(); renderTodayIntegration(); }
  const readingDone = event.target.closest("[data-reading-done]");
  if (readingDone) { const key = susanDateKey(); susanReadingState[key] = true; susanWrite(SUSAN_READING_KEY, susanReadingState); susanToast("阅读打卡成功，+2 星 ⭐"); renderReadingIntegration(); renderChallengeIntegration(); renderTodayIntegration(); }
  const saveSettings = event.target.closest("[data-save-settings]");
  if (saveSettings) { susanSettings = { age: $("#parent-age").value, minutes: Math.max(5, Math.min(30, Number($("#parent-minutes").value) || 12)) }; susanWrite(SUSAN_SETTINGS_KEY, susanSettings); susanToast("家长设置已保存"); renderParentIntegration(); renderTodayIntegration(); }
  const exportBackup = event.target.closest("[data-export-backup]");
  if (exportBackup) { const payload = { exportedAt: new Date().toISOString(), songProgress: state, wordMastery: susanWordState, reading: susanReadingState, games: susanGameState, challengeStars: susanChallengeStars, settings: susanSettings }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `sss-learning-backup-${susanDateKey()}.json`; link.click(); URL.revokeObjectURL(link.href); susanToast("备份已导出"); }
  const reset = event.target.closest("[data-reset-integration]");
  if (reset) { susanWordState = {}; susanReadingState = {}; susanGameState = []; susanChallengeStars = 0; susanWrite(SUSAN_WORD_KEY, susanWordState); susanWrite(SUSAN_READING_KEY, susanReadingState); susanWrite(SUSAN_GAME_KEY, susanGameState); localStorage.setItem(SUSAN_CHALLENGE_KEY, "0"); renderIntegrationViews(); susanToast("本功能数据已清空"); }
  if (event.target.closest("[data-toggle-sheet]")) { queueMicrotask(() => { renderTodayIntegration(); renderChallengeIntegration(); renderParentIntegration(); }); }
});

renderIntegrationViews();
showView("today");
