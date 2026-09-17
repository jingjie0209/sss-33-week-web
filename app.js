const { weeks, songs, detailRows } = window.SSS_WEB_DATA;
const STORAGE_KEY = "sss-33-week-progress-v1";
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const checkinState = JSON.parse(localStorage.getItem("susan-checkin-progress-v1") || "{}");
const patternState = JSON.parse(localStorage.getItem("sss-pattern-progress-v1") || "{}");
const posyPipEdits = JSON.parse(localStorage.getItem("posy-pip-card-edits-v1") || "{}");
let posyPipAudio = null;
const parentSpeechEdits = JSON.parse(localStorage.getItem("parent-speech-edits-v1") || "{}");
let parentSpeechCategory = "全部";
const cardCategoryFilters = { noun: "全部", verb: "全部", adjective: "全部" };
const songBySheet = new Map(songs.map((song) => [song.sheet, song]));
let previousView = "checkin";
let randomSentenceDifficulty = Number(localStorage.getItem("sss-random-sentence-difficulty-v1") || 4);
let randomSentenceMode = localStorage.getItem("sss-random-sentence-mode-v1") || "all";
let randomSentenceCurrent = JSON.parse(localStorage.getItem("sss-random-sentence-current-v1") || "null");
let randomSentenceSaved = JSON.parse(localStorage.getItem("sss-random-sentence-saved-v1") || "[]") || [];
let weeklyPlanWeek = 1;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const THEME_GROUPS = {
  "社交与表达": ["问候与告别", "喜欢与友谊", "情绪与表达", "提问与表达"],
  "动作与指令": ["动作启蒙", "身体与动作", "跟随指令", "动作与能力", "躲藏与观察", "课堂习惯"],
  "基础认知": ["颜色认知", "形状与字母"],
  "动物世界": ["动物启蒙", "森林动物", "昆虫观察", "海洋动物", "动物与数数"],
  "数字与数量": ["身体与数数", "数字与数量"],
  "食物与饮食": ["食物喜好", "食物与饥饿", "食物与经典童谣"],
  "生活习惯": ["清洁与如厕", "穿衣与睡眠"],
  "交通工具": ["交通工具"],
  "天气与自然": ["天气与自然"],
  "经典童谣": ["经典童谣一", "经典童谣二", "韵律歌曲"],
  "圣诞节": ["圣诞韵律", "圣诞老人", "圣诞主题"],
  "万圣节与冬季": ["万圣节与冬季"],
};
const themeCategory = (theme) => Object.entries(THEME_GROUPS).find(([, themes]) => themes.includes(theme))?.[0] || theme || "未分类";
const fuzzyMatch = (text, query) => {
  const source = normalize(text);
  const target = normalize(query);
  if (!target || source.includes(target)) return true;
  let index = 0;
  for (const char of source) if (char === target[index]) index += 1;
  return index === target.length;
};
const cardCategory = (type, number) => window.SUSAN_CARD_CATEGORIES?.[type]?.[number] || "其他";
const cardCheckinId = (type) => `${type}-checkin`;
const cardIsMastered = (type, number) => Boolean(checkinState[`${cardCheckinId(type)}:${number}`]);
const cardCategoryCounts = (type, cards) => {
  const counts = new Map();
  cards.forEach((card) => {
    const category = cardCategory(type, card.number);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return [...counts.entries()];
};
const cardCategoryFiltersHtml = (type, cards) => {
  const active = cardCategoryFilters[type] || "全部";
  const categories = [["全部", cards.length], ["已掌握", cards.filter((card) => cardIsMastered(type, card.number)).length], ...cardCategoryCounts(type, cards)];
  return `<div class="card-category-filters" id="${type}-card-categories" aria-label="${type === "noun" ? "名词" : type === "verb" ? "动词" : "形容词"}分类">${categories.map(([label, count]) => `<button class="card-category-pill${active === label ? " active" : ""}" data-card-category-type="${type}" data-card-category="${escapeHtml(label)}">${escapeHtml(label)} <span>${count}</span></button>`).join("")}</div>`;
};
const cardMatchesCategory = (type, card) => {
  const active = cardCategoryFilters[type] || "全部";
  return active === "全部" || (active === "已掌握" ? cardIsMastered(type, card.number) : cardCategory(type, card.number) === active);
};
const randomWord = (items, key) => {
  const item = items[Math.floor(Math.random() * items.length)];
  return { value: String(item?.[key] || "").split(/\s|[\\(\\|]/)[0].replace(/[.,!?]+$/, "").toLowerCase(), number: item?.number || 0 };
};
const randomSentenceCandidates = (difficulty) => {
  const nouns = window.SSS_NOUN_CARDS || [];
  const verbs = window.SUSAN_VERB_CARDS || [];
  const adjectives = window.SUSAN_ADJECTIVE_CARDS || [];
  const patterns = window.SSS_PATTERN_LIBRARY || [];
  const noun = () => randomWord(nouns, "name");
  const verb = () => randomWord(verbs, "word");
  const adjective = () => randomWord(adjectives, "name");
  const article = (word) => /^[aeiou]/i.test(word) ? "an" : "a";
  if (difficulty === 1) {
    const n = noun(); const a = adjective();
    return { sentence: `It's ${article(a.value)} ${a.value} ${n.value}.`, translation: `这是一个${a.value}的${n.value}。`, refs: [["名词卡", 6], ["形容词卡", 4]] };
  }
  if (difficulty === 2) {
    const n = noun(); const v = verb();
    return { sentence: `The ${n.value} can ${v.value}.`, translation: `${n.value}会${v.value}。`, refs: [["名词卡", 10], ["动词卡", 8]] };
  }
  if (difficulty === 3) {
    const n = noun(); const a = adjective(); const v = verb();
    return { sentence: `The ${a.value} ${n.value} can ${v.value}.`, translation: `这个${a.value}的${n.value}会${v.value}。`, refs: [["名词卡", 10], ["形容词卡", 4], ["动词卡", 8]] };
  }
  const available = patterns.filter((item) => item.example && (randomSentenceMode !== "mastered" || patternDone(item.type, item.number)));
  const item = available[Math.floor(Math.random() * available.length)] || patterns.find((entry) => entry.example) || {};
  const sentence = cleanExample(String(item.example || item.pattern || "Let's learn English together.")).split(/\n/)[0].trim();
  return { sentence, translation: "跟着句型一起说一遍。", refs: item.type && item.number ? [[item.type, item.number]] : [] };
};
const cleanExample = (value) => String(value ?? "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !/^[\p{Script=Han}\s]+$/u.test(line))
  .join("\n");
const currentStatus = (song) => {
  const saved = state[song.sheet];
  return (typeof saved === "object" ? saved?.status : saved) ?? song.defaultStatus ?? "待打卡";
};
const isDone = (song) => currentStatus(song) === "已完成";
const statusBadge = (status) => `<span class="status ${status === "已完成" ? "done" : "pending"}">${escapeHtml(status)}</span>`;
const patternKey = (type, number) => `${type}:${number}`;
const patternDone = (type, number) => Boolean(patternState[patternKey(type, number)]);
const patternStatus = (type, number) => patternDone(type, number) ? "已完成" : "待打卡";
const patternToggle = (type, number) => `<button class="status-button" data-toggle-pattern="${escapeHtml(patternKey(type, number))}">${statusBadge(patternStatus(type, number))}</button>`;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderSidebarProgress();
}

function renderSusanCheckin(viewId) {
  const list = (window.SUSAN_CHECKIN_DATA?.lists || []).find((item) => item.id === viewId);
  const root = document.getElementById(`${viewId}-view`);
  if (!list || !root) return;
  const done = list.items.filter((item) => checkinState[`${viewId}:${item.number}`]).length;
  root.innerHTML = `<button class="back-button" data-back-noun-cards>← 返回名词卡</button><div class="page-head"><div><h1>${escapeHtml(list.title)}</h1></div><div class="summary"><div class="metric"><span>完成进度</span><strong>${done}/${list.items.length}</strong></div></div></div><section class="module"><div class="module-head"><h2>${escapeHtml(list.label)}</h2><span>点击“完成”记录打卡</span></div><div class="record-table-wrap"><table class="record-table susan-checkin-table"><thead><tr><th>序号</th><th>词汇 / 内容</th><th>是否完成</th><th>操作</th></tr></thead><tbody>${list.items.map((item) => { const key = `${viewId}:${item.number}`; const complete = Boolean(checkinState[key]); return `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.word)}</strong></td><td>${statusBadge(complete ? "已完成" : "待打卡")}</td><td><button class="tiny-action" data-toggle-checkin="${escapeHtml(key)}">${complete ? "取消完成" : "完成"}</button></td></tr>`; }).join("")}</tbody></table></div></section>`;
}

function renderSidebarProgress() {
  const done = songs.filter(isDone).length;
  $("#sidebar-progress-value").textContent = `${done}/${songs.length}`;
  $("#sidebar-progress-bar").style.width = `${(done / songs.length) * 100}%`;
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  document.body.classList.remove("menu-open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function youtubeThumbnail(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : "";
}

function youtubeWatchUrl(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://youtu.be/${match[1]}` : String(url || "");
}

function toggleSong(sheet) {
  const song = songBySheet.get(sheet);
  if (!song) return;
  state[sheet] = isDone(song) ? { status: "待打卡", completedAt: "" } : { status: "已完成", completedAt: new Date().toISOString() };
  saveState();
  renderCheckin();
  renderDetails();
  renderPatterns();
  renderRecords();
  if ($("#song-view").classList.contains("active")) renderSong(sheet);
}

function renderCheckin() {
  const themes = Object.keys(THEME_GROUPS);
  const doneCount = songs.filter(isDone).length;
  $("#checkin-view").innerHTML = `
    <div class="page-head">
      <div><h1>33周SSS儿歌计划表</h1><p>每周 3 首，按主题循序推进；点击歌名进入完整拆解。</p></div>
      <div class="summary"><div class="metric"><span>计划周数</span><strong>33</strong></div><div class="metric"><span>已完成歌曲</span><strong>${doneCount}/${songs.length}</strong></div></div>
    </div>
    <div class="filters">
      <div class="field"><label for="week-theme">主题</label><select id="week-theme" class="control"><option value="">全部主题</option>${themes.map((theme) => `<option>${escapeHtml(theme)}</option>`).join("")}</select></div>
      <div class="field"><label for="week-song-search">儿歌名称</label><input id="week-song-search" class="control" type="search" placeholder="输入部分歌名，支持模糊搜索"></div>
    </div>
    <p id="week-result-note" class="result-note"></p><div id="week-list" class="week-list"></div>`;

  const draw = () => {
    const theme = $("#week-theme").value;
    const query = $("#week-song-search").value;
    const filtered = weeks
      .filter((week) => !theme || themeCategory(week.theme) === theme)
      .map((week) => ({ ...week, visibleSongs: week.songs.map((item) => !query || fuzzyMatch(item.title, query)) }))
      .filter((week) => week.visibleSongs.some(Boolean));
    const visibleCount = filtered.reduce((sum, week) => sum + week.visibleSongs.filter(Boolean).length, 0);
    $("#week-result-note").textContent = `显示 ${filtered.length} 个周计划，共 ${visibleCount} 首匹配儿歌`;
    $("#week-list").innerHTML = filtered.length ? filtered.map((week) => {
      const done = week.songs.filter((item) => isDone(songBySheet.get(item.sheet))).length;
      return `<article class="week-row">
        <div class="week-cell week-label"><strong>${escapeHtml(week.label)}</strong></div>
        <div class="week-cell theme-label">${escapeHtml(themeCategory(week.theme))}</div>
        ${week.songs.map((item, index) => {
          if (!week.visibleSongs[index]) return `<div class="week-cell"></div>`;
          const song = songBySheet.get(item.sheet);
          const status = song ? currentStatus(song) : item.status;
          return `<div class="week-cell"><button class="song-button" data-song-sheet="${escapeHtml(item.sheet)}">${escapeHtml(item.title)}</button><div class="song-meta">${statusBadge(status)}<button class="tiny-action" data-toggle-sheet="${escapeHtml(item.sheet)}">${status === "已完成" ? "取消" : "完成"}</button></div></div>`;
        }).join("")}
        <div class="week-cell progress-cell"><strong>${done}/3</strong><span>本周</span></div>
      </article>`;
    }).join("") : `<div class="empty">没有匹配的周计划</div>`;
  };
  $("#week-theme").onchange = draw;
  $("#week-song-search").oninput = draw;
  draw();
}

function renderDetails() {
  const patterns = [...new Set(detailRows.map((row) => row.pattern).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  const categories = Object.keys(THEME_GROUPS);
  $("#details-view").innerHTML = `
    <div class="page-head"><div><h1>SSS儿歌和句型对应表</h1><p>查看每首歌匹配的基础句型、详细句型和主题分类。</p></div><div class="summary"><div class="metric"><span>儿歌</span><strong>${songs.length}</strong></div><div class="metric"><span>匹配记录</span><strong>${detailRows.length}</strong></div></div></div>
    <div class="filters four">
      <div class="field"><label for="detail-song-search">儿歌名称</label><input id="detail-song-search" class="control" type="search" placeholder="模糊搜索儿歌名称"></div>
      <div class="field"><label for="detail-category">主题分类</label><select id="detail-category" class="control"><option value="">全部主题分类</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></div>
      <div class="field"><label for="detail-pattern">基础句型</label><select id="detail-pattern" class="control"><option value="">全部基础句型</option>${patterns.map((pattern) => `<option value="${escapeHtml(pattern)}">${escapeHtml(pattern)}</option>`).join("")}</select></div>
      <div class="field"><label for="detail-status">打卡状态</label><select id="detail-status" class="control"><option value="">全部状态</option><option>待打卡</option><option>已完成</option></select></div>
    </div>
    <p id="detail-result-note" class="result-note"></p><div id="detail-results"></div>`;

  const draw = () => {
    const query = $("#detail-song-search").value;
    const category = $("#detail-category").value;
    const pattern = $("#detail-pattern").value;
    const status = $("#detail-status").value;
    const filtered = detailRows.filter((row) => {
      const song = songBySheet.get(row.sheet);
      const songStatus = song ? currentStatus(song) : row.songStatus;
      return (!query || fuzzyMatch(row.songTitle, query)) && (!category || themeCategory(song?.theme) === category) && (!pattern || row.pattern === pattern) && (!status || songStatus === status);
    });
    $("#detail-result-note").textContent = `找到 ${filtered.length} 条匹配记录`;
    $("#detail-results").innerHTML = filtered.length ? `<div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>类型</th><th>基础句型</th><th>详细句型</th><th>儿歌名称</th><th>主题分类</th></tr></thead><tbody>${filtered.map((row) => {
      const song = songBySheet.get(row.sheet);
      const nounNumber = row.type === "名词卡" ? Number(String(row.pattern || "").match(/(\d+)\s*\./)?.[1]) : 0;
      const patternCell = nounNumber ? `<button class="pattern-detail-link" data-noun-pattern="${nounNumber}">${escapeHtml(row.pattern)}</button>` : escapeHtml(row.pattern);
      return `<tr><td><span class="type-tag">${escapeHtml(row.type)}</span></td><td>${patternCell}</td><td class="multiline">${escapeHtml(cleanExample(row.example))}</td><td><button class="song-button" data-song-sheet="${escapeHtml(row.sheet)}">${escapeHtml(row.songTitle)}</button></td><td>${escapeHtml(themeCategory(song?.theme) || row.category)}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<div class="empty">没有符合条件的歌曲明细</div>`;
  };
  $("#detail-song-search").oninput = draw;
  $("#detail-category").onchange = draw;
  $("#detail-pattern").onchange = draw;
  $("#detail-status").onchange = draw;
  draw();
}

function renderPatterns() {
  const library = window.SSS_PATTERN_LIBRARY || [];
  const matchedSongs = new Map();
  detailRows.forEach((row) => {
    const number = Number(String(row.pattern || "").match(/(\d+)\s*\./)?.[1]);
    if (!number) return;
    const key = `${row.type}:${number}`;
    if (!matchedSongs.has(key)) matchedSongs.set(key, new Set());
    matchedSongs.get(key).add(row.sheet);
  });
  const patterns = library.map((item) => ({
    ...item,
    songs: [...(matchedSongs.get(`${item.type}:${item.number}`) || [])].map((sheet) => songBySheet.get(sheet)).filter(Boolean),
  }));
  const types = ["名词卡", "动词卡", "形容词卡"];
  const typeCount = (type) => patterns.filter((item) => item.type === type).length;

  $("#patterns-view").innerHTML = `
    <div class="page-head"><div><h1>核心句型</h1><p>按句型查看例句、匹配歌曲和学习进度。</p></div></div>
    <section class="pattern-summary"><div class="pattern-total"><span>总计 · 句型总数</span><strong>${patterns.length}</strong></div><div class="pattern-equals">=</div>${types.map((type) => `<div class="pattern-breakdown"><span>${escapeHtml(type.replace("卡", "句型"))}</span><strong>${typeCount(type)}</strong></div>`).join("")}</section>
    <div class="pattern-toolbar"><div class="pattern-tabs" role="tablist" aria-label="句型类型"><button class="pattern-tab active" data-pattern-type="">全部</button>${types.map((type) => `<button class="pattern-tab" data-pattern-type="${escapeHtml(type)}">${escapeHtml(type.replace("卡", ""))}</button>`).join("")}</div><div class="pattern-search-field"><label for="pattern-search">句型名称</label><input id="pattern-search" class="control" type="search" placeholder="模糊搜索句型名称"></div></div>
    <p id="pattern-result-note" class="result-note"></p><div id="pattern-results" class="pattern-grid"></div>`;

  const draw = () => {
    const query = $("#pattern-search").value;
    const type = $(".pattern-tab.active")?.dataset.patternType || "";
    const filtered = patterns.filter((item) => {
      const searchText = `${item.code} ${item.pattern}`;
      return (!query || fuzzyMatch(searchText, query)) && (!type || item.type === type);
    });
    $("#pattern-result-note").textContent = `显示 ${filtered.length} 个核心句型`;
    $("#pattern-results").innerHTML = filtered.length ? filtered.map((item) => {
      const stateLabel = patternStatus(item.type, item.number);
      const typeLabel = item.type.replace("卡", "");
      const content = `<span class="pattern-code">${item.number}</span><span class="pattern-type-label ${item.type === "名词卡" ? "noun" : item.type === "动词卡" ? "verb" : "adjective"}">${escapeHtml(typeLabel)}</span><strong class="pattern-name">${escapeHtml(item.pattern)}</strong><span class="pattern-status ${stateLabel === "已完成" ? "done" : "pending"}">${stateLabel}</span>`;
      return item.type === "名词卡" ? `<button class="pattern-card clickable" data-noun-pattern="${item.number}">${content}</button>` : `<article class="pattern-card">${content}</article>`;
    }).join("") : `<div class="empty">没有符合条件的核心句型</div>`;
  };
  $("#pattern-search").oninput = draw;
  document.querySelectorAll(".pattern-tab").forEach((tab) => { tab.onclick = () => { document.querySelectorAll(".pattern-tab").forEach((item) => item.classList.remove("active")); tab.classList.add("active"); draw(); }; });
  draw();
}

function renderNounPattern(number) {
  const item = (window.SSS_NOUN_DETAILS || []).find((entry) => entry.number === Number(number));
  if (!item) return;
  const speakingImage = `assets/noun-speaking-cards/card-${String(item.number).padStart(2, "0")}.jpg`;
  const matchRows = detailRows.filter((row) => row.type === "名词卡" && Number(String(row.pattern || "").match(/(\d+)\s*\./)?.[1]) === item.number);
  const matched = [...new Set(matchRows.map((row) => row.sheet))].map((sheet) => songBySheet.get(sheet)).filter(Boolean);
  $("#noun-pattern-view").innerHTML = `
    <button class="back-button" data-back-patterns>← 返回核心句型</button>
    <section class="noun-pattern-head"><span>名词句型 · ${escapeHtml(item.code)}</span><h1>${escapeHtml(item.pattern)}</h1><p>原表句型变化与补充口语案例</p></section>
    <section class="module noun-forms"><div class="module-head"><h2>句型变化</h2><span>来源于原表</span></div><table class="content-table"><thead><tr><th class="form-label">句式</th><th>原表例句</th><th>是否完成</th></tr></thead><tbody>${item.forms.map((form) => `<tr><td class="form-label"><strong>${escapeHtml(form.label)}</strong></td><td class="multiline">${escapeHtml(form.value)}</td><td>${patternToggle("名词卡", item.number)}</td></tr>`).join("")}</tbody></table></section>
    <section class="module"><div class="module-head"><h2>开口神器提问卡</h2><span>第 ${item.number} 页</span></div><div class="speaking-detail"><img src="${speakingImage}" alt="${escapeHtml(item.pattern)} 开口神器提问卡"></div></section>
    <section class="module"><div class="module-head"><h2>补充口语案例</h2><span>扩展练习</span></div><ol class="extra-cases">${item.extraCases.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ol></section>
    <section class="module"><div class="module-head"><h2>匹配歌曲</h2><span>${matched.length} 首</span></div>${matched.length ? `<div class="noun-song-links">${matched.map((song) => `<button class="pattern-song-link" data-song-sheet="${escapeHtml(song.sheet)}">${escapeHtml(song.title)}</button>`).join("")}</div>` : `<div class="empty">当前还没有匹配歌曲</div>`}</section>`;
  showView("noun-pattern");
}

function renderNounCards() {
  const cards = window.SSS_NOUN_CARDS || [];
  const usableImage = (card) => Boolean(card.image);
  $("#noun-cards-view").innerHTML = `<div class="page-head"><div><h1>名词</h1></div><div class="summary"><div class="metric"><span>名词卡</span><strong>${cards.length}</strong></div></div></div><div class="noun-card-tabs" role="tablist"><button class="noun-card-tab active" data-noun-tab="cards">名词卡</button><button class="noun-card-tab" data-noun-tab="speaking">开口神器</button><button class="noun-card-tab" data-noun-tab="patterns">基础句型</button><button class="noun-card-tab" data-noun-tab="checkin">打卡表</button></div>${cardCategoryFiltersHtml("noun", cards)}<div class="filters noun-card-filters"><div class="field"><label for="noun-card-search">名词名称</label><input id="noun-card-search" class="control" type="search" placeholder="模糊搜索名词"></div></div><p id="noun-card-result" class="result-note"></p><div id="noun-card-grid" class="noun-card-grid"></div><div id="noun-tab-panel" class="noun-tab-panel"></div>`;
  const draw = () => {
    const query = $("#noun-card-search").value;
    const filtered = cards.filter((card) => cardMatchesCategory("noun", card) && (!query || fuzzyMatch(`${card.number} ${card.name}`, query)));
    $("#noun-card-result").textContent = `显示 ${filtered.length} 张名词卡`;
    $("#noun-card-grid").innerHTML = filtered.map((card) => `<button class="noun-card-tile" data-noun-card="${card.number}">${usableImage(card) ? `<img src="${card.image}" alt="${escapeHtml(card.name)}">` : `<span class="noun-card-placeholder"><strong>${escapeHtml(card.name)}</strong><small>图片缺失</small></span>`}<span><small>名词 ${card.number} · ${escapeHtml(cardCategory("noun", card.number))}</small><strong>${escapeHtml(card.name)}</strong></span></button>`).join("") || `<div class="empty">没有符合条件的名词卡</div>`;
  };
  $("#noun-card-search").oninput = draw;
  draw();
}

function renderNounTabPanel(tab) {
  const panel = $("#noun-tab-panel");
  if (!panel) return;
  [$("#noun-cards-view .noun-card-filters"), $("#noun-card-categories"), $("#noun-card-result"), $("#noun-card-grid")].forEach((element) => element?.classList.toggle("hidden", tab !== "cards"));
  document.querySelectorAll(".noun-card-tab").forEach((button) => button.classList.toggle("active", button.dataset.nounTab === tab));
  if (tab === "cards") { panel.innerHTML = ""; return; }
  if (tab === "speaking") {
    renderNounSpeakingPanel("core");
    return;
  }
  if (tab === "patterns") {
    const items = window.SSS_NOUN_DETAILS || [];
    panel.innerHTML = `<section class="module"><div class="module-head"><h2>基础句型</h2><span>${items.length} 条</span></div><table class="content-table"><thead><tr><th>序号</th><th>句型</th><th>完成状态</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.pattern)}</strong></td><td>${patternToggle("名词卡", item.number)}</td></tr>`).join("")}</tbody></table></section>`;
    return;
  }
  const list = (window.SUSAN_CHECKIN_DATA?.lists || []).find((item) => item.id === "noun-checkin");
  const done = list.items.filter((item) => checkinState[`noun-checkin:${item.number}`]).length;
  panel.innerHTML = `<section class="module"><div class="module-head"><h2>名词打卡表</h2><span>${done}/${list.items.length}</span></div><table class="record-table susan-checkin-table"><thead><tr><th>序号</th><th>词汇</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.items.map((item) => { const key = `noun-checkin:${item.number}`; const complete = Boolean(checkinState[key]); return `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.word)}</strong></td><td>${statusBadge(complete ? "已完成" : "待打卡")}</td><td><button class="tiny-action" data-toggle-checkin="${key}">${complete ? "取消完成" : "完成"}</button></td></tr>`; }).join("")}</tbody></table></section>`;
}

const NOUN_GUESS_TITLES = ["Duck", "Chick", "Pig", "Elephant", "Horse", "Donkey", "Fox", "Cat", "Owl", "Cow", "Sheep", "Rabbit", "Lion", "Tiger", "Panda", "Monkey", "Dog", "Deer", "Penguin", "Hen", "Banana", "Egg", "Fish", "Candy", "Grape", "Watermelon", "Hamburger", "Carrot", "Coconut", "Apple", "Potato", "Grass", "Flower", "Mouth", "Dress", "Freezer", "Clock", "Hand", "Sofa"];

function renderNounSpeakingPanel(mode = "core") {
  const panel = $("#noun-tab-panel");
  if (!panel) return;
  const modes = [
    { id: "core", label: "核心问答", count: 51 },
    { id: "guess", label: "描述猜词", count: 39 },
    { id: "true-false", label: "判断正误", count: 10 },
  ];
  let cards = [];
  if (mode === "core") {
    cards = (window.SSS_NOUN_DETAILS || []).map((item) => ({ number: item.number, title: item.pattern, image: `assets/noun-speaking-cards/card-${String(item.number).padStart(2, "0")}.jpg`, core: true }));
  } else {
    const start = mode === "guess" ? 52 : 91;
    const end = mode === "guess" ? 90 : 100;
    cards = Array.from({ length: end - start + 1 }, (_, index) => {
      const number = start + index;
      return { number, title: mode === "guess" ? NOUN_GUESS_TITLES[number - 52] : `判断正误 ${number}`, image: `assets/noun-speaking-advanced/card-${String(number).padStart(3, "0")}.jpg`, core: false };
    });
  }
  panel.innerHTML = `<div class="speaking-mode-tabs" role="tablist" aria-label="开口神器练习类型">${modes.map((item) => `<button class="noun-card-tab${item.id === mode ? " active" : ""}" role="tab" aria-selected="${item.id === mode}" data-speaking-mode="${item.id}">${item.label} <small>${item.count}</small></button>`).join("")}</div><p class="result-note">${mode === "core" ? "真实图片完整问答" : mode === "guess" ? "根据英文描述猜出对应单词" : "判断句子是否正确，并说出正确表达"}</p><div class="speaking-card-grid">${cards.map((item) => `<button class="speaking-card${item.core ? "" : " advanced"}" ${item.core ? `data-speaking-card="${item.number}"` : `data-advanced-speaking-card="${item.number}" data-speaking-mode="${mode}"`}><img src="${item.image}" alt="${escapeHtml(item.title)}"><span><small>${mode === "core" ? "核心句型" : mode === "guess" ? "描述猜词" : "判断正误"} ${item.number}</small><strong>${escapeHtml(item.title)}</strong></span></button>`).join("")}</div>`;
}

function renderAdvancedSpeakingCard(number, mode) {
  const value = Number(number);
  if (value < 52 || value > 100) return;
  const isGuess = value <= 90;
  const title = isGuess ? NOUN_GUESS_TITLES[value - 52] : `判断正误 ${value}`;
  const image = `assets/noun-speaking-advanced/card-${String(value).padStart(3, "0")}.jpg`;
  $("#noun-cards-view").innerHTML = `<button class="back-button" data-back-advanced-speaking="${escapeHtml(mode || (isGuess ? "guess" : "true-false"))}">← 返回开口神器</button><section class="noun-pattern-head"><span>${isGuess ? "描述猜词" : "判断正误"} · ${value}/100</span><h1>${escapeHtml(title)}</h1><p>${isGuess ? "先听描述，再说出对应的英文单词。" : "先判断句子是否正确，再完整说出正确表达。"}</p></section><section class="module"><div class="module-head"><h2>${isGuess ? "描述猜词练习" : "判断正误练习"}</h2><span>来源：《开口神器卡》</span></div><div class="speaking-detail advanced"><img src="${image}" alt="${escapeHtml(title)}"></div></section>`;
  showView("noun-cards");
}

function renderNounSpeakingCard(number) {
  const item = (window.SSS_NOUN_DETAILS || []).find((entry) => entry.number === Number(number));
  if (!item) return;
  const image = `assets/noun-speaking-cards/card-${String(item.number).padStart(2, "0")}.jpg`;
  $("#noun-cards-view").innerHTML = `<button class="back-button" data-back-speaking>← 返回开口神器</button><section class="noun-pattern-head"><span>开口神器 · 句型 ${item.number}</span><h1>${escapeHtml(item.pattern)}</h1></section><section class="module"><div class="module-head"><h2>实物图提问卡</h2><span>PDF 第 ${item.number} 页</span></div><div class="speaking-detail"><img src="${image}" alt="${escapeHtml(item.pattern)} 实物图提问卡"></div></section>`;
  showView("noun-cards");
}

function renderNounCard(number) {
  const card = (window.SSS_NOUN_CARDS || []).find((item) => item.number === Number(number));
  if (!card) return;
  const cardVisual = card.image ? `<img src="${card.image}" alt="${escapeHtml(card.name)}">` : `<div class="noun-card-placeholder large"><strong>${escapeHtml(card.name)}</strong><small>图片缺失</small></div>`;
  const lines = card.dialogue.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && line !== "亲子对话" && line !== "常速语境（名词复述）");
  const translations = card.dialogueTranslations || [];
  const lineRows = lines.map((line, index) => `<tr><td class="multiline">${escapeHtml(line)}</td><td class="multiline">${escapeHtml(translations[index] || "中文翻译待补充")}</td></tr>`).join("");
  const sourceExample = (word) => lines.find((line) => new RegExp(`\\b${String(word).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&\\\\b")}`, "i").test(line)) || "原文未提供包含该词的完整例句";
  const patternExample = (pattern) => {
    const tokens = String(pattern.name).toLowerCase().replace(/\.\.\.|\.\.\/|\(.*?\)/g, "").split(/[^a-z]+/).filter((token) => token.length > 2);
    return lines.find((line) => tokens.length && tokens.filter((token) => line.toLowerCase().includes(token)).length >= Math.min(2, tokens.length)) || "原文未提供可直接对应的例句";
  };
  const collocationZh = (value) => ({
    "use corn": "使用 corn（玉米）",
    "mimic a sound": "模仿声音",
    "swim in the lake": "在湖里游泳",
    "once upon a time": "从前；很久以前",
    "skinny legs": "细瘦的腿",
    "a feather on its back": "背上的一根羽毛",
    "lead the others": "带领其他人",
    "a feather on her back": "她背上的羽毛"
  }[value] || "飞书文档未提供该搭配的中文释义");
  $("#noun-cards-view").innerHTML = `<button class="back-button" data-back-cards>← 返回名词卡</button><section class="noun-card-hero">${cardVisual}<div><span>名词卡 ${card.number}</span><h1>${escapeHtml(card.name)}</h1></div></section><section class="module"><div class="module-head"><h2>亲子对话</h2><span>英文 / 中文逐行对照</span></div><div class="word-table-wrap"><table class="content-table dialogue-table"><thead><tr><th>英文原文</th><th>中文翻译</th></tr></thead><tbody>${lineRows || "<tr><td colspan=2>文档未提供对话文本</td></tr>"}</tbody></table></div></section><section class="module"><div class="module-head"><h2>生词</h2><span>${card.words.length} 个</span></div><div class="word-table-wrap"><table class="content-table word-table"><thead><tr><th>单词</th><th>音标</th><th>词义</th><th>固定搭配</th><th>搭配翻译</th><th>文档例句 / 中文翻译</th></tr></thead><tbody>${card.words.map((word) => `<tr><td><strong>${escapeHtml(word.word)}</strong></td><td>${escapeHtml(word.ipa)}</td><td>${escapeHtml(word.meaning)}</td><td>${escapeHtml(word.collocation)}</td><td>${escapeHtml(collocationZh(word.collocation))}</td><td>${word.sourceExample ? `<div>${escapeHtml(word.sourceExample)}</div><div>${escapeHtml(word.sourceTranslation || "飞书文档未提供中文翻译")}</div>` : escapeHtml(sourceExample(word.word))}</td></tr>`).join("") || "<tr><td colspan=6>文档未单列生词</td></tr>"}</tbody></table></div></section><section class="module"><div class="module-head"><h2>扩展句型</h2></div><ol class="noun-list">${card.patterns.map((pattern, index) => `<li><strong>句型${index + 1}：${escapeHtml(pattern.name)}</strong>${(pattern.examples || []).map((example, exampleIndex) => `<br><span>${escapeHtml(example)}</span>${(pattern.translations || [])[exampleIndex] ? `<br><small>${escapeHtml(pattern.translations[exampleIndex])}</small>` : ""}`).join("")}</li>`).join("") || "<li>文档未提供句型拓展</li>"}</ol></section>`;
  showView("noun-cards");
}

function renderZoomIn(card) {
  const zoom = window.SUSAN_CARD_ZOOM?.[String(card.word || "").split(" ")[0].toLowerCase()];
  if (!zoom) return "";
  return `<details class="zoom-in-details"><summary>${escapeHtml(zoom.title)}</summary><p class="zoom-in-intro">${escapeHtml(zoom.intro)}</p><div class="zoom-in-list">${zoom.rows.map((row) => `<div class="zoom-in-row"><strong>${escapeHtml(row.zh)}</strong><span><b>${escapeHtml(row.en)}</b>${escapeHtml(row.textZh)}<small>${escapeHtml(row.textEn)}</small></span></div>`).join("")}</div></details>`;
}

function renderRecords() {
  const checkinLists = window.SUSAN_CHECKIN_DATA?.lists || [];
  const checkinProgress = (id) => {
    const list = checkinLists.find((item) => item.id === id);
    const total = list?.items.length || 0;
    const done = list?.items.filter((item) => checkinState[`${id}:${item.number}`]).length || 0;
    return { total, done, pending: total - done, rate: total ? Math.round(done / total * 100) : 0, duration: "未记录" };
  };
  const songDone = songs.filter(isDone).length;
  const songStats = { total: songs.length, done: songDone, pending: songs.length - songDone, rate: songs.length ? Math.round(songDone / songs.length * 100) : 0, duration: "未记录" };
  const patternModules = [
    { label: "名词", ...checkinProgress("noun-checkin") },
    { label: "动词", ...checkinProgress("verb-checkin") },
    { label: "形容词", ...checkinProgress("adjective-checkin") },
    { label: "万物贴", ...checkinProgress("things-checkin") },
  ];
  const patternTotal = patternModules.reduce((sum, item) => sum + item.total, 0);
  const patternDoneTotal = patternModules.reduce((sum, item) => sum + item.done, 0);
  const patternTotals = { total: patternTotal, done: patternDoneTotal, pending: patternTotal - patternDoneTotal, rate: patternTotal ? Math.round(patternDoneTotal / patternTotal * 100) : 0, duration: "未记录" };
  const progressRow = (label, item) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${item.total}</td><td>${item.done}</td><td>${item.pending}</td><td>${item.duration}</td><td><div class="overview-rate"><div class="progress-track"><i style="width:${item.rate}%"></i></div><span>${item.rate}%</span></div></td></tr>`;

  $("#records-view").innerHTML = `
    <div class="page-head"><div><h1>整体进度表</h1></div></div>
    <section class="record-section progress-module"><div class="record-section-head"><div><span class="module-label">学习进度</span><h2>儿歌模块</h2></div></div><div class="record-table-wrap"><table class="record-table overview-table progress-overview-table"><thead><tr><th>模块</th><th>总计数量</th><th>完成数量</th><th>待打卡数量</th><th>用时</th><th>完成率</th></tr></thead><tbody>${progressRow("SSS儿歌", songStats)}</tbody></table></div></section>
    <section class="record-section progress-module"><div class="record-section-head"><div><span class="module-label">学习进度</span><h2>核心句型</h2></div></div><div class="record-table-wrap"><table class="record-table overview-table progress-overview-table"><thead><tr><th>分类</th><th>总计数量</th><th>完成数量</th><th>待打卡数量</th><th>用时</th><th>完成率</th></tr></thead><tbody>${patternModules.map((item) => progressRow(item.label, item)).join("")}</tbody><tfoot>${progressRow("合计", patternTotals)}</tfoot></table></div></section>`;
}

function renderRandomSentence() {
  const root = $("#random-sentence-view");
  if (!root) return;
  const difficulties = [
    [1, "名词 + 形容词", "最简"],
    [2, "名词 + 动词", "基础"],
    [3, "三词全组合", "进阶"],
    [4, "全部句型", "名词/动词/形容词混合"],
  ];
  if (!randomSentenceCurrent || typeof randomSentenceCurrent.sentence !== "string" || !Array.isArray(randomSentenceCurrent.refs)) randomSentenceCurrent = randomSentenceCandidates(randomSentenceDifficulty);
  const current = randomSentenceCurrent;
  const modeLabel = randomSentenceMode === "mastered" ? "只摇已掌握句型" : "全部句型";
  const sentenceIsMastered = current.refs.length > 0 && current.refs.every(([type, number]) => patternDone(type, number));
  root.innerHTML = `<div class="random-sentence-shell"><div class="random-sentence-head"><div><h1>⚄ 随机组句</h1><p>名词 × 动词 × 形容词</p></div><span class="random-sentence-note">${escapeHtml(modeLabel)}</span></div><div class="random-sentence-mode" role="tablist" aria-label="句型范围"><button class="random-choice${randomSentenceMode === "all" ? " active" : ""}" data-random-mode="all">⚄ 全部句型</button><button class="random-choice${randomSentenceMode === "mastered" ? " active" : ""}" data-random-mode="mastered">⭐ 只摇已掌握句型</button></div><section class="random-sentence-card"><div class="random-result"><strong>${escapeHtml(current.sentence)}</strong><span>${escapeHtml(current.translation)}</span></div><div class="random-source-list">${current.refs.map(([type, number]) => { const label = type === "名词卡" ? "名词" : type === "动词卡" ? "动词" : "形容词"; const source = (window.SSS_PATTERN_LIBRARY || []).find((item) => item.type === type && item.number === number); return `<div class="random-source"><span>${label}</span><strong>${escapeHtml(source?.pattern || `句型 ${number}`)}</strong><small>${patternDone(type, number) ? "已掌握" : "待掌握"}</small></div>`; }).join("") || `<div class="random-empty">当前范围暂无可用句型，请先完成句型打卡。</div>`}</div><button class="random-roll" data-random-roll>⚄ 摇一句</button><div class="random-actions"><button class="random-secondary" data-random-save>存进今日句库</button><button class="random-difficulty-trigger" data-random-difficulty>难度设置</button></div></section><section class="random-recent"><h2>最近存的句子 <span>（共 ${randomSentenceSaved.length} 句）</span></h2>${randomSentenceSaved.length ? randomSentenceSaved.slice(0, 10).map((item) => `<article><strong>${escapeHtml(item.sentence)}</strong><span>${escapeHtml(item.translation)} · ${escapeHtml(item.date || "刚刚")} · ${item.difficulty}级</span></article>`).join("") : `<div class="random-empty">还没有保存的句子</div>`}</section></div>`;
}

function rollRandomSentence() {
  randomSentenceCurrent = randomSentenceCandidates(randomSentenceDifficulty);
  localStorage.setItem("sss-random-sentence-current-v1", JSON.stringify(randomSentenceCurrent));
  renderRandomSentence();
}

function showRandomDifficulty() {
  const root = $("#random-sentence-view");
  if (!root) return;
  const existing = root.querySelector(".random-difficulty-panel");
  if (existing) { existing.remove(); return; }
  const panel = document.createElement("section");
  panel.className = "random-difficulty-panel";
  panel.innerHTML = `<h2>随机组句难度</h2><p>选择今天摇句的组合方式：</p>${[[1,"名词 + 形容词（最简）"],[2,"名词 + 动词"],[3,"三词全组合"],[4,"全部句型（名词/动词/形容词混合）"]].map(([value,label]) => `<button class="random-difficulty-option${value === randomSentenceDifficulty ? " active" : ""}" data-random-difficulty-value="${value}">${value} · ${label}</button>`).join("")}<h2>句型范围</h2><p>已掌握模式只从已打卡句型中抽取。</p><button class="random-secondary" data-random-difficulty-close>关闭</button>`;
  root.querySelector(".random-sentence-shell").append(panel);
}

function renderNounRepeat() {
  const items = window.SSS_NOUN_REPEAT || [];
  const root = $("#noun-repeat-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>名词复述</h1></div><div class="summary"><div class="metric"><span>复述主题</span><strong>${items.length}</strong></div></div></div><div class="filters noun-card-filters"><div class="field"><label for="noun-repeat-search">名词名称</label><input id="noun-repeat-search" class="control" type="search" placeholder="搜索名词或复述内容"></div></div><p id="noun-repeat-result" class="result-note"></p><div id="noun-repeat-grid" class="noun-repeat-grid"></div>`;
  const draw = () => {
    const query = $("#noun-repeat-search").value;
    const filtered = items.filter((item) => !query || fuzzyMatch(`${item.name} ${item.text}`, query));
    $("#noun-repeat-result").textContent = `显示 ${filtered.length} 个复述主题`;
    $("#noun-repeat-grid").innerHTML = filtered.map((item) => `<button class="noun-repeat-card" data-noun-repeat="${item.number}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)} 名词复述"><span><small>复述 ${item.number}</small><strong>${escapeHtml(item.name)}</strong></span></button>`).join("") || `<div class="empty">没有符合条件的名词复述内容</div>`;
  };
  $("#noun-repeat-search").oninput = draw;
  draw();
}

function renderNounRepeatDetail(number) {
  const items = window.SSS_NOUN_REPEAT || [];
  const item = items.find((entry) => entry.number === Number(number));
  if (!item) return;
  const previous = items.find((entry) => entry.number === item.number - 1);
  const next = items.find((entry) => entry.number === item.number + 1);
  $("#noun-repeat-view").innerHTML = `<button class="back-button" data-back-noun-repeat>← 返回名词复述</button><div class="parent-speech-detail-head"><div><span>名词复述 · ${item.number}/100</span><h1>${escapeHtml(item.name)}</h1></div><div class="parent-speech-pager">${previous ? `<button class="tiny-action" data-noun-repeat="${previous.number}">上一页</button>` : ""}${next ? `<button class="tiny-action" data-noun-repeat="${next.number}">下一页</button>` : ""}</div></div><section class="module parent-speech-page"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)} 名词复述页面"></section>`;
  showView("noun-repeat");
}

function renderAdditionalViews() {
  const labels = {"song-breakdown":"儿歌拆解", verbs:"动词", adjectives:"形容词", "content-pack":"内容包"};
  Object.entries(labels).forEach(([id, label]) => { const el = document.getElementById(`${id}-view`); if (el && !["verbs", "adjectives", "content-pack"].includes(id)) el.innerHTML = `<div class="page-head"><div><h1>${label}</h1><p>该内容模块已加入导航，后续可继续扩展学习资料。</p></div></div><div class="empty">暂无内容</div>`; });
  renderVerbCards();
  renderAdjectiveCards();
  renderContentPack();
  (window.SUSAN_CHECKIN_DATA?.lists || []).forEach((list) => renderSusanCheckin(list.id));
}

function renderContentPack() {
  const root = $("#content-pack-view");
  if (!root) return;
  const song = songBySheet.get("hello hello Can you clap yo 056");
  const nounNumbers = [51, 52, 53, 54, 50];
  const nouns = nounNumbers.map((number) => (window.SSS_NOUN_CARDS || []).find((item) => item.number === number)).filter(Boolean);
  const thumbnail = youtubeThumbnail(song?.videoUrl);
  const days = [
    ["第1天", "听儿歌", "完整听唱 2 遍，跟着挥手说 Hello。"],
    ["第2天", "认识名词", "学习 Hand、Feet，边指身体边说单词。"],
    ["第3天", "句型输入", "练习 Can I clap? 并用 Yes, you can. 回答。"],
    ["第4天", "动作练习", "学习 Leg、Arm，配合 clap、stretch、touch 做动作。"],
    ["第5天", "替换练习", "用 Can you clap / stretch / turn around? 轮流问答。"],
    ["第6天", "加入新词", "学习 Mouth，用 Can you say hello? 完成开口练习。"],
    ["第7天", "复习输出", "唱完整首儿歌，并独立说出 5 个名词和本周句型。"],
  ];
  root.innerHTML = `
    <div class="page-head"><div><span class="module-label">第 1 周 · 问候与告别</span><h1>第一周内容包</h1><p>围绕问候和身体动作完成听、说、唱、做。</p></div><div class="summary"><div class="metric"><span>本周内容</span><strong>1 + 1 + 5</strong></div></div></div>
    <section class="pack-overview" aria-label="第一周内容概览"><div><strong>1</strong><span>基础句型</span></div><div><strong>1</strong><span>首儿歌</span></div><div><strong>5</strong><span>个名词</span></div></section>
    <section class="module pack-pattern"><div class="module-head"><div><span class="module-label">基础句型</span><h2>Can I ...?</h2></div>${patternToggle("动词卡", 12)}</div><div class="pack-pattern-body"><div><span>示范问答</span><strong>Can I clap my hands?</strong><p>我可以拍拍手吗？</p></div><div><span>回答</span><strong>Yes, you can. / No, you can't.</strong><p>是的，你可以。/ 不，你不可以。</p></div><div><span>儿歌替换</span><strong>Can you clap your hands?</strong><p>你能拍拍手吗？</p></div></div></section>
    <section class="module"><div class="module-head"><div><span class="module-label">本周儿歌</span><h2>${escapeHtml(song?.title || "")}</h2></div>${statusBadge(currentStatus(song))}</div><button class="pack-song" data-song-sheet="${escapeHtml(song?.sheet || "")}">${thumbnail ? `<img src="${thumbnail}" alt="${escapeHtml(song?.title || "")} 视频封面">` : ""}<span><strong>打开儿歌详情</strong><small>Hello、clap、stretch、touch、turn around</small></span></button></section>
    <section class="module"><div class="module-head"><div><span class="module-label">本周名词</span><h2>身体动作词汇</h2></div><span>5 个</span></div><div class="pack-nouns">${nouns.map((card, index) => `<button data-noun-card="${card.number}">${card.image ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}">` : ""}<span><small>${index + 1}</small><strong>${escapeHtml(card.name)}</strong><em>${({Hand:"手", Feet:"脚", Leg:"腿", Arm:"手臂", Mouth:"嘴巴"})[card.name] || ""}</em></span></button>`).join("")}</div></section>
    <section class="module"><div class="module-head"><div><span class="module-label">学习安排</span><h2>7 天练习</h2></div><span>每天 10-15 分钟</span></div><div class="pack-days">${days.map(([day, title, task]) => `<div><span>${day}</span><strong>${title}</strong><p>${task}</p></div>`).join("")}</div></section>`;
}

function renderWeeklyPlan() {
  const root = $("#weekly-plan-view");
  if (!root) return;
  const week = weeks.find((item) => item.week === weeklyPlanWeek) || weeks[0];
  const weekSongs = (week?.songs || []).map((item) => songBySheet.get(item.sheet)).filter(Boolean);
  const pattern = (window.SSS_PATTERN_LIBRARY || []).find((item) => item.type === "名词卡" && item.number === 1) || {};
  const nounNames = { Chick: "小鸡", Duck: "鸭子", Lion: "狮子", Tiger: "老虎", Monkey: "猴子" };
  const nouns = (window.SSS_NOUN_CARDS || []).slice(0, 5);
  const articleFor = (name) => /^[aeiou]/i.test(String(name || "")) ? "an" : "a";
  const outputRows = nouns.map((noun) => ({
    noun,
    sentence: `It's ${articleFor(noun.name)} ${String(noun.name || "").toLowerCase()}.`,
  }));
  root.innerHTML = `
    <div class="page-head weekly-plan-head">
      <div><span class="module-label">输入 → 核心学习 → 输出</span><h1>周计划</h1><p>把本周的听、看、亲子互动和阅读，收束成可观察的英文输出。</p></div>
      <div class="weekly-week-picker"><label for="weekly-plan-week">选择周次</label><select id="weekly-plan-week" class="control">${weeks.map((item) => `<option value="${item.week}"${item.week === week.week ? " selected" : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.theme)}</option>`).join("")}</select></div>
    </div>
    <div class="weekly-plan-summary"><div><strong>${weekSongs.length}</strong><span>首儿歌输入</span></div><div><strong>1</strong><span>个核心句型</span></div><div><strong>${nouns.length}</strong><span>个名词输出</span></div></div>
    <div class="weekly-flow">
      <section class="module weekly-section weekly-input-section"><div class="module-head"><div><span class="module-label">INPUT</span><h2>输入端</h2></div><span>先听、看、互动、共读</span></div><div class="weekly-input-grid">
        <article class="weekly-input-item"><div class="weekly-input-icon">♪</div><div><h3>儿歌</h3><p>本周 ${weekSongs.length} 首，点击歌名进入歌曲拆解。</p><div class="weekly-song-list">${weekSongs.map((song) => `<button class="weekly-song-link" data-song-sheet="${escapeHtml(song.sheet)}"><span>${escapeHtml(song.title)}</span><small>${isDone(song) ? "已完成" : "待打卡"}</small></button>`).join("") || `<span class="empty">暂无儿歌</span>`}</div></div></article>
        <article class="weekly-input-item"><div class="weekly-input-icon">▶</div><div><h3>动画片</h3><p>用同主题动画做可理解输入。</p><div class="weekly-song-list">${weekSongs.map((song) => song.ukidsUrl ? `<a class="weekly-song-link" href="${escapeHtml(song.ukidsUrl)}" target="_blank" rel="noopener"><span>${escapeHtml(song.title)}</span><small>打开动画</small></a>` : "").join("") || `<span class="empty">暂无动画入口</span>`}</div></div></article>
        <article class="weekly-input-item"><div class="weekly-input-icon">口</div><div><h3>亲子口语</h3><p>围绕本周名词做 1 轮问答和跟读。</p><button class="button secondary" data-weekly-open-view="parent-speech">打开亲子口语</button></div></article>
        <article class="weekly-input-item"><div class="weekly-input-icon">书</div><div><h3>绘本</h3><p>从亲子阅读中选择 1 本，指图提问并复述。</p><button class="button secondary" data-weekly-open-view="reading">打开亲子阅读</button></div></article>
      </div></section>
      <section class="module weekly-section"><div class="module-head"><div><span class="module-label">CORE</span><h2>核心学习内容</h2></div><span>名词卡第 1 个</span></div><div class="weekly-core"><div class="weekly-pattern"><span>核心句型 · ${escapeHtml(pattern.code || "A1")}</span><strong>${escapeHtml(pattern.pattern || "It's a/an ...")}</strong><p>${escapeHtml(pattern.example || "What's this?")}</p>${patternToggle("名词卡", 1)}</div><div class="weekly-noun-grid">${nouns.map((noun, index) => `<button class="weekly-noun" data-noun-card="${noun.number}">${noun.image ? `<img src="${escapeHtml(noun.image)}" alt="${escapeHtml(noun.name)}">` : ""}<span><small>名词 ${index + 1}</small><strong>${escapeHtml(noun.name)}</strong><em>${escapeHtml(nounNames[noun.name] || "")}</em></span></button>`).join("")}</div></div></section>
      <section class="module weekly-section weekly-output-section"><div class="module-head"><div><span class="module-label">OUTPUT</span><h2>输出端</h2></div><span>句型 + 名词 · ${outputRows.length} 句</span></div><div class="weekly-output-list">${outputRows.map(({ noun, sentence }, index) => `<article class="weekly-output-row"><span class="weekly-output-number">${index + 1}</span><div><strong>${escapeHtml(sentence)}</strong><small>这是什么？这是${escapeHtml(nounNames[noun.name] || noun.name)}。</small></div><button class="tiny-action" data-weekly-speak="${escapeHtml(sentence)}">播放</button></article>`).join("")}</div></section>
    </div>`;
  const selector = $("#weekly-plan-week");
  if (selector) selector.onchange = () => { weeklyPlanWeek = Number(selector.value) || 1; renderWeeklyPlan(); };
}

function renderVerbCards() {
  const cards = window.SUSAN_VERB_CARDS || [];
  const root = $("#verbs-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>动词</h1></div><div class="summary"><div class="metric"><span>动词卡</span><strong>${cards.length}</strong></div></div></div><div class="noun-card-tabs" role="tablist"><button class="noun-card-tab active" data-verb-tab="cards">动词卡</button><button class="noun-card-tab" data-verb-tab="speaking">开口神器</button><button class="noun-card-tab" data-verb-tab="patterns">基础句型</button><button class="noun-card-tab" data-verb-tab="checkin">打卡表</button></div>${cardCategoryFiltersHtml("verb", cards)}<div class="filters noun-card-filters"><div class="field"><label for="verb-card-search">动词名称</label><input id="verb-card-search" class="control" type="search" placeholder="模糊搜索动词"></div></div><p id="verb-card-result" class="result-note"></p><div id="verb-card-grid" class="verb-card-grid"></div><div id="verb-tab-panel" class="noun-tab-panel"></div>`;
  const draw = () => {
    const query = $("#verb-card-search").value;
    const filtered = cards.filter((card) => cardMatchesCategory("verb", card) && (!query || fuzzyMatch(`${card.number} ${card.word} ${card.text}`, query)));
    $("#verb-card-result").textContent = `显示 ${filtered.length} 张动词卡`;
    $("#verb-card-grid").innerHTML = filtered.map((card) => `<article class="verb-card"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.word)} 动词卡"><div class="verb-card-body"><small>动词 ${card.number} · ${escapeHtml(cardCategory("verb", card.number))}</small><h2>${escapeHtml(card.word)}</h2><details><summary>查看教学文本</summary><p>${escapeHtml(card.text)}</p></details>${renderZoomIn(card)}</div></article>`).join("") || `<div class="empty">没有符合条件的动词卡</div>`;
  };
  $("#verb-card-search").oninput = draw;
  draw();
}

function renderVerbTabPanel(tab) {
  const panel = $("#verb-tab-panel");
  if (!panel) return;
  [$("#verbs-view .noun-card-filters"), $("#verb-card-categories"), $("#verb-card-result"), $("#verb-card-grid")].forEach((element) => element?.classList.toggle("hidden", tab !== "cards"));
  document.querySelectorAll("[data-verb-tab]").forEach((button) => button.classList.toggle("active", button.dataset.verbTab === tab));
  if (tab === "cards") { panel.innerHTML = ""; return; }
  if (tab === "speaking") {
    const items = (window.SSS_PATTERN_LIBRARY || []).filter((item) => item.type === "动词卡" && item.number <= 60);
    panel.innerHTML = `<p class="result-note">显示 ${items.length} 张动词开口神器</p><div class="speaking-card-grid verb-speaking-grid">${items.map((item) => `<button class="speaking-card advanced" data-verb-speaking-card="${item.number}"><img src="assets/verb-speaking-cards/card-${String(item.number).padStart(2, "0")}.jpg" alt="${escapeHtml(item.pattern)} 动词开口神器"><span><small>动词句型 ${item.number}</small><strong>${escapeHtml(item.pattern)}</strong></span></button>`).join("")}</div>`;
    return;
  }
  if (tab === "patterns") {
    const items = (window.SSS_PATTERN_LIBRARY || []).filter((item) => item.type === "动词卡");
    panel.innerHTML = `<section class="module"><div class="module-head"><h2>基础句型</h2><span>${items.length} 条</span></div><table class="content-table"><thead><tr><th>序号</th><th>句型</th><th>完成状态</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.pattern)}</strong></td><td>${patternToggle(item.type, item.number)}</td></tr>`).join("")}</tbody></table></section>`;
    return;
  }
  const list = (window.SUSAN_CHECKIN_DATA?.lists || []).find((item) => item.id === "verb-checkin");
  const done = list.items.filter((item) => checkinState[`verb-checkin:${item.number}`]).length;
  panel.innerHTML = `<section class="module"><div class="module-head"><h2>动词打卡表</h2><span>${done}/${list.items.length}</span></div><table class="record-table susan-checkin-table"><thead><tr><th>序号</th><th>词汇</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.items.map((item) => { const key = `verb-checkin:${item.number}`; const complete = Boolean(checkinState[key]); return `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.word)}</strong></td><td>${statusBadge(complete ? "已完成" : "待打卡")}</td><td><button class="tiny-action" data-toggle-checkin="${key}">${complete ? "取消完成" : "完成"}</button></td></tr>`; }).join("")}</tbody></table></section>`;
}

function renderVerbSpeakingCard(number) {
  const value = Number(number);
  const item = (window.SSS_PATTERN_LIBRARY || []).find((entry) => entry.type === "动词卡" && entry.number === value);
  if (!item || value > 60) return;
  const previous = value > 1 ? value - 1 : 0;
  const next = value < 60 ? value + 1 : 0;
  const image = `assets/verb-speaking-cards/card-${String(value).padStart(2, "0")}.jpg`;
  $("#verbs-view").innerHTML = `<button class="back-button" data-back-verb-speaking>← 返回动词开口神器</button><div class="parent-speech-detail-head"><section class="noun-pattern-head verb-speaking-head"><span>动词开口神器 · ${value}/60</span><h1>${escapeHtml(item.pattern)}</h1><p>${escapeHtml(item.example || "")}</p></section><div class="parent-speech-pager">${previous ? `<button class="tiny-action" data-verb-speaking-card="${previous}">上一张</button>` : ""}${next ? `<button class="tiny-action" data-verb-speaking-card="${next}">下一张</button>` : ""}</div></div><section class="module"><div class="module-head"><h2>动词句型练习</h2><span>PDF 编号 ${value}</span></div><div class="speaking-detail advanced"><img src="${image}" alt="${escapeHtml(item.pattern)} 动词开口神器"></div></section>`;
  showView("verbs");
}

function renderAdjectiveCards() {
  const cards = window.SUSAN_ADJECTIVE_CARDS || [];
  const root = $("#adjectives-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>形容词</h1></div><div class="summary"><div class="metric"><span>形容词卡</span><strong>${cards.length}</strong></div></div></div><div class="noun-card-tabs" role="tablist"><button class="noun-card-tab active" data-adjective-tab="cards">形容词卡</button><button class="noun-card-tab" data-adjective-tab="patterns">基础句型</button><button class="noun-card-tab" data-adjective-tab="checkin">打卡表</button></div>${cardCategoryFiltersHtml("adjective", cards)}<div class="filters noun-card-filters"><div class="field"><label for="adjective-card-search">形容词名称</label><input id="adjective-card-search" class="control" type="search" placeholder="模糊搜索形容词"></div></div><p id="adjective-card-result" class="result-note"></p><div id="adjective-card-grid" class="noun-card-grid"></div><div id="adjective-tab-panel" class="noun-tab-panel"></div>`;
  const draw = () => {
    const query = $("#adjective-card-search").value;
    const filtered = cards.filter((card) => cardMatchesCategory("adjective", card) && (!query || fuzzyMatch(`${card.number} ${card.name} ${card.examples.join(" ")}`, query)));
    $("#adjective-card-result").textContent = `显示 ${filtered.length} 张形容词卡`;
    $("#adjective-card-grid").innerHTML = filtered.map((card) => `<button class="noun-card-tile" data-adjective-card="${card.number}"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)} 形容词卡"><span><small>形容词 ${card.number} · ${escapeHtml(cardCategory("adjective", card.number))}</small><strong>${escapeHtml(card.name)}</strong></span></button>`).join("") || `<div class="empty">没有符合条件的形容词卡</div>`;
  };
  $("#adjective-card-search").oninput = draw;
  draw();
}

function renderAdjectiveTabPanel(tab) {
  const panel = $("#adjective-tab-panel");
  if (!panel) return;
  [$("#adjectives-view .noun-card-filters"), $("#adjective-card-categories"), $("#adjective-card-result"), $("#adjective-card-grid")].forEach((element) => element?.classList.toggle("hidden", tab !== "cards"));
  document.querySelectorAll("[data-adjective-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adjectiveTab === tab));
  if (tab === "cards") { panel.innerHTML = ""; return; }
  if (tab === "patterns") {
    const items = (window.SSS_PATTERN_LIBRARY || []).filter((item) => item.type === "形容词卡");
    panel.innerHTML = `<section class="module"><div class="module-head"><h2>基础句型</h2><span>${items.length} 条</span></div><table class="content-table"><thead><tr><th>序号</th><th>句型</th><th>完成状态</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.pattern)}</strong></td><td>${patternToggle(item.type, item.number)}</td></tr>`).join("")}</tbody></table></section>`;
    return;
  }
  const list = (window.SUSAN_CHECKIN_DATA?.lists || []).find((item) => item.id === "adjective-checkin");
  if (!list) { panel.innerHTML = `<div class="empty">暂无打卡表数据</div>`; return; }
  const done = list.items.filter((item) => checkinState[`adjective-checkin:${item.number}`]).length;
  panel.innerHTML = `<section class="module"><div class="module-head"><h2>形容词打卡表</h2><span>${done}/${list.items.length}</span></div><table class="record-table susan-checkin-table"><thead><tr><th>序号</th><th>词汇</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.items.map((item) => { const key = `adjective-checkin:${item.number}`; const complete = Boolean(checkinState[key]); return `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.word)}</strong></td><td>${statusBadge(complete ? "已完成" : "待打卡")}</td><td><button class="tiny-action" data-toggle-checkin="${key}">${complete ? "取消完成" : "完成"}</button></td></tr>`; }).join("")}</tbody></table></section>`;
}

function renderAdjectiveCard(number) {
  const card = (window.SUSAN_ADJECTIVE_CARDS || []).find((item) => item.number === Number(number));
  if (!card) return;
  const examples = card.examples.filter((line) => /[A-Za-z]{2}/.test(line));
  $("#adjectives-view").innerHTML = `<button class="back-button" data-back-adjectives>← 返回形容词卡</button><section class="noun-card-hero"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)} 形容词卡"><div><span>形容词 ${card.number}</span><h1>${escapeHtml(card.name)}</h1></div></section><section class="module"><div class="module-head"><h2>卡片例句</h2><span>${examples.length} 句 · 英中对照</span></div><ol class="extra-cases adjective-examples">${examples.map((line, index) => `<li><strong>${escapeHtml(line)}</strong><span>${escapeHtml((card.translations || [])[index] || "")}</span></li>`).join("")}</ol></section>`;
  showView("adjectives");
}

function renderThingsCards() {
  const cards = window.SSS_THINGS_CARDS || [];
  const metaByNumber = new Map((window.SSS_THINGS_META || []).map((item) => [item.number, item]));
  const root = $("#things-cards-view");
  if (!root) return;
  root.innerHTML = `<div class="page-head"><div><h1>万物贴</h1></div><div class="summary"><div class="metric"><span>万物贴</span><strong>${cards.length}</strong></div></div></div><div class="noun-card-tabs" role="tablist"><button class="noun-card-tab active" data-things-tab="cards">万物贴</button><button class="noun-card-tab" data-things-tab="dialogues">亲子对话</button><button class="noun-card-tab" data-things-tab="checkin">打卡表</button></div><div class="filters noun-card-filters"><div class="field"><label for="things-card-search">单词名称</label><input id="things-card-search" class="control" type="search" placeholder="模糊搜索单词"></div></div><p id="things-card-result" class="result-note"></p><div id="things-card-grid" class="noun-card-grid"></div><div id="things-tab-panel" class="noun-tab-panel"></div>`;
  const draw = () => {
    const query = $("#things-card-search").value;
    const filtered = cards.filter((card) => !query || fuzzyMatch(card.word, query));
    $("#things-card-result").textContent = `显示 ${filtered.length} 张万物贴`;
    $("#things-card-grid").innerHTML = filtered.map((card) => { const meta = metaByNumber.get(card.number) || {}; return `<button class="noun-card-tile things-card-tile" data-things-card="${card.number}"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.word)} 万物贴"><span><small>万物贴 ${card.number}</small><strong>${escapeHtml(card.word)}</strong><em class="things-card-ipa">${escapeHtml(meta.ipa || "")}</em><em class="things-card-chinese">${escapeHtml(meta.chinese || "")}</em></span></button>`; }).join("") || `<div class="empty">没有符合条件的万物贴</div>`;
  };
  $("#things-card-search").oninput = draw;
  draw();
}

function renderThingsTabPanel(tab) {
  const panel = $("#things-tab-panel");
  if (!panel) return;
  [$("#things-cards-view .noun-card-filters"), $("#things-card-result"), $("#things-card-grid")].forEach((element) => element?.classList.toggle("hidden", tab !== "cards"));
  document.querySelectorAll("[data-things-tab]").forEach((button) => button.classList.toggle("active", button.dataset.thingsTab === tab));
  if (tab === "cards") { panel.innerHTML = ""; return; }
  if (tab === "dialogues") {
    const cards = window.SSS_THINGS_CARDS || [];
    panel.innerHTML = `<section class="module"><div class="module-head"><h2>亲子对话</h2><span>${cards.length} 条</span></div><div class="things-dialogue-list">${cards.map((card) => `<button data-things-card="${card.number}"><span>${card.number}</span><strong>${escapeHtml(card.title || card.word)}</strong><small>${escapeHtml(card.dialogue.split("\n")[0] || "")}</small></button>`).join("")}</div></section>`;
    return;
  }
  const list = (window.SUSAN_CHECKIN_DATA?.lists || []).find((item) => item.id === "things-checkin");
  if (!list) { panel.innerHTML = `<div class="empty">暂无打卡表数据</div>`; return; }
  const done = list.items.filter((item) => checkinState[`things-checkin:${item.number}`]).length;
  const chineseNames = ["空调", "空气净化器", "闹钟", "黑板", "搅拌机", "书柜", "书", "碗", "鸭舌帽", "汽车", "椅子", "充电器", "茶几", "彩色马克笔", "电脑", "蜡笔", "台灯", "书桌", "狗食盆", "门", "鼓", "橡皮", "延长线", "冰箱", "水果", "吉他", "吹风机", "夹克", "水壶", "笔记本电脑", "化妆品", "肉", "微波炉", "镜子", "手机", "马克杯", "笔记本", "裤子", "铅笔", "铅笔盒", "相册", "钢琴", "药盒", "枕头", "盘子", "打印机", "剃须刀", "遥控器", "电饭煲", "机器人", "尺子", "书包", "洗发水", "袜子", "音箱", "楼梯", "凳子", "开关", "平板电脑", "马桶", "牙刷", "牙膏", "玩具", "T恤", "电视", "电视柜", "雨伞", "吸尘器", "花瓶", "蔬菜", "呼吸机", "背心", "衣柜", "洗衣机", "饮水机", "净水器", "窗户", "拥抱", "健康饮食", "洗手", "爱爸爸", "爱妈妈", "节约用电", "禁止吸烟", "小心地滑", "小心用电", "锻炼使你健康", "小心碰头", "节约用水", "善待动物", "努力工作，尽情玩耍", "控制脾气", "冲马桶", "系好安全带", "吃完食物", "刷牙", "陪伴家人", "理性饮酒", "安全驾驶", "收拾整齐"];
  panel.innerHTML = `<section class="module"><div class="module-head"><h2>万物贴打卡表</h2><span>${done}/${list.items.length}</span></div><div class="checkin-table-wrap"><table class="record-table susan-checkin-table things-checkin-table"><thead><tr><th>序号</th><th>词汇</th><th>中文</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.items.map((item) => { const key = `things-checkin:${item.number}`; const complete = Boolean(checkinState[key]); return `<tr><td>${item.number}</td><td><strong>${escapeHtml(item.word)}</strong></td><td>${escapeHtml(chineseNames[item.number - 1] || "")}</td><td>${statusBadge(complete ? "已完成" : "待打卡")}</td><td><button class="tiny-action" data-toggle-checkin="${key}">${complete ? "取消完成" : "完成"}</button></td></tr>`; }).join("")}</tbody></table></div></section>`;
}

function renderThingsDetail(number) {
  const card = (window.SSS_THINGS_CARDS || []).find((item) => item.number === Number(number));
  if (!card) return;
  const meta = (window.SSS_THINGS_META || []).find((item) => item.number === Number(number)) || {};
  const dialogueLines = card.dialogue.split("\n");
  const translations = card.dialogueTranslations || [];
  const dialogueRows = dialogueLines.map((line, index) => `<tr><td class="things-dialogue-index">${index + 1}</td><td data-label="英文原句">${escapeHtml(line)}</td><td data-label="中文翻译">${escapeHtml(translations[index] || "")}</td></tr>`).join("");
  $("#things-cards-view").innerHTML = `<button class="back-button" data-back-things>← 返回万物贴</button><section class="noun-card-hero"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.word)} 万物贴"><div><span>万物贴 ${card.number}</span><h1>${escapeHtml(card.word)}</h1><p class="things-detail-ipa">${escapeHtml(meta.ipa || "")}</p><p class="things-detail-chinese">${escapeHtml(meta.chinese || "")}</p><p>${escapeHtml(card.title || "")}</p></div></section><section class="module"><div class="module-head"><h2>亲子对话</h2><span>${dialogueLines.length} 句</span></div><div class="things-dialogue-wrap"><table class="content-table things-dialogue-table"><thead><tr><th class="things-dialogue-index">序号</th><th>英文原句</th><th>中文翻译</th></tr></thead><tbody>${dialogueRows}</tbody></table></div></section>`;
  showView("things-cards");
}

const parentSpeechItems = () => (window.SSS_PARENT_SPEECH || []).flatMap((source) => source.pages.map((page) => {
  const key = `${source.id}:${page.page}`;
  return { ...page, ...parentSpeechEdits[key], key, sourceId: source.id, sourceName: source.name };
}));

function parentSpeechScene(title) {
  const value = String(title || "");
  if (/目录|封面/.test(value)) return "目录";
  if (/早餐|午餐|晚餐|吃|喝|餐厅|点心|菜|水果|超市/.test(value)) return "饮食";
  if (/洗|刷牙|厕所|尿|大便|穿衣|穿鞋|梳头|起床|睡|整理|打扫|扫地|折衣|晾衣|家务/.test(value)) return "日常起居";
  if (/疼|医院|药|感冒|发烧|鼻血|牙齿|虫咬|健康|受伤|摔|累|冷|热/.test(value)) return "健康护理";
  if (/雨|雪|阴天|风|季节|天气|沙尘/.test(value)) return "天气自然";
  if (/过年|中秋|儿童节|圣诞|节日/.test(value)) return "节日";
  if (/公园|电影院|书店|图书馆|银行|爬山|海边|游泳池|游乐园|公交|地铁|电梯|过马路|旅行|外面/.test(value)) return "外出场景";
  if (/作业|课程|画|上色|贴纸|折纸|黏土|积木|玩|球|跳绳|脚踏车|泡泡|电视|故事/.test(value)) return "游戏学习";
  if (/打招呼|感谢|道歉|介绍|爱你|称赞|礼貌|顶嘴|处罚|陌生人|打人|电话|表达/.test(value)) return "社交表达";
  return "其他";
}

function parentSpeechEditor(item) {
  return `<div class="parent-speech-editor hidden"><label>标题<input class="control" data-parent-speech-title value="${escapeHtml(item.title)}"></label><label>正文<textarea class="control" data-parent-speech-text rows="8">${escapeHtml(item.text)}</textarea></label><div class="parent-speech-editor-actions"><button class="tiny-action" data-save-parent-speech="${escapeHtml(item.key)}">保存</button><button class="tiny-action" data-cancel-parent-speech>取消</button></div></div>`;
}

function renderParentSpeech() {
  const items = parentSpeechItems();
  const root = $("#parent-speech-view");
  if (!root) return;
  const categories = ["全部", ...new Set(items.map((item) => parentSpeechScene(item.title)))];
  if (!categories.includes(parentSpeechCategory)) parentSpeechCategory = "全部";
  const filtered = items.filter((item) => parentSpeechCategory === "全部" || parentSpeechScene(item.title) === parentSpeechCategory);
  root.innerHTML = `<div class="page-head"><div><h1>亲子口语</h1></div></div><div class="parent-speech-scene-tabs" role="tablist" aria-label="场景筛选">${categories.map((category) => { const count = category === "全部" ? items.length : items.filter((item) => parentSpeechScene(item.title) === category).length; return `<button class="parent-speech-scene-tab${category === parentSpeechCategory ? " active" : ""}" role="tab" aria-selected="${category === parentSpeechCategory}" data-parent-speech-category="${escapeHtml(category)}">${escapeHtml(category)} <small>${count}</small></button>`; }).join("")}</div><div id="parent-speech-grid" class="parent-speech-grid">${filtered.map((item) => `<article class="parent-speech-card" data-parent-speech-item="${escapeHtml(item.key)}"><button class="parent-speech-image-button" data-parent-speech-page="${item.page}" data-parent-speech-source="${escapeHtml(item.sourceId)}" aria-label="查看 ${escapeHtml(item.title)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}"></button><div class="parent-speech-card-content"><small>${escapeHtml(parentSpeechScene(item.title))} · ${escapeHtml(item.sourceName)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><button class="parent-speech-edit" data-edit-parent-speech aria-label="编辑标题和正文" title="编辑标题和正文">✎</button></div>${parentSpeechEditor(item)}</article>`).join("") || `<div class="empty">该分类暂无内容</div>`}</div>`;
}

function renderParentSpeechDetail(sourceId, pageNumber) {
  const source = (window.SSS_PARENT_SPEECH || []).find((item) => item.id === sourceId);
  const original = source?.pages.find((item) => item.page === Number(pageNumber));
  const key = `${sourceId}:${pageNumber}`;
  const page = original ? { ...original, ...(parentSpeechEdits[key] || {}), key } : null;
  if (!source || !page) return;
  const previous = source.pages.find((item) => item.page === page.page - 1);
  const next = source.pages.find((item) => item.page === page.page + 1);
  $("#parent-speech-view").innerHTML = `<button class="back-button" data-back-parent-speech>← 返回亲子口语</button><div class="parent-speech-detail-head"><div><span>${escapeHtml(parentSpeechScene(page.title))} · ${escapeHtml(source.name)}</span><h1>${escapeHtml(page.title)}</h1></div><div class="parent-speech-pager">${previous ? `<button class="tiny-action" data-parent-speech-page="${previous.page}" data-parent-speech-source="${escapeHtml(source.id)}">上一页</button>` : ""}${next ? `<button class="tiny-action" data-parent-speech-page="${next.page}" data-parent-speech-source="${escapeHtml(source.id)}">下一页</button>` : ""}</div></div><section class="module parent-speech-page"><img src="${escapeHtml(page.image)}" alt="${escapeHtml(page.title)} PDF 页面"></section><section class="module parent-speech-copy" data-parent-speech-item="${escapeHtml(key)}"><div class="module-head"><h2>标题和内容</h2><button class="tiny-action" data-edit-parent-speech>编辑</button></div><h3>${escapeHtml(page.title)}</h3><p>${escapeHtml(page.text)}</p>${parentSpeechEditor(page)}</section>`;
  showView("parent-speech");
}

function renderPosyPip() {
  const root = $("#posy-pip-view");
  const items = (window.POSY_PIP_DATA || []).map((item) => ({ ...item, ...(posyPipEdits[item.number] || {}) }));
  const categories = ["名词", "动作", "形容词", "生活场景"];
  const categoryCount = (category) => items.filter((item) => item.category === category).length;
  let activeCategory = "";
  root.innerHTML = `<div class="page-head"><div><h1>波西和皮普闪卡</h1></div></div><div class="posy-pip-tabs" role="tablist" aria-label="闪卡分类"><button class="posy-pip-tab active" role="tab" aria-selected="true" data-posy-pip-category="">全部 <small>${items.length}</small></button>${categories.map((item) => `<button class="posy-pip-tab" role="tab" aria-selected="false" data-posy-pip-category="${item}">${item} <small>${categoryCount(item)}</small></button>`).join("")}</div><div class="filters posy-pip-filters"><div class="field"><label for="posy-pip-search">卡片名称</label><input id="posy-pip-search" class="control" type="search" placeholder="搜索英文单词或短语"></div></div><p id="posy-pip-result" class="result-note"></p><div id="posy-pip-grid" class="posy-pip-grid"></div>`;
  const draw = () => {
    const query = $("#posy-pip-search").value;
    const filtered = items.filter((item) => (!activeCategory || item.category === activeCategory) && fuzzyMatch(item.title, query));
    $("#posy-pip-result").textContent = `显示 ${filtered.length} 张闪卡`;
    $("#posy-pip-grid").innerHTML = filtered.map((item) => `<article class="posy-pip-card" data-posy-pip-item="${item.number}"><button class="posy-pip-image-button" data-posy-pip-card="${item.number}" aria-label="查看 ${escapeHtml(item.title)}"><span class="posy-pip-number">${item.number}</span>${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : `<span class="posy-pip-image-fallback" aria-hidden="true">${escapeHtml(item.title)}</span>`}</button><div class="posy-pip-meta"><button class="posy-pip-word-button" data-posy-pip-play="${item.number}" aria-label="播放 ${escapeHtml(item.title)}">${escapeHtml(item.title)} <span aria-hidden="true">▶</span></button><span class="posy-pip-ipa">${escapeHtml(item.ipa)}</span><button class="posy-pip-edit" data-edit-posy-pip="${item.number}" aria-label="编辑 ${escapeHtml(item.title)}" title="编辑英文和音标">✎</button></div><div class="posy-pip-editor hidden"><label>英文<input class="control" data-posy-title value="${escapeHtml(item.title)}"></label><label>音标<input class="control" data-posy-ipa value="${escapeHtml(item.ipa)}"></label><div><button class="tiny-action" data-save-posy-pip="${item.number}">保存</button><button class="tiny-action" data-cancel-posy-pip="${item.number}">取消</button></div></div></article>`).join("") || `<div class="empty">没有符合条件的闪卡</div>`;
  };
  root.querySelectorAll("[data-posy-pip-category]").forEach((button) => button.onclick = () => {
    activeCategory = button.dataset.posyPipCategory;
    root.querySelectorAll("[data-posy-pip-category]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    draw();
  });
  $("#posy-pip-search").oninput = draw;
  draw();
}

function playPosyPipAudio(number) {
  const item = (window.POSY_PIP_DATA || []).find((entry) => entry.number === Number(number));
  if (!item) return;
  if (posyPipAudio) {
    posyPipAudio.pause();
    posyPipAudio = null;
  }
  const status = $("#posy-pip-audio-status");
  const speak = () => {
    if (!window.speechSynthesis) {
      if (status) status.textContent = "当前浏览器不支持播放此音频";
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.title);
    utterance.lang = "en-US";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
    if (status) status.textContent = "正在播放英文发音（浏览器语音）";
  };
  if (!item.audioFile) { speak(); return; }
  const src = `assets/posy-pip-audio/${encodeURIComponent(item.audioFile)}`;
  const audio = new Audio(src);
  posyPipAudio = audio;
  audio.oncanplay = () => {
    audio.play().then(() => { if (status) status.textContent = "正在播放闪卡音频"; }).catch(speak);
  };
  audio.onerror = speak;
  audio.load();
}

function toIng(phrase) {
  const [verb, ...rest] = phrase.split(" ");
  const irregular = { lie: "lying", pee: "peeing" };
  let ing = irregular[verb];
  if (!ing && /ie$/.test(verb)) ing = `${verb.slice(0, -2)}ying`;
  if (!ing && /[^aeiou]e$/.test(verb)) ing = `${verb.slice(0, -1)}ing`;
  if (!ing && /^(dig|sit|run|swim|stir|mop|pop)$/.test(verb)) ing = `${verb}${verb.slice(-1)}ing`;
  if (!ing) ing = `${verb}ing`;
  return [ing, ...rest].join(" ");
}

function posyPipPractice(item) {
  const core = (type, number) => (window.SSS_PATTERN_LIBRARY || []).find((row) => row.type === type && row.number === number)?.pattern || "";
  const row = (type, number, question, answer, translation, applied) => ({ code: `${type.replace("卡", "句型")} ${number}`, pattern: core(type, number), applied, question, answer, translation });
  if (item.category === "动作") {
    const doing = toIng(item.title);
    return [
      row("动词卡", 1, "What are you doing?", `I am ${doing}.`, `你正在做什么？我正在${item.chinese}。`, `I am ${doing}`),
      row("动词卡", 3, "What is Pip doing?", `Pip is ${doing}.`, `皮普正在做什么？皮普正在${item.chinese}。`, `He is ${doing}`),
      row("动词卡", 6, `Are you ${doing}?`, `No, I'm not ${doing}.`, `你正在${item.chinese}吗？不，我没有。`, `I'm not ${doing}`),
      row("动词卡", 8, `Can Pip ${item.title}?`, `Yes, he can ${item.title}.`, `皮普会${item.chinese}吗？是的，他会。`, `I can ${item.title}`),
      row("动词卡", 12, `Can I ${item.title}?`, `Yes, you can ${item.title}.`, `我可以${item.chinese}吗？是的，可以。`, `Can I ${item.title}?`),
      row("动词卡", 13, "What do you want to do?", `I want to ${item.title}.`, `你想做什么？我想${item.chinese}。`, `I want to ${item.title}`),
      row("动词卡", 16, `Do you ${item.title} every day?`, `Yes, I ${item.title} every day.`, `你每天都${item.chinese}吗？是的，我每天都这样做。`, `I ${item.title} every day`),
      row("动词卡", 18, "What should Pip do?", `Pip, ${item.title}!`, `皮普应该做什么？皮普，${item.chinese}！`, `${item.title}!`),
      row("动词卡", 20, "What shall we do?", `Let's ${item.title}!`, `我们做什么？我们一起${item.chinese}吧！`, `Let's ${item.title}!`),
      row("动词卡", 21, `Do you like ${doing}?`, `Yes, I like ${doing}.`, `你喜欢${item.chinese}吗？是的，我喜欢。`, `I like ${doing}`),
      row("动词卡", 26, "What are you going to do?", `I'm going to ${item.title}.`, `你打算做什么？我打算${item.chinese}。`, `I'm going to ${item.title}`),
    ];
  }
  if (item.category === "形容词") {
    const feeling = item.chinese.replace(/的$/, "");
    return [
      row("形容词卡", 17, "How does Pip feel?", `Pip feels ${item.title}.`, `皮普感觉怎么样？皮普感到${feeling}。`, `Pip feels ${item.title}`),
      row("形容词卡", 48, "What happened to Pip?", `Pip got so ${item.title}.`, `皮普怎么了？皮普变得非常${feeling}。`, `Pip got so ${item.title}`),
      row("形容词卡", 67, `What do you do if you are ${item.title}?`, "I take a deep breath.", `如果你感到${feeling}，你会做什么？我会深呼吸。`, `If you are ${item.title}`),
      row("形容词卡", 68, `What do you want to do when you're really ${item.title}?`, "I want to talk to Mom.", `当你真的很${feeling}时，你想做什么？我想和妈妈说说话。`, `When I'm really ${item.title}`),
    ];
  }
  if (item.category === "生活场景") {
    if (item.title === "here you are") return [
      row("名词卡", 36, "Can I have the toy, please?", "Here you are.", "请把玩具给我好吗？给你。", "Here you are"),
      row("名词卡", 42, "Can you show me the toy?", "Here you are. Look at the toy!", "你能把玩具给我看看吗？给你。看看这个玩具！", "Look at the toy"),
    ];
    return [
      row("动词卡", 8, "Can you play hide and seek?", "Yes, I can play hide and seek.", "你会玩捉迷藏吗？是的，我会。", "I can play hide and seek"),
      row("动词卡", 13, "What do you want to play?", "I want to play hide and seek.", "你想玩什么？我想玩捉迷藏。", "I want to play hide and seek"),
      row("动词卡", 20, "What shall we play?", "Let's play hide and seek!", "我们玩什么？我们来玩捉迷藏吧！", "Let's play hide and seek!"),
      row("动词卡", 21, "Do you like playing hide and seek?", "Yes, I like playing hide and seek.", "你喜欢玩捉迷藏吗？是的，我喜欢。", "I like playing hide and seek"),
    ];
  }
  const plural = /^(boots|blocks|pajamas)$/.test(item.title);
  const uncountable = /^(ice cream|drawing paper|flour|sugar|butter|shampoo|bakeware)$/.test(item.title);
  const article = /^[aeiou]/i.test(item.title) ? "an" : "a";
  const object = plural || uncountable ? item.title : `${article} ${item.title}`;
  return [
    row("名词卡", 1, plural ? "What are these?" : "What's this?", plural ? `They're ${item.title}.` : `It's ${object}.`, plural ? `这些是什么？这些是${item.chinese}。` : `这是什么？这是${item.chinese}。`, plural ? `They're ${item.title}` : `It's ${object}`),
    row("名词卡", 2, `Is this ${object}?`, `Yes, this is ${object}.`, `这是${item.chinese}吗？是的，这是${item.chinese}。`, `This is ${object}`),
    row("名词卡", 3, `Is that ${object}?`, `Yes, that is ${object}.`, `那是${item.chinese}吗？是的，那是${item.chinese}。`, `That is ${object}`),
    row("名词卡", 9, `Is it ${object}?`, `No, it isn't ${object}.`, `它是${item.chinese}吗？不，它不是。`, `It isn't ${object}`),
    row("名词卡", 10, "What can you see?", `I can see ${object}.`, `你能看见什么？我能看见${item.chinese}。`, `I can see ${object}`),
    row("名词卡", 12, `Whose ${item.title} is it?`, `It is my ${item.title}.`, `这是谁的${item.chinese}？这是我的。`, `It is my ${item.title}`),
    row("名词卡", 16, "What is in the picture?", `There is ${object} in the picture.`, `图画里有什么？图画里有${item.chinese}。`, `There is ${object}`),
    row("名词卡", 19, `Can you see ${object}?`, `No, I can't see ${object}.`, `你能看见${item.chinese}吗？不，我看不见。`, `I can't see ${object}`),
    row("名词卡", 24, `Do you like ${item.title}?`, `Yes, I like ${item.title}.`, `你喜欢${item.chinese}吗？是的，我喜欢。`, `I like ${item.title}`),
    row("名词卡", 32, "What do you want?", `I want ${object}.`, `你想要什么？我想要${item.chinese}。`, `I want ${object}`),
  ];
}

function posyPipCollocations(item) {
  if (item.category === "动作") return [item.title, toIng(item.title), `can ${item.title}`];
  if (item.category === "形容词") return [`feel ${item.title}`, `look ${item.title}`, `be ${item.title}`];
  if (item.category === "生活场景") return item.title === "here you are" ? ["Here you are.", "Here it is.", "Here they are."] : ["play hide and seek", "a game of hide and seek", "Let's hide!"];
  const article = /^[aeiou]/i.test(item.title) ? "an" : "a";
  return [`${article} ${item.title}`, `see ${item.title}`, `my ${item.title}`];
}

function renderPosyPipDetail(number) {
  const items = (window.POSY_PIP_DATA || []).map((item) => ({ ...item, ...(posyPipEdits[item.number] || {}) }));
  const index = items.findIndex((item) => item.number === Number(number));
  const item = items[index];
  if (!item) return;
  const previous = items[index - 1];
  const next = items[index + 1];
  const practice = posyPipPractice(item);
  const collocations = posyPipCollocations(item);
  $("#posy-pip-view").innerHTML = `<button class="back-button" data-back-posy-pip>← 返回波西和皮普闪卡</button><div class="parent-speech-detail-head"><div><span>${escapeHtml(item.category)} · ${item.number}/${items.length}</span><h1><button class="posy-pip-audio-word" data-posy-pip-play="${item.number}" aria-label="播放 ${escapeHtml(item.title)}">${escapeHtml(item.title)} <span aria-hidden="true">▶</span></button></h1></div><div class="parent-speech-pager">${previous ? `<button class="tiny-action" data-posy-pip-card="${previous.number}">上一张</button>` : ""}${next ? `<button class="tiny-action" data-posy-pip-card="${next.number}">下一张</button>` : ""}</div></div><section class="module posy-pip-detail">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)} 闪卡">` : `<div class="posy-pip-detail-fallback">${escapeHtml(item.title)}</div>`}<p id="posy-pip-audio-status" class="result-note" aria-live="polite">点击英文播放音频</p></section><section class="module posy-pip-word-info"><div><span>音标</span><strong>${escapeHtml(item.ipa)}</strong></div><div><span>词性</span><strong>${escapeHtml(item.category)}</strong></div><div><span>中文翻译</span><strong>${escapeHtml(item.chinese)}</strong></div><div><span>固定搭配</span><strong>${collocations.map(escapeHtml).join(" · ")}</strong></div></section><section class="module posy-pip-practice"><div class="module-head"><h2>句型问答</h2><span>匹配 ${practice.length} 个核心句型</span></div><div class="posy-pip-qa-list">${practice.map((row, i) => `<article class="posy-pip-qa"><div class="posy-pip-qa-head"><span>句型 ${i + 1}</span><small>${escapeHtml(row.code)}</small></div><div class="posy-pip-core"><span>核心句型</span><strong>${escapeHtml(row.pattern)}</strong></div><div class="posy-pip-applied"><span>本卡套用</span><strong>${escapeHtml(row.applied)}</strong></div><dl><div><dt>Q</dt><dd>${escapeHtml(row.question)}</dd></div><div><dt>A</dt><dd>${escapeHtml(row.answer)}</dd></div></dl><p>${escapeHtml(row.translation)}</p></article>`).join("")}</div></section>`;
  showView("posy-pip");
}

function songPracticeRows(song) {
  const lib = window.SSS_PATTERN_LIBRARY || [];
  const clean = (value) => String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^[\p{Script=Han}\s]+$/u.test(line));
  const cap = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  const article = (word) => /^[aeiou]/i.test(word) ? "an" : "a";
  const subjectWord = (word) => word.english.replace(/^(my|your|the)\s+/i, "").trim();
  const item = (pattern, word, question, answer, translation) => ({
    type: pattern.type, pattern: pattern.pattern, word: word.english, meaning: word.meaning,
    question, answer, translation,
  });
  const rows = [];
  song.patterns.forEach((songPattern) => {
    const number = Number(String(songPattern.pattern || "").match(/(\d+)\s*\./)?.[1]);
    const pattern = lib.find((row) => row.type === songPattern.type && row.number === number);
    if (!pattern) return;
    song.words.forEach((word) => {
      const value = subjectWord(word);
      const doing = toIng(value);
      const obj = `${article(value)} ${value}`;
      if (pattern.type === "名词卡") {
        const nounMap = {
          1: ["What's this?", `It's ${obj}.`, `这是什么？这是${word.meaning}。`],
          2: ["What's this?", `This is ${obj}.`, `这是什么？这是${word.meaning}。`],
          3: ["What's that?", `That is ${obj}.`, `那是什么？那是${word.meaning}。`],
          4: [`What is ${value}?`, `${cap(value)} is ${value}.`, `什么是${word.meaning}？${word.meaning}就是${value}。`],
          5: [`What is ${value}?`, `${cap(value)} is ${value}.`, `什么是${word.meaning}？${word.meaning}就是${value}。`],
          7: [`What is big?`, `${cap(value)} is big.`, `什么很大？${word.meaning}很大。`],
          8: [`What is small?`, `${cap(value)} is small.`, `什么很小？${word.meaning}很小。`],
          10: ["What can you see?", `I can see ${obj}.`, `你能看见什么？我能看见${word.meaning}。`],
          11: ["What can you see?", `I can see ${obj}.`, `你能看见什么？我能看见${word.meaning}。`],
          12: [`Whose ${value} is it?`, `It is my ${value}.`, `这是谁的${word.meaning}？这是我的。`],
          13: ["Who is it?", `It is my ${value}.`, `它是谁？它是我的${word.meaning}。`],
          16: ["What can you see?", `There is ${obj}.`, `你能看见什么？有一个${word.meaning}。`],
          17: ["What's in the sea?", `There is ${obj} in the sea.`, `海里有什么？海里有一个${word.meaning}。`],
          20: [`How many ${value}s do you have?`, `I have ${article(value)} ${value}.`, `你有多少个${word.meaning}？我有一个。`],
          22: [`What does your dad have?`, `My dad has ${article(value)} ${value}.`, `爸爸有什么？爸爸有一个${word.meaning}。`],
          24: [`Do you like ${value}?`, `Yes, I like ${value}.`, `你喜欢${word.meaning}吗？是的，我喜欢。`],
          28: [`Do you love ${value}?`, `Yes, I love ${value}.`, `你喜爱${word.meaning}吗？是的，我喜爱。`],
          32: ["What do you want?", `I want ${obj}.`, `你想要什么？我想要${word.meaning}。`],
          37: ["What do you want to eat?", `I want to eat ${obj}.`, `你想吃什么？我想吃${word.meaning}。`],
          38: ["What are you wearing?", `I am wearing ${obj}.`, `你穿着什么？我穿着${word.meaning}。`],
          39: ["What is he wearing?", `He is wearing ${obj}.`, `他穿着什么？他穿着${word.meaning}。`],
          41: [`Can you drink ${value}?`, `No, I can't drink ${value}.`, `你能喝${word.meaning}吗？不，我不能。`],
          42: [`What do you look at?`, `Look at the ${value}!`, `你看什么？看这个${word.meaning}！`],
          43: [`What do you listen to?`, `Listen to the ${value}!`, `你听什么？听这个${word.meaning}！`],
          44: ["What can you hear?", `I can hear the ${value}.`, `你能听见什么？我能听见${word.meaning}。`],
          45: [`What's hot?`, `The ${value} is hot.`, `什么很烫？${word.meaning}很烫。`],
          46: [`What's cold?`, `The ${value} is cold.`, `什么很冷？${word.meaning}很冷。`],
          47: ["What's on the table?", `The ${value} is on the table.`, `桌上有什么？桌上有${word.meaning}。`],
          48: ["What's in the freezer?", `The ${value} is in the freezer.`, `冰箱里有什么？冰箱里有${word.meaning}。`],
          49: ["What's under your bed?", `The ${value} is under my bed.`, `床下有什么？床下有${word.meaning}。`],
        };
        if (nounMap[number]) { const [q, a, t] = nounMap[number]; rows.push(item(pattern, word, q, a, t)); }
        return;
      }
      if (pattern.type === "动词卡") {
        const verbMap = {
          1: ["What are you doing?", `I am ${doing}.`, `你正在做什么？我正在${word.meaning}。`],
          2: ["What are you doing?", `I am ${doing}.`, `你正在做什么？我正在${word.meaning}。`],
          5: ["What's it doing?", `It is ${doing}.`, `它正在做什么？它正在${word.meaning}。`],
          8: [`Can you ${value}?`, `Yes, I can ${value}.`, `你会${word.meaning}吗？是的，我会。`],
          9: [`Can you ${value}?`, `No, I can't ${value}.`, `你会${word.meaning}吗？不，我不会。`],
          12: [`Can I ${value} now?`, `Yes, you can ${value} now.`, `我现在可以${word.meaning}吗？可以。`],
          14: [`Do you want to ${value}?`, `No, I don't want to ${value}.`, `你想${word.meaning}吗？不，我不想。`],
          15: [`What does it want to do?`, `It wants to ${value}.`, `它想做什么？它想${word.meaning}。`],
          16: [`Do you ${value} every day?`, `Yes, I ${value} every day.`, `你每天都${word.meaning}吗？是的。`],
          18: ["What should I do?", `${cap(value)}!`, `我该做什么？请${word.meaning}！`],
          20: ["What shall we do?", `Let's ${value}!`, `我们做什么？我们一起${word.meaning}吧！`],
          21: [`Do you like ${doing}?`, `Yes, I like ${doing}.`, `你喜欢${word.meaning}吗？是的，我喜欢。`],
          22: [`Do you hate ${doing}?`, `Yes, I hate ${doing}.`, `你讨厌${word.meaning}吗？是的，我讨厌。`],
          26: ["What are you going to do?", `I'm going to ${value}.`, `你打算做什么？我打算${word.meaning}。`],
          28: [`Do you know how to ${value}?`, `No, I don't know how to ${value}.`, `你知道怎么${word.meaning}吗？不，我不知道。`],
          29: [`How do I do it?`, `${cap(value)} fast!`, `我该怎么做？快快地${word.meaning}！`],
          30: [`How do I do it?`, `${cap(value)} slowly!`, `我该怎么做？慢慢地${word.meaning}！`],
          31: [`How do I do it?`, `${cap(value)} quietly!`, `我该怎么做？安静地${word.meaning}！`],
          32: [`How do I do it?`, `Don't ${value} too loudly!`, `我该怎么做？不要太大声地${word.meaning}！`],
          33: ["What did you do yesterday?", `I ${value}ed yesterday.`, `你昨天做什么了？我昨天${word.meaning}了。`],
          37: [`Have you ${value}ed?`, `Yes, I have ${value}ed.`, `你已经${word.meaning}了吗？是的。`],
          50: [`What does it never do?`, `It never ${value}s.`, `它从来不做什么？它从来不${word.meaning}。`],
          52: [`Is ${doing} good for you?`, `Yes, ${doing} is good for me.`, `${word.meaning}对你有好处吗？有。`],
          54: ["What's it doing?", `It is ${doing} on the desk.`, `它在做什么？它在桌上${word.meaning}。`],
          55: ["What's it doing?", `It is ${doing} under the table.`, `它在做什么？它在桌子下${word.meaning}。`],
          56: ["What's it doing?", `It is ${doing} on the grass.`, `它在做什么？它在草地上${word.meaning}。`],
          57: ["What's it doing?", `It is ${doing} around the flowers.`, `它在做什么？它在花丛边${word.meaning}。`],
          58: ["What's it doing?", `It is ${doing} on the sofa.`, `它在做什么？它在沙发上${word.meaning}。`],
          59: ["What's it doing?", `It is ${doing} on the bus.`, `它在做什么？它在公交车上${word.meaning}。`],
          61: ["What are they doing?", `They are ${doing} on the bed.`, `它们在做什么？它们在床上${word.meaning}。`],
          62: ["What's it doing?", `It is ${doing} in the building.`, `它在做什么？它在楼里${word.meaning}。`],
          63: ["What's it doing?", `It is ${doing} through the window.`, `它在做什么？它在窗边${word.meaning}。`],
          64: ["What's it doing?", `It is ${doing} behind the door.`, `它在做什么？它在门后${word.meaning}。`],
          65: ["What's it doing?", `It is ${doing} on the boat.`, `它在做什么？它在船上${word.meaning}。`],
          66: ["What's it doing?", `It is ${doing} in the sea.`, `它在做什么？它在海里${word.meaning}。`],
          67: [`What can you do?`, `I can ${value} under the sun.`, `你能做什么？我能在太阳下${word.meaning}。`],
          68: ["What are they doing?", `They are ${doing} on the moon.`, `它们在做什么？它们在月亮上${word.meaning}。`],
        };
        if (verbMap[number]) { const [q, a, t] = verbMap[number]; rows.push(item(pattern, word, q, a, t)); }
        return;
      }
      const genericAdjMap = {
        1: ["What's it like?", `It's ${value}.`, `它是什么样的？它是${word.meaning.replace(/的$/, "")}的。`],
        3: ["What does your dad have?", `My dad has ${article(value)} ${value}.`, `爸爸有什么？爸爸有一个${word.meaning}。`],
        4: ["What do you like?", `I like ${obj}.`, `你喜欢什么？我喜欢${word.meaning}。`],
        9: ["What should we do?", `Be careful with the ${value}!`, `我们该注意什么？小心${word.meaning}！`],
        39: ["Which one is longer?", `The ${value} is longer.`, `哪个更长？${word.meaning}更长。`],
        41: ["How is the food?", `The ${value} is yummy.`, `食物怎么样？这个${word.meaning}很好吃。`],
        42: ["How is the food?", `The ${value} is yucky.`, `食物怎么样？这个${word.meaning}不好吃。`],
        53: ["What's full?", `The ${value} is full.`, `什么满了？${word.meaning}满了。`],
        57: ["Where can we go?", `We can go to the ${value}.`, `我们可以去哪里？我们可以去${word.meaning}。`],
        69: [`Is it about ${value}?`, `Yes, it depends on the ${value}.`, `这和${word.meaning}有关吗？是的，要看${word.meaning}。`],
        99: ["What do they like to eat?", `They like to eat ${value}.`, `它们喜欢吃什么？它们喜欢吃${word.meaning}。`],
      };
      if (pattern.type === "形容词卡" && genericAdjMap[number]) { const [q, a, t] = genericAdjMap[number]; rows.push(item(pattern, word, q, a, t)); return; }
      const adjMap = {
        17: ["How do you feel?", `I feel ${value}.`, `你感觉怎么样？我感到${word.meaning.replace(/的$/, "")}。`],
        23: ["How is it now?", `It is ${value}.`, `它现在怎么样？它是${word.meaning.replace(/的$/, "")}的。`],
        24: ["How are your hands?", `My hands are ${value}.`, `你的手怎么样？我的手很${word.meaning.replace(/的$/, "")}。`],
        47: ["How is your mom?", `My mom is very ${value}.`, `妈妈怎么样？妈妈很${word.meaning.replace(/的$/, "")}。`],
        48: ["What happened?", `I got so ${value}.`, `怎么了？我变得很${word.meaning.replace(/的$/, "")}。`],
        56: [`Can you be ${value}?`, `Yes, I can be ${value}.`, `你能${word.meaning.replace(/的$/, "")}一点吗？可以。`],
        96: ["How does it smell?", `It smells ${value}.`, `它闻起来怎么样？闻起来${word.meaning.replace(/的$/, "")}。`],
      };
      if (pattern.type === "形容词卡" && adjMap[number]) { const [q, a, t] = adjMap[number]; rows.push(item(pattern, word, q, a, t)); }
    });
  });
  return rows.slice(0, 20);
}

function renderSong(sheet) {
  const song = songBySheet.get(sheet);
  if (!song) return;
  const activeView = document.querySelector(".view.active")?.id.replace("-view", "") || "details";
  if (activeView !== "song") previousView = activeView;
  const thumbnail = youtubeThumbnail(song.videoUrl);
  const relatedSongs = songs
    .filter((item) => item.sheet !== song.sheet && themeCategory(item.theme) === themeCategory(song.theme))
    .sort((a, b) => (a.week || 999) - (b.week || 999));
  $("#song-view").innerHTML = `
    <button class="back-button" data-back>← 返回${previousView === "checkin" ? "33周打卡" : "歌曲明细"}</button>
    <section class="song-hero ${thumbnail ? "has-image" : ""}" ${thumbnail ? `style="background-image:url('${thumbnail}')"` : ""}>
      <div class="song-hero-content"><p class="song-kicker">${song.week ? `第 ${song.week} 周 · ${escapeHtml(themeCategory(song.theme))}` : escapeHtml(song.category)}</p><h1>${escapeHtml(song.title)}</h1><p>${escapeHtml(song.meta)}</p><div class="hero-actions"><button class="button" data-toggle-sheet="${escapeHtml(song.sheet)}">${isDone(song) ? "标记为待打卡" : "标记为已完成"}</button></div></div>
    </section>
    <section class="song-facts" aria-label="歌曲基础信息"><div><span>内容类型</span><strong>SSS儿歌</strong></div><div><span>主题</span><strong>${escapeHtml(themeCategory(song.theme))}</strong></div><div><span>学习状态</span><strong>${escapeHtml(currentStatus(song))}</strong></div><div><span>核心词汇</span><strong>${song.words.length} 个</strong></div><div><span>TPR</span><strong>${song.tpr.length} 条</strong></div><div><span>匹配句型</span><strong>${song.patterns.length} 条</strong></div></section>
    <div class="detail-layout"><div class="detail-main">
      <section class="module"><div class="module-head"><h2>完整歌词</h2><span>${song.lyrics.length} 行</span></div>${song.lyrics.length ? `<ol class="lyrics">${song.lyrics.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>` : `<div class="empty">暂无歌词</div>`}</section>
      <section class="module"><div class="module-head"><h2>核心词汇</h2><span>${song.words.length} 个</span></div>${song.words.length ? `<table class="content-table"><thead><tr><th class="index-column">序号</th><th>英文</th><th>音标</th><th>中文词义</th></tr></thead><tbody>${song.words.map((word, index) => `<tr><td class="index-column">${index + 1}</td><td><strong>${escapeHtml(word.english)}</strong></td><td>${escapeHtml(word.ipa)}</td><td>${escapeHtml(word.meaning)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">暂无核心词汇</div>`}</section>
      <section class="module"><div class="module-head"><h2>TPR</h2><span>歌词原句直接提取</span></div>${song.tpr.length ? `<table class="content-table"><thead><tr><th>步骤</th><th>歌词原句</th><th>中文翻译</th></tr></thead><tbody>${song.tpr.map((item) => `<tr><td>${escapeHtml(item.step)}</td><td>${escapeHtml(item.lyric)}</td><td>${escapeHtml(item.translation)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">歌词中无明确 TPR 动作句</div>`}</section>
      <section class="module"><div class="module-head"><h2>匹配基础句型</h2><span>${song.patterns.length} 条</span></div>${song.patterns.length ? `<table class="content-table"><thead><tr><th>类型</th><th>基础句型</th><th>详细句型</th></tr></thead><tbody>${song.patterns.map((item) => `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.pattern)}</td><td class="multiline">${escapeHtml(cleanExample(item.example))}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">暂无匹配句型</div>`}</section>
      ${(() => { const practice = songPracticeRows(song); if (!practice.length) return ""; return `<section class="module song-practice-module"><div class="module-head"><h2>句型 × 核心词汇完整问答</h2><span>结合本首歌核心词汇练习</span></div><div class="song-practice-grid">${practice.map((row, index) => `<article class="song-practice-card"><div class="song-practice-head"><span>问答 ${index + 1}</span><small>${escapeHtml(row.type.replace("卡", ""))} · ${escapeHtml(row.word)} <em>${escapeHtml(row.meaning)}</em></small></div><div class="song-practice-pattern">${escapeHtml(row.pattern)}</div><dl><div><dt>Q</dt><dd>${escapeHtml(row.question)}</dd></div><div><dt>A</dt><dd>${escapeHtml(row.answer)}</dd></div></dl><p>${escapeHtml(row.translation)}</p></article>`).join("")}</div></section>`; })()}
    </div></div>
    <section class="related-module"><div class="related-head"><div><h2>相关歌曲</h2></div><span>${relatedSongs.length} 首</span></div>${relatedSongs.length ? `<div class="related-grid">${relatedSongs.map((item) => { const cover = youtubeThumbnail(item.videoUrl); return `<button class="related-song" data-song-sheet="${escapeHtml(item.sheet)}"><span class="related-cover ${cover ? "has-cover" : "no-cover"}" ${cover ? `style="background-image:url('${cover}')"` : ""}>${cover ? "" : "暂无封面"}</span><span class="related-info"><small>第 ${item.week || "-"} 周 · ${escapeHtml(themeCategory(item.theme))}</small><strong>${escapeHtml(item.title)}</strong>${statusBadge(currentStatus(item))}</span></button>`; }).join("")}</div>` : `<div class="empty">暂无同主题歌曲</div>`}</section>`;
  showView("song");
}

document.addEventListener("click", (event) => {
  const weeklySpeak = event.target.closest("[data-weekly-speak]");
  if (weeklySpeak) {
    event.preventDefault();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(weeklySpeak.dataset.weeklySpeak);
      utterance.lang = "en-US";
      utterance.rate = 0.86;
      window.speechSynthesis.speak(utterance);
    }
    return;
  }
  const weeklyOpen = event.target.closest("[data-weekly-open-view]");
  if (weeklyOpen) {
    const view = weeklyOpen.dataset.weeklyOpenView;
    if (view === "parent-speech") renderParentSpeech();
    if (view === "reading" && typeof renderReadingIntegration === "function") renderReadingIntegration();
    showView(view);
    return;
  }
  const posyPipPlay = event.target.closest("[data-posy-pip-play]");
  if (posyPipPlay) {
    event.preventDefault();
    event.stopPropagation();
    playPosyPipAudio(posyPipPlay.dataset.posyPipPlay);
    return;
  }
  const editPosyPip = event.target.closest("[data-edit-posy-pip]");
  if (editPosyPip) {
    const card = editPosyPip.closest("[data-posy-pip-item]");
    card.querySelector(".posy-pip-meta").classList.add("hidden");
    card.querySelector(".posy-pip-editor").classList.remove("hidden");
    card.querySelector("[data-posy-title]").focus();
    return;
  }
  const cancelPosyPip = event.target.closest("[data-cancel-posy-pip]");
  if (cancelPosyPip) {
    const card = cancelPosyPip.closest("[data-posy-pip-item]");
    card.querySelector(".posy-pip-meta").classList.remove("hidden");
    card.querySelector(".posy-pip-editor").classList.add("hidden");
    return;
  }
  const savePosyPip = event.target.closest("[data-save-posy-pip]");
  if (savePosyPip) {
    const number = Number(savePosyPip.dataset.savePosyPip);
    const card = savePosyPip.closest("[data-posy-pip-item]");
    const title = card.querySelector("[data-posy-title]").value.trim();
    const ipa = card.querySelector("[data-posy-ipa]").value.trim();
    if (title && ipa) {
      posyPipEdits[number] = { title, ipa };
      localStorage.setItem("posy-pip-card-edits-v1", JSON.stringify(posyPipEdits));
      renderPosyPip();
    }
    return;
  }
  const posyPipCard = event.target.closest("[data-posy-pip-card]");
  if (posyPipCard) { renderPosyPipDetail(posyPipCard.dataset.posyPipCard); return; }
  const nounRepeat = event.target.closest("[data-noun-repeat]");
  if (nounRepeat) { renderNounRepeatDetail(nounRepeat.dataset.nounRepeat); return; }
  const parentSpeechPage = event.target.closest("[data-parent-speech-page]");
  if (parentSpeechPage) { renderParentSpeechDetail(parentSpeechPage.dataset.parentSpeechSource, parentSpeechPage.dataset.parentSpeechPage); return; }
  const parentSpeechCategoryButton = event.target.closest("[data-parent-speech-category]");
  if (parentSpeechCategoryButton) { parentSpeechCategory = parentSpeechCategoryButton.dataset.parentSpeechCategory; renderParentSpeech(); return; }
  const editParentSpeech = event.target.closest("[data-edit-parent-speech]");
  if (editParentSpeech) { const item = editParentSpeech.closest("[data-parent-speech-item]"); item.querySelector(".parent-speech-editor").classList.remove("hidden"); return; }
  const cancelParentSpeech = event.target.closest("[data-cancel-parent-speech]");
  if (cancelParentSpeech) { cancelParentSpeech.closest(".parent-speech-editor").classList.add("hidden"); return; }
  const saveParentSpeech = event.target.closest("[data-save-parent-speech]");
  if (saveParentSpeech) {
    const item = saveParentSpeech.closest("[data-parent-speech-item]");
    const title = item.querySelector("[data-parent-speech-title]").value.trim();
    const text = item.querySelector("[data-parent-speech-text]").value.trim();
    if (!title) return;
    parentSpeechEdits[saveParentSpeech.dataset.saveParentSpeech] = { title, text };
    localStorage.setItem("parent-speech-edits-v1", JSON.stringify(parentSpeechEdits));
    const [sourceId, page] = saveParentSpeech.dataset.saveParentSpeech.split(":");
    item.classList.contains("parent-speech-copy") ? renderParentSpeechDetail(sourceId, page) : renderParentSpeech();
    return;
  }
  const cardCategoryButton = event.target.closest("[data-card-category]");
  if (cardCategoryButton) {
    const type = cardCategoryButton.dataset.cardCategoryType;
    cardCategoryFilters[type] = cardCategoryButton.dataset.cardCategory || "全部";
    if (type === "noun") { renderNounCards(); renderNounTabPanel("cards"); showView("noun-cards"); }
    if (type === "verb") { renderVerbCards(); renderVerbTabPanel("cards"); showView("verbs"); }
    if (type === "adjective") { renderAdjectiveCards(); renderAdjectiveTabPanel("cards"); showView("adjectives"); }
    return;
  }
  const randomModeButton = event.target.closest("[data-random-mode]");
  if (randomModeButton) {
    randomSentenceMode = randomModeButton.dataset.randomMode === "mastered" ? "mastered" : "all";
    localStorage.setItem("sss-random-sentence-mode-v1", randomSentenceMode);
    randomSentenceCurrent = randomSentenceCandidates(randomSentenceDifficulty);
    localStorage.setItem("sss-random-sentence-current-v1", JSON.stringify(randomSentenceCurrent));
    renderRandomSentence();
    return;
  }
  if (event.target.closest("[data-random-roll]")) { rollRandomSentence(); return; }
  if (event.target.closest("[data-random-save]")) {
    if (randomSentenceCurrent?.sentence) {
      randomSentenceSaved = [{ ...randomSentenceCurrent, difficulty: randomSentenceDifficulty, date: new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) }, ...randomSentenceSaved.filter((item) => item.sentence !== randomSentenceCurrent.sentence)].slice(0, 30);
      localStorage.setItem("sss-random-sentence-saved-v1", JSON.stringify(randomSentenceSaved));
      renderRandomSentence();
    }
    return;
  }
  if (event.target.closest("[data-random-difficulty]")) { showRandomDifficulty(); return; }
  const difficultyOption = event.target.closest("[data-random-difficulty-value]");
  if (difficultyOption) {
    randomSentenceDifficulty = Number(difficultyOption.dataset.randomDifficultyValue);
    localStorage.setItem("sss-random-sentence-difficulty-v1", String(randomSentenceDifficulty));
    randomSentenceCurrent = randomSentenceCandidates(randomSentenceDifficulty);
    localStorage.setItem("sss-random-sentence-current-v1", JSON.stringify(randomSentenceCurrent));
    renderRandomSentence();
    return;
  }
  if (event.target.closest("[data-random-difficulty-close]")) { showRandomDifficulty(); return; }
  const nounTab = event.target.closest("[data-noun-tab]");
  if (nounTab) { renderNounTabPanel(nounTab.dataset.nounTab); return; }
  const verbTab = event.target.closest("[data-verb-tab]");
  if (verbTab) { renderVerbTabPanel(verbTab.dataset.verbTab); return; }
  const verbSpeakingCard = event.target.closest("[data-verb-speaking-card]");
  if (verbSpeakingCard) { renderVerbSpeakingCard(verbSpeakingCard.dataset.verbSpeakingCard); return; }
  const adjectiveTab = event.target.closest("[data-adjective-tab]");
  if (adjectiveTab) { renderAdjectiveTabPanel(adjectiveTab.dataset.adjectiveTab); return; }
  const thingsTab = event.target.closest("[data-things-tab]");
  if (thingsTab) { renderThingsTabPanel(thingsTab.dataset.thingsTab); return; }
  const thingsCard = event.target.closest("[data-things-card]");
  if (thingsCard) { renderThingsDetail(thingsCard.dataset.thingsCard); return; }
  const speakingCard = event.target.closest("[data-speaking-card]");
  if (speakingCard) { renderNounSpeakingCard(speakingCard.dataset.speakingCard); return; }
  const speakingMode = event.target.closest("[data-speaking-mode]");
  if (speakingMode && !speakingMode.hasAttribute("data-advanced-speaking-card")) { renderNounSpeakingPanel(speakingMode.dataset.speakingMode); return; }
  const advancedSpeakingCard = event.target.closest("[data-advanced-speaking-card]");
  if (advancedSpeakingCard) { renderAdvancedSpeakingCard(advancedSpeakingCard.dataset.advancedSpeakingCard, advancedSpeakingCard.dataset.speakingMode); return; }
  const nav = event.target.closest("[data-view]");
  if (nav) {
    const view = nav.dataset.view;
    showView(view);
    if (view === "weekly-plan") renderWeeklyPlan();
    if (view === "noun-cards") renderNounTabPanel("cards");
    if (view === "random-sentence") renderRandomSentence();
    if (view === "verbs") renderVerbTabPanel("cards");
    if (view === "adjectives") renderAdjectiveTabPanel("cards");
    if (view === "things-cards") renderThingsTabPanel("cards");
    if (view === "parent-speech") renderParentSpeech();
    if (view === "posy-pip") renderPosyPip();
    if (view === "noun-repeat") renderNounRepeat();
  }
  const song = event.target.closest("[data-song-sheet]");
  if (song) renderSong(song.dataset.songSheet);
  const nounPattern = event.target.closest("[data-noun-pattern]");
  if (nounPattern) renderNounPattern(nounPattern.dataset.nounPattern);
  const nounCard = event.target.closest("[data-noun-card]");
  if (nounCard) renderNounCard(nounCard.dataset.nounCard);
  const adjectiveCard = event.target.closest("[data-adjective-card]");
  if (adjectiveCard) renderAdjectiveCard(adjectiveCard.dataset.adjectiveCard);
  const toggle = event.target.closest("[data-toggle-sheet]");
  if (toggle) toggleSong(toggle.dataset.toggleSheet);
  const checkinToggle = event.target.closest("[data-toggle-checkin]");
  if (checkinToggle) {
    const key = checkinToggle.dataset.toggleCheckin;
    checkinState[key] = !checkinState[key];
    localStorage.setItem("susan-checkin-progress-v1", JSON.stringify(checkinState));
    renderSusanCheckin(key.split(":")[0]);
    if ($("#noun-tab-panel")) renderNounTabPanel("checkin");
    if ($("#verb-tab-panel")) renderVerbTabPanel("checkin");
    if ($("#adjective-tab-panel")) renderAdjectiveTabPanel("checkin");
    if ($("#things-tab-panel")) renderThingsTabPanel("checkin");
    renderRecords();
  }
  const patternToggleButton = event.target.closest("[data-toggle-pattern]");
  if (patternToggleButton) {
    const key = patternToggleButton.dataset.togglePattern;
    patternState[key] = !patternState[key];
    localStorage.setItem("sss-pattern-progress-v1", JSON.stringify(patternState));
    renderPatterns();
    renderDetails();
    if ($("#content-pack-view")?.classList.contains("active")) renderContentPack();
    if ($("#weekly-plan-view")?.classList.contains("active")) renderWeeklyPlan();
    if ($("#noun-tab-panel")) renderNounTabPanel("patterns");
    if ($("#verb-tab-panel")) renderVerbTabPanel("patterns");
    if ($("#adjective-tab-panel")) renderAdjectiveTabPanel("patterns");
    renderRecords();
    const nounView = $("#noun-pattern-view");
    if (nounView.classList.contains("active")) {
      const current = nounView.querySelector(".noun-pattern-head span")?.textContent.match(/(\d+)$/)?.[1];
      if (current) renderNounPattern(current);
    }
  }
  if (event.target.closest("[data-back]")) showView(previousView);
  if (event.target.closest("[data-back-patterns]")) showView("patterns");
  if (event.target.closest("[data-back-cards]")) { renderNounCards(); showView("noun-cards"); }
  if (event.target.closest("[data-back-noun-cards]")) { renderNounCards(); showView("noun-cards"); }
  if (event.target.closest("[data-back-things]")) { renderThingsCards(); showView("things-cards"); }
  const backParentSpeech = event.target.closest("[data-back-parent-speech]");
  if (backParentSpeech) { renderParentSpeech(); showView("parent-speech"); }
  if (event.target.closest("[data-back-noun-repeat]")) { renderNounRepeat(); showView("noun-repeat"); }
  if (event.target.closest("[data-back-posy-pip]")) { renderPosyPip(); showView("posy-pip"); }
  if (event.target.closest("[data-back-adjectives]")) { renderAdjectiveCards(); showView("adjectives"); }
  if (event.target.closest("[data-back-speaking]")) { renderNounCards(); renderNounTabPanel("speaking"); showView("noun-cards"); }
  if (event.target.closest("[data-back-verb-speaking]")) { renderVerbCards(); renderVerbTabPanel("speaking"); showView("verbs"); }
  const backAdvancedSpeaking = event.target.closest("[data-back-advanced-speaking]");
  if (backAdvancedSpeaking) { renderNounCards(); renderNounTabPanel("speaking"); renderNounSpeakingPanel(backAdvancedSpeaking.dataset.backAdvancedSpeaking); showView("noun-cards"); }
});
$("#menu-toggle").onclick = () => document.body.classList.toggle("menu-open");
$("#scrim").onclick = () => document.body.classList.remove("menu-open");

renderSidebarProgress();
renderCheckin();
renderDetails();
renderPatterns();
renderRandomSentence();
renderNounCards();
renderRecords();
renderWeeklyPlan();
renderAdditionalViews();
renderThingsCards();
renderParentSpeech();
renderPosyPip();
renderNounRepeat();
showView("checkin");

// 支持从独立页「33周SSS儿歌计划表.html」深链到指定歌曲：index.html?song=<sheet>
const deepLinkSong = new URLSearchParams(location.search).get("song")
  || (location.hash.startsWith("#song=") ? decodeURIComponent(location.hash.slice(6)) : "");
if (deepLinkSong && songBySheet.has(deepLinkSong)) renderSong(deepLinkSong);
