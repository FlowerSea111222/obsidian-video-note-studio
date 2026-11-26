const obsidian = require("obsidian");
const {
  Plugin, ItemView, WorkspaceLeaf, Notice, PluginSettingTab, Setting, Modal,
  FuzzySuggestModal, TFile, TFolder, TAbstractFile, normalizePath, requestUrl,
} = obsidian;

let cp = null;
try { cp = require("child_process"); } catch (e) { cp = null; }

const VIEW_TYPE_PLAYER = "vns-player";
const VIDEO_EXT = ["mp4", "webm", "mkv", "mov", "m4v", "ogv", "avi", "flv", "ts", "mp3", "m4a", "wav", "flac", "ogg"];
const BOOK_EXT = ["md", "txt", "epub"];

/* ============================ utils ============================ */

function pad2(n) { return String(n).padStart(2, "0"); }

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

function decodeEnt(str) {
  return String(str)
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function htmlToText(html) {
  let s = String(html || "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "- ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEnt(s);
  s = s.replace(/[ \t\u00a0]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function slug(name) {
  return String(name || "untitled")
    .replace(/[\\/:*?"<>|#^\[\]\r\n\t]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";
}

function fmValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, "'").replace(/\r?\n/g, " ");
  return `"${s}"`;
}

function parseVtt(text) {
  const out = [];
  let t = 0;
  const seen = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.includes("-->")) {
      const m = line.match(/(\d+):(\d+):(\d+)[.,](\d+)/);
      if (m) t = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
      continue;
    }
    if (!line || /^\d+$/.test(line) || /^(WEBVTT|NOTE|Kind:|Language:)/.test(line)) continue;
    const clean = decodeEnt(line.replace(/<[^>]+>/g, "")).trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push([t, clean]);
  }
  return out;
}

function mergeLines(items, minChars = 24, maxGap = 8, maxChars = 140) {
  const merged = [];
  for (const [start, text] of items) {
    if (merged.length) {
      const [lastStart, lastText] = merged[merged.length - 1];
      const ended = /[。？！?!.；;]$/.test(lastText) && lastText.length >= minChars;
      if (!ended && lastText.length < maxChars && lastText.length < minChars * 4 &&
          start - lastStart <= maxGap && lastText.length + text.length <= maxChars) {
        merged[merged.length - 1] = [lastStart, `${lastText} ${text}`.trim()];
        continue;
      }
    }
    merged.push([start, text]);
  }
  return merged;
}

function detectLink(raw) {
  const url = String(raw || "").trim();
  let m;
  if ((m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{6,})/))) {
    const p = url.match(/[?&]p=(\d+)/);
    return { kind: "bilibili", id: m[1], page: p ? +p[1] : 1, url };
  }
  if ((m = url.match(/youtube\.com\/(?:watch\?.*v=|shorts\/)([0-9A-Za-z_-]{11})/)) ||
      (m = url.match(/youtu\.be\/([0-9A-Za-z_-]{11})/))) {
    return { kind: "youtube", id: m[1], url };
  }
  if ((m = url.match(/douyin\.com\/video\/(\d+)/))) return { kind: "douyin", id: m[1], url };
  if (/v\.douyin\.com/.test(url) || /b23\.tv/.test(url)) return { kind: "short", id: "", url };
  if (/mp\.weixin\.qq\.com/.test(url)) return { kind: "weixin", id: "", url };
  if (/(pan\.baidu\.com|aliyundrive\.com|alipan\.com|pan\.quark\.cn|123pan\.com|pan\.xunlei\.com|cloud\.189\.cn)/.test(url)) {
    return { kind: "netdisk", id: "", url };
  }
  if (/\.(mp4|webm|mkv|mov|m4v|mp3|m4a|flac|wav|ogg)(\?|$)/i.test(url)) return { kind: "direct", id: "", url };
  if (/^https?:\/\//i.test(url)) return { kind: "web", id: "", url };
  return { kind: "file", id: "", url };
}

function embedFor(link, startAt) {
  const t = Math.max(0, Math.floor(startAt || 0));
  const auto = t > 0 ? 1 : 0;
  if (link.kind === "bilibili") {
    return `https://player.bilibili.com/player.html?bvid=${link.id}&page=${link.page || 1}`
      + `&high_quality=1&danmaku=0&autoplay=${auto}${t ? `&t=${t}` : ""}`;
  }
  if (link.kind === "youtube") {
    return `https://www.youtube.com/embed/${link.id}?enablejsapi=1&rel=0`
      + `${t ? `&start=${t}&autoplay=1` : ""}`;
  }
  if (link.kind === "douyin") {
    return `https://open.douyin.com/player/video?vid=${link.id}&autoplay=${auto}`;
  }
  return null;
}

/** 生成能在 Obsidian 内部跳转播放的时间戳链接（走插件注册的 obsidian://vns 协议） */
function tsLink(link, sec, mode) {
  const s = Math.max(0, Math.floor(sec || 0));
  if (mode === "browser") return seekUrl(link, s);
  const u = encodeURIComponent(link.url || "");
  const p = link.kind === "bilibili" && link.page > 1 ? `&p=${link.page}` : "";
  return `obsidian://vns?u=${u}&t=${s}${p}`;
}

function seekUrl(link, sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  if (link.kind === "bilibili") {
    const base = (link.url || "").split("?")[0];
    return `${base}?t=${s}${link.page > 1 ? `&p=${link.page}` : ""}`;
  }
  if (link.kind === "youtube") return `https://youtu.be/${link.id}?t=${s}`;
  return link.url;
}

async function ensureFolder(app, path) {
  const p = normalizePath(path);
  if (!p) return;
  if (app.vault.getAbstractFileByPath(p)) return;
  try { await app.vault.createFolder(p); } catch (e) { /* exists */ }
}

function uniquePath(app, folder, base) {
  const dir = normalizePath(folder);
  let path = normalizePath(`${dir}/${base}.md`);
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${dir}/${base} (${n}).md`);
    n += 1;
  }
  return path;
}

const DEFAULT_SETTINGS = {
  inboxFolder: "Clippings",
  playerSplit: "split",
  timestampMode: "inapp",
  ytDlpPath: "yt-dlp",
  asrEnabled: true,
  pythonPath: "python",
  asrModel: "small",
  asrLanguage: "",
  lastAsrError: "",
  subsLangs: "zh-Hans,zh-CN,zh,en",
  llmBaseUrl: "https://api.deepseek.com/v1",
  llmApiKey: "",
  llmModel: "deepseek-chat",
  visionModel: "",
  autoSummarize: true,
  autoTranslate: false,
  translateTo: "zh",
  autoCanvas: false,
  canvasFolder: "Canvas",
  ocrFolder: "Clippings/OCR",
  bookFolder: "Books",
  clipperCompat: true,
  clipperTags: "clippings",
  habitNote: "_meta/使用习惯.md",
  habitEnabled: true,
  habits: { counters: {}, events: [] },
};

/* ============================ 播放器视图 ============================ */

class VideoPlayerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.link = null;
    this.notePath = null;
    this.videoEl = null;
    this.iframeEl = null;
    this.lastKnownTime = 0;
    this.timer = null;
    this.onMessage = this.onMessage.bind(this);
  }

  getViewType() { return VIEW_TYPE_PLAYER; }
  getDisplayText() { return this.link ? `▶ ${this.link.title || this.link.url}` : "Video Note Studio"; }
  getIcon() { return "play-circle"; }

  async onOpen() {
    window.addEventListener("message", this.onMessage);
    this.render();
    const pending = this.plugin.pendingUrl;
    if (pending) { this.plugin.pendingUrl = null; await this.load(pending); }
  }

  async onClose() {
    window.removeEventListener("message", this.onMessage);
    if (this.timer) clearInterval(this.timer);
  }

  onMessage(ev) {
    try {
      const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      if (data && data.info && typeof data.info.currentTime === "number") {
        this.lastKnownTime = data.info.currentTime;
        this.updateClock();
      }
    } catch (e) { /* 非 JSON 消息忽略 */ }
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("vns-root");

    // ─── 顶部工具栏 ───
    const toolbar = root.createDiv({ cls: "vns-toolbar" });

    // 第一行：URL 输入 + 加载按钮
    const inputRow = toolbar.createDiv({ cls: "vns-input-row" });
    this.urlInput = inputRow.createEl("input", {
      cls: "vns-url", type: "text",
      placeholder: "粘贴链接（B站 / YouTube / 抖音 / 公众号 / 网盘 / 网页）或本地路径…",
    });
    this.urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") this.load(this.urlInput.value); });

    const btnGroup = inputRow.createDiv({ cls: "vns-btn-group" });
    const btn = (parent, label, fn, cls) => {
      const b = parent.createEl("button", { cls: `vns-btn ${cls || ""}`, text: label });
      b.addEventListener("click", fn);
      return b;
    };
    btn(btnGroup, "加载", () => this.load(this.urlInput.value), "is-accent");
    btn(btnGroup, "本地", () => this.plugin.pickLocalVideo((f) => this.loadFile(f)));

    // 第二行：元信息 + 操作按钮
    const actionRow = toolbar.createDiv({ cls: "vns-action-row" });
    this.metaEl = actionRow.createDiv({ cls: "vns-meta" });
    this.metaEl.innerHTML = '<span class="vns-meta-placeholder">暂无视频</span>';

    const actionBtns = actionRow.createDiv({ cls: "vns-btn-group" });
    btn(actionBtns, "⏱ 时间戳", () => this.captureTimestamp(), "is-accent");
    btn(actionBtns, "笔记", () => this.openNote());
    btn(actionBtns, "生成笔记", () => this.plugin.importLink(this.link ? this.link.url : this.urlInput.value, { player: this }), "is-ghost");

    // ─── 播放器舞台 ───
    this.stage = root.createDiv({ cls: "vns-stage" });
    this.stage.createDiv({ cls: "vns-empty", text: "粘贴链接或选择本地视频开始" });

    // ─── 底部状态栏 ───
    const statusBar = root.createDiv({ cls: "vns-statusbar" });
    this.clockEl = statusBar.createEl("span", { cls: "vns-time", text: "0:00 / 0:00" });
    this.statusEl = statusBar.createEl("span", { cls: "vns-status", text: "就绪" });
  }

  updateMeta(link) {
    if (!this.metaEl) return;
    if (!link) {
      this.metaEl.innerHTML = '<span class="vns-meta-placeholder">暂无视频</span>';
      return;
    }
    const parts = [];
    if (link.title) parts.push(`<span class="vns-meta-title">${link.title}</span>`);
    const metaItems = [];
    if (link.author) metaItems.push(link.author);
    if (link.duration) metaItems.push(fmtTime(link.duration));
    if (link.published) metaItems.push(link.published);
    if (metaItems.length) parts.push(`<span class="vns-meta-sub">${metaItems.join(" · ")}</span>`);
    this.metaEl.innerHTML = parts.join("");
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text || "");
  }

  async load(input, startAt) {
    const raw = String(input || "").trim();
    if (!raw) return;
    this.plugin.recordHabit("player-load");
    const link = detectLink(raw);
    link.url = raw;
    if (link.kind === "file") {
      const f = this.app.vault.getAbstractFileByPath(normalizePath(raw));
      if (f instanceof TFile) return this.loadFile(f, startAt);
      new Notice("找不到这个本地文件，试着用「本地文件」按钮选择");
      return;
    }
    await this.fillMeta(link);
    this.attach(link, startAt);
  }

  loadFile(file, startAt) {
    const link = { kind: "file", id: file.path, url: file.path, title: file.basename, file };
    this.attach(link, startAt);
  }

  async fillMeta(link) {
    try {
      const meta = await this.plugin.fetchMeta(link);
      Object.assign(link, meta);
    } catch (e) { /* 元数据拿不到不影响播放 */ }
  }

  attach(link, startAt) {
    this.link = link;
    this.notePath = null;
    this.lastKnownTime = 0;
    if (this.timer) clearInterval(this.timer);
    this.stage.empty();
    this.videoEl = null;
    this.iframeEl = null;
    this.setStatus("加载中…");
    this.updateMeta(link);

    if (link.kind === "file") {
      const f = link.file || this.app.vault.getAbstractFileByPath(normalizePath(link.url));
      if (!(f instanceof TFile)) { this.stage.createDiv({ cls: "vns-empty", text: "文件不可读" }); this.setStatus("文件不可读"); return; }
      this.videoEl = this.stage.createEl("video", { attr: { controls: "true", playsinline: "true" } });
      this.videoEl.src = this.app.vault.getResourcePath(f);
      this.urlInput.value = f.path;
      this.videoEl.addEventListener("loadedmetadata", () => {
        this.setStatus("就绪");
        this.updateMeta(link);
      });
      this.videoEl.addEventListener("play", () => this.setStatus("播放中"));
      this.videoEl.addEventListener("pause", () => this.setStatus("已暂停"));
    } else {
      const src = embedFor(link, startAt);
      if (!src) {
        if (link.kind === "direct") {
          this.videoEl = this.stage.createEl("video", { attr: { controls: "true", playsinline: "true" } });
          this.videoEl.src = link.url;
          this.videoEl.addEventListener("play", () => this.setStatus("播放中"));
          this.videoEl.addEventListener("pause", () => this.setStatus("已暂停"));
        } else {
          this.stage.createDiv({ cls: "vns-empty", text: `${link.kind} 类型的链接无法内嵌播放，可「生成笔记」后跳浏览器观看` });
        }
      } else {
        this.iframeEl = this.stage.createEl("iframe", {
          attr: { src, allow: "autoplay; fullscreen; picture-in-picture", allowfullscreen: "true", referrerpolicy: "no-referrer" },
        });
      }
      this.urlInput.value = link.url;
    }

    this.setStatus("就绪");
    this.timer = setInterval(() => this.tick(), 500);
    this.updateClock();
  }

  seek(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    if (!this.link) return;
    this.lastKnownTime = s;
    if (this.videoEl) {
      try { this.videoEl.currentTime = s; this.videoEl.play().catch(() => {}); } catch (e) { /* ignore */ }
      this.updateClock();
      return;
    }
    if (this.iframeEl) {
      if (this.link.kind === "youtube") {
        this.iframeEl.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "seekTo", args: [s, true] }), "*");
      } else if (this.link.kind === "bilibili") {
        // B站 播放器不对外暴露 seek 接口，只能带 t 参数重载
        this.iframeEl.src = embedFor(this.link, s);
      }
    }
  }

  tick() {
    if (this.videoEl) { this.lastKnownTime = this.videoEl.currentTime || 0; }
    else if (this.iframeEl && this.link && this.link.kind === "youtube") {
      try {
        this.iframeEl.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "*");
      } catch (e) { /* 跨域忽略 */ }
    } else if (this.iframeEl) {
      this.lastKnownTime += 0.5; // B站 iframe 不暴露进度，用计时器近似
    }
    this.updateClock();
  }

  updateClock() {
    if (!this.clockEl) return;
    const t = this.currentTime();
    const dur = this.videoEl ? this.videoEl.duration : (this.link ? this.link.duration || 0 : 0);
    const tStr = fmtTime(t);
    const dStr = dur && !isNaN(dur) ? fmtTime(dur) : "";
    this.clockEl.textContent = dStr ? `${tStr} / ${dStr}` : tStr;
  }

  currentTime() {
    if (this.videoEl) return this.videoEl.currentTime || 0;
    return this.lastKnownTime || 0;
  }

  async captureTimestamp() {
    if (!this.link) { new Notice("先加载一个视频"); return; }
    const t = await this.plugin.askTime(this.currentTime(), this.videoEl ? this.videoEl.duration : 0);
    if (t === null) return;
    const url = tsLink(this.link, t, this.plugin.settings.timestampMode);
    const line = `- [${fmtTime(t)}](${url}) `;
    await this.plugin.insertIntoActiveNote(line, this.link);
    this.plugin.recordHabit("timestamp");
    new Notice(`已插入时间戳 ${fmtTime(t)}`);
  }

  async openNote() {
    const path = this.notePath || this.plugin.noteIndex.get(this.link ? this.link.url : "");
    if (!path) { new Notice("还没绑定笔记，先点「生成笔记」"); return; }
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) await this.app.workspace.getLeaf(true).openFile(f);
  }
}

/* ============================ 设置页 ============================ */

class VnsSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Video Note Studio" });
    const s = this.plugin.settings;

    const text = (name, key, desc, ph) => new Setting(containerEl).setName(name).setDesc(desc || "")
      .addText((t) => t.setPlaceholder(ph || "").setValue(s[key] ?? "")
        .onChange(async (v) => { s[key] = v.trim(); await this.plugin.saveSettings(); }));

    const toggle = (name, key, desc) => new Setting(containerEl).setName(name).setDesc(desc || "")
      .addToggle((t) => t.setValue(!!s[key])
        .onChange(async (v) => { s[key] = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "笔记与目录" });
    text("收件箱目录", "inboxFolder", "贴链接生成的笔记落到这里", "Clippings");
    text("Canvas 目录", "canvasFolder", "自动生成的拆解白板", "Canvas");
    text("OCR 目录", "ocrFolder", "图片转写的笔记", "Clippings/OCR");
    text("拆书目录", "bookFolder", "拆书结果输出位置", "Books");
    new Setting(containerEl).setName("播放器打开方式").setDesc("split 分屏 / tab 新标签页 / window 独立窗口")
      .addDropdown((d) => d.addOption("split", "分屏").addOption("tab", "新标签页").addOption("window", "独立窗口")
        .setValue(s.playerSplit).onChange(async (v) => { s.playerSplit = v; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("时间戳点击行为").setDesc("笔记里的 [0:29] 点下去要做什么")
      .addDropdown((d) => d.addOption("inapp", "在播放器里跳转播放").addOption("browser", "打开网页定位")
        .setValue(s.timestampMode || "inapp").onChange(async (v) => { s.timestampMode = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "抓取与转录" });
    text("yt-dlp 路径", "ytDlpPath", "用于取 B站/YouTube 字幕；留空不做转录", "yt-dlp");
    text("优先字幕语言", "subsLangs", "逗号分隔，按顺序尝试", "zh-Hans,zh-CN,zh,en");
    toggle("没有字幕时用本地 Whisper 转录", "asrEnabled", "调用插件自带的 asr_bridge.py，需要本机已装 Python + faster-whisper");
    text("Python 路径", "pythonPath", "调用 asr_bridge.py 的解释器", "python");
    text("Whisper 模型", "asrModel", "tiny / base / small / medium，越大越准越慢", "small");
    text("转录语言", "asrLanguage", "留空自动检测，或填 zh / en", "");
    new Setting(containerEl).setName("测试本地转录").setDesc("检查 Python、faster-whisper 与 asr_bridge.py 是否就位")
      .addButton((b) => b.setButtonText("运行测试").onClick(async () => {
        b.setDisabled(true);
        try { new Notice(await this.plugin.testBridge(), 12000); } finally { b.setDisabled(false); }
      }));

    containerEl.createEl("h3", { text: "模型 API" });
    text("Base URL", "llmBaseUrl", "OpenAI 兼容，例如 https://api.deepseek.com/v1", "https://api.deepseek.com/v1");
    text("API Key", "llmApiKey", "只存在本机 data.json", "");
    text("对话模型", "llmModel", "用于摘要/翻译/拆书/Canvas", "deepseek-chat");
    text("视觉模型", "visionModel", "用于 OCR；留空则 OCR 不可用", "gpt-4o-mini");
    toggle("生成笔记时自动摘要", "autoSummarize");
    toggle("自动翻译为中文", "autoTranslate", "英文视频/文章会追加中文译文");
    text("翻译目标语言", "translateTo", "", "zh");
    toggle("生成笔记时自动画 Canvas", "autoCanvas");

    containerEl.createEl("h3", { text: "Obsidian Web Clipper 兼容" });
    toggle("兼容 Web Clipper 剪藏", "clipperCompat", "生成/补全时沿用 clippings 字段与标签");
    text("剪藏标签", "clipperTags", "写入 frontmatter 的 tags", "clippings");

    containerEl.createEl("h3", { text: "使用习惯" });
    toggle("记录使用习惯", "habitEnabled", "把常用操作沉淀成一份笔记，供后续开发参考");
    text("习惯笔记路径", "habitNote", "", "_meta/使用习惯.md");

    new Setting(containerEl).setName("清空使用习惯").setDesc("只清空统计，不删除已生成的笔记")
      .addButton((b) => b.setButtonText("清空").setWarning().onClick(async () => {
        s.habits = { counters: {}, events: [] };
        await this.plugin.saveSettings();
        new Notice("使用习惯已清空");
      }));
  }
}

/* ============================ 模型 & yt-dlp ============================ */

async function chat(settings, messages, opts = {}) {
  if (!settings.llmApiKey) throw new Error("还没配置模型 API Key（设置 → Video Note Studio）");
  const url = `${String(settings.llmBaseUrl).replace(/\/+$/, "")}/chat/completions`;
  const res = await requestUrl({
    url,
    method: "POST",
    throw: false,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.llmApiKey}` },
    body: JSON.stringify({
      model: opts.model || settings.llmModel,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens || 2048,
    }),
  });
  if (res.status >= 400) throw new Error(`模型接口 ${res.status}: ${String(res.text || "").slice(0, 200)}`);
  const data = res.json || JSON.parse(res.text || "{}");
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  return (msg && msg.content ? msg.content : "").trim();
}

function runProcess(bin, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!cp) return reject(new Error("当前环境不能启动外部进程（仅桌面版支持）"));
    let out = "";
    let err = "";
    let timer = null;
    const p = cp.spawn(bin, args, { cwd, windowsHide: true });
    if (timeoutMs) {
      timer = setTimeout(() => {
        try { p.kill(); } catch (e) { /* ignore */ }
        reject(new Error(`外部进程超时（${Math.round(timeoutMs / 1000)}s）`));
      }, timeoutMs);
    }
    p.stdout.on("data", (d) => { out += d.toString("utf8"); });
    p.stderr.on("data", (d) => { err += d.toString("utf8"); });
    p.on("error", (e) => { if (timer) clearTimeout(timer); reject(new Error(`无法运行 ${bin}：${e.message}`)); });
    p.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error((err || `退出码 ${code}`).trim().slice(-800)));
    });
  });
}

/* ============================ 拆书 ============================ */

function parseEpub(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder("utf-8");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是合法的 EPUB（找不到 zip 目录）");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    files.push({ name, method, csize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  const readEntry = (entry) => {
    const lo = entry.localOff;
    const nameLen = view.getUint16(lo + 26, true);
    const extraLen = view.getUint16(lo + 28, true);
    const start = lo + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + entry.csize);
    if (entry.method === 0) return new TextDecoder("utf-8").decode(raw);
    return require("zlib").inflateRawSync(raw).toString("utf8");
  };
  const chapters = [];
  for (const f of files) {
    if (!/\.x?html?$/i.test(f.name)) continue;
    try {
      const text = htmlToText(readEntry(f));
      if (text.length > 200) chapters.push({ name: f.name, text });
    } catch (e) { /* 跳过坏条目 */ }
  }
  chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return chapters;
}

function splitChapters(text) {
  const parts = String(text).split(/\n(?=#{1,2}\s|第[一二三四五六七八九十百零\d]+[章回节]\s?)/);
  return parts.filter((p) => p.trim().length > 200).map((p) => {
    const first = p.trim().split(/\r?\n/)[0].replace(/^#+\s*/, "").slice(0, 60);
    return { name: first || "章节", text: p.trim() };
  });
}

/* ============================ 选择器 / 弹窗 ============================ */

class LocalVideoSuggest extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder("选一个本地视频/音频文件"); }
  getItems() {
    return this.app.vault.getFiles().filter((f) => VIDEO_EXT.includes((f.extension || "").toLowerCase()));
  }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

class FilePickModal extends FuzzySuggestModal {
  constructor(app, exts, onPick, hint) {
    super(app);
    this.exts = exts;
    this.onPick = onPick;
    this.setPlaceholder(hint || "选一个文件");
  }
  getItems() { return this.app.vault.getFiles().filter((f) => this.exts.includes((f.extension || "").toLowerCase())); }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

class UrlModal extends Modal {
  constructor(app, onSubmit, initial) {
    super(app);
    this.onSubmit = onSubmit;
    this.initial = initial || "";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "贴一个链接" });
    const input = contentEl.createEl("input", { type: "text", cls: "vns-url" });
    input.style.width = "100%";
    input.value = this.initial;
    input.focus();
    const row = contentEl.createDiv();
    row.style.marginTop = "12px";
    const ok = row.createEl("button", { cls: "mod-cta", text: "生成笔记" });
    ok.addEventListener("click", () => { this.close(); this.onSubmit(input.value.trim()); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { this.close(); this.onSubmit(input.value.trim()); } });
  }
  onClose() { this.contentEl.empty(); }
}

class TimeModal extends Modal {
  constructor(app, current, duration, resolve) {
    super(app);
    this.current = current;
    this.duration = duration;
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `打时间戳（当前 ${fmtTime(this.current)}）` });
    const input = contentEl.createEl("input", { type: "text" });
    input.style.width = "100%";
    input.value = fmtTime(this.current);
    input.focus();
    input.select();
    contentEl.createDiv({ cls: "vns-setting-note", text: "支持 90 / 1:30 / 1:02:03 三种写法" }).style.marginTop = "8px";
    const row = contentEl.createDiv();
    row.style.marginTop = "12px";
    row.createEl("button", { cls: "mod-cta", text: "插入" }).addEventListener("click", () => this.finish(input.value));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.finish(input.value); });
  }
  finish(value) {
    this.done = true;
    const parts = String(value).trim().split(":").map((x) => parseInt(x, 10) || 0);
    let sec = 0;
    if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
    else sec = parts[0];
    this.close();
    this.resolve(sec);
  }
  onClose() { this.contentEl.empty(); if (!this.done) this.resolve(null); }
}

/* ============================ 主插件 ============================ */

class VideoNoteStudio extends Plugin {
  async onload() {
    await this.loadSettings();
    this.noteIndex = new Map();
    this.pendingUrl = null;

    this.registerView(VIEW_TYPE_PLAYER, (leaf) => new VideoPlayerView(leaf, this));
    this.registerObsidianProtocolHandler("vns", (params) => this.handleVnsProtocol(params));
    this.bridgePath = this.resolveBridgePath();
    this.addRibbonIcon("play-circle", "打开视频播放器", () => this.openPlayer());
    this.addSettingTab(new VnsSettingTab(this.app, this));

    const cmd = (id, name, fn) => this.addCommand({ id, name, callback: () => { this.recordHabit(id); Promise.resolve(fn()).catch((e) => this.fail(e)); } });

    cmd("open-player", "打开视频播放器窗口", () => this.openPlayer());
    cmd("import-link", "贴链接生成笔记", () => this.importLinkPrompt());
    cmd("import-clipboard", "从剪贴板链接生成笔记", async () => {
      const text = await navigator.clipboard.readText();
      await this.importLink(text.trim());
    });
    cmd("add-timestamp", "给当前笔记打时间戳", () => this.timestampToNote());
    cmd("summarize-note", "用模型总结当前笔记", () => this.summarizeCurrentNote());
    cmd("translate-note", "把当前笔记翻译成中文", () => this.translateCurrentNote());
    cmd("ocr-image", "图片 OCR 转笔记", () => this.ocrPrompt());
    cmd("make-canvas", "把当前笔记拆成 Canvas 白板", () => this.canvasFromActiveNote());
    cmd("distill-book", "拆书：书籍转章节笔记", () => this.distillBookPrompt());
    cmd("enrich-clippings", "补全 Clippings 里的视频剪藏", () => this.enrichClippings());
    cmd("write-habits", "生成使用习惯笔记", () => this.writeHabitNote());

    this.app.workspace.onLayoutReady(() => this.rebuildIndex());
    this.registerEvent(this.app.vault.on("rename", (f, old) => this.reindexFile(f, old)));
  }

  onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE_PLAYER); }

  resolveBridgePath() {
    try {
      const nodePath = require("path");
      const fs = require("fs");
      const adapter = this.app.vault.adapter;
      const base = adapter && typeof adapter.getBasePath === "function" ? adapter.getBasePath() : null;
      const cfg = this.app.vault.configDir || ".obsidian";
      const candidates = [];
      if (base) candidates.push(nodePath.join(base, cfg, "plugins", this.manifest.id, "asr_bridge.py"));
      if (this.manifest.dir) {
        if (base && !nodePath.isAbsolute(this.manifest.dir)) {
          candidates.push(nodePath.join(base, this.manifest.dir, "asr_bridge.py"));
        }
        candidates.push(nodePath.resolve(this.manifest.dir, "asr_bridge.py"));
      }
      for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
      }
      console.warn("[vns] 没找到 asr_bridge.py，候选路径：", candidates);
      return candidates[0] || "";
    } catch (e) {
      console.warn("[vns] 解析 bridge 路径失败", e);
      return "";
    }
  }

  pythonCandidates() {
    const list = [this.settings.pythonPath, "python", "python3", "py"];
    try {
      const fs = require("fs");
      const nodePath = require("path");
      const roots = [
        process.env.LOCALAPPDATA && nodePath.join(process.env.LOCALAPPDATA, "Programs", "Python"),
        "C:\\Python312",
        "C:\\Python311",
        "C:\\Program Files\\Python312",
      ].filter(Boolean);
      for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        for (const d of fs.readdirSync(root)) {
          const exe = nodePath.join(root, d, "python.exe");
          try { if (fs.existsSync(exe)) list.push(exe); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
    return [...new Set(list.filter(Boolean))];
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); }

  fail(e) {
    console.error("[video-note-studio]", e);
    new Notice(`出错了：${e && e.message ? e.message : e}`, 8000);
  }

  /* ---------- 播放器 ---------- */
  async openPlayer() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAYER)[0];
    if (!leaf) {
      const mode = this.settings.playerSplit === "window" ? "window" : this.settings.playerSplit === "tab" ? "tab" : "split";
      leaf = this.app.workspace.getLeaf(mode);
      await leaf.setViewState({ type: VIEW_TYPE_PLAYER, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  async testBridge() {
    if (!cp) return "当前环境起不了外部进程（仅桌面版）";
    const fs = require("fs");
    const nodePath = require("path");
    const script = this.bridgePath;
    if (!script || !fs.existsSync(script)) return `找不到 asr_bridge.py：${script || "(空)"}`;
    for (const bin of this.pythonCandidates()) {
      try {
        const out = await runProcess(bin,
          ["-c", "import sys,faster_whisper;print('ok python',sys.version.split()[0],'faster-whisper',faster_whisper.__version__)"],
          nodePath.dirname(script), 60000);
        return `${bin} 可用 → ${out.trim()}`;
      } catch (e) {
        if (!/ENOENT|not found|不是内部或外部命令/i.test(e.message)) return `${bin} 不可用 → ${e.message}`;
      }
    }
    return "找不到可用的 Python，请把「Python 路径」填成 python.exe 的完整路径";
  }

  async handleVnsProtocol(params) {
    const u = (params && params.u) || "";
    const t = Math.max(0, parseInt((params && params.t) || "0", 10) || 0);
    if (!u) return;
    this.recordHabit("jump-timestamp");
    const leaf = await this.openPlayer();
    const view = leaf && leaf.view;
    if (!(view instanceof VideoPlayerView)) return;
    if (!view.link || view.link.url !== u) {
      if (view.urlInput) view.urlInput.value = u;
      await view.load(u, t);
    } else {
      view.seek(t);
    }
    if (t > 0) new Notice(`已跳转到 ${fmtTime(t)}`, 2000);
  }

  pickLocalVideo(cb) { new LocalVideoSuggest(this.app, cb).open(); }

  askTime(current, duration) {
    return new Promise((resolve) => new TimeModal(this.app, current, duration, resolve).open());
  }

  async insertIntoActiveNote(line, link) {
    let file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      const path = link && this.noteIndex.get(link.url);
      if (path) file = this.app.vault.getAbstractFileByPath(path);
    }
    if (!file) {
      if (!link) throw new Error("没有可用笔记，先生成一篇");
      file = await this.importLink(link.url);
    }
    const add = (data) => {
      const marker = "## 时间戳";
      if (data.includes(marker)) return `${data.trimEnd()}\n${line}\n`;
      return `${data.trimEnd()}\n\n${marker}\n\n${line}\n`;
    };
    if (this.app.vault.process) await this.app.vault.process(file, add);
    else {
      const cur = await this.app.vault.read(file);
      await this.app.vault.modify(file, add(cur));
    }
  }

  async timestampToNote() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAYER)[0];
    if (leaf && leaf.view instanceof VideoPlayerView) return leaf.view.captureTimestamp();
    const sec = await this.askTime(0, 0);
    if (sec === null) return;
    await this.insertIntoActiveNote(`- [${fmtTime(sec)}]() `, null);
  }

  /* ---------- 元数据 / 转录 ---------- */
  async requestJson(url, headers) {
    const res = await requestUrl({ url, method: "GET", throw: false, headers: headers || {} });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return res.json || JSON.parse(res.text || "{}");
  }

  async requestHtml(url) {
    const res = await requestUrl({
      url, method: "GET", throw: false,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Obsidian", Referer: url },
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return res.text || "";
  }

  async fetchMeta(link) {
    const meta = { title: link.url, author: "", published: "", duration: 0, description: "", extra: "" };
    try {
      if (link.kind === "bilibili") {
        const j = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${link.id}`);
        const d = j.data || {};
        meta.title = d.title || meta.title;
        meta.author = (d.owner && d.owner.name) || "";
        meta.duration = d.duration || 0;
        meta.published = d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : "";
        meta.description = d.desc || "";
        if (link.page > 1 && d.pages && d.pages[link.page - 1]) {
          meta.extra = d.pages[link.page - 1].part || "";
        }
        if (d.pages && d.pages.length > 1) {
          meta.pages = d.pages.map((p, i) => `${i + 1}. ${p.part || `P${i + 1}`}`);
        }
        if (d.stat) {
          meta.stats = `播放 ${d.stat.view || 0} ｜ 点赞 ${d.stat.like || 0} ｜ 弹幕 ${d.stat.danmaku || 0}`;
        }
        if (Array.isArray(d.tags) && d.tags.length) meta.tagList = d.tags;
        return meta;
      }
      if (link.kind === "youtube") {
        const j = await this.requestJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`);
        meta.title = j.title || meta.title;
        meta.author = j.author_name || "";
        return meta;
      }
      if (link.kind === "netdisk" || link.kind === "weixin" || link.kind === "web" || link.kind === "douyin" || link.kind === "short") {
        const html = await this.requestHtml(link.url);
        const pick = (re) => { const m = html.match(re); return m ? decodeEnt(m[1]).trim() : ""; };
        meta.title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
          pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)/i) ||
          pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || meta.title;
        meta.author = pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i);
        meta.description = pick(/<meta[^>]+(?:property|name)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i);
        meta.html = html;
        const code = html.match(/(?:提取码|密码|pwd|password)\s*[:：=]?\s*([0-9a-zA-Z]{4})/i);
        if (code) meta.extra = `提取码：${code[1]}`;
      }
    } catch (e) {
      meta.error = e.message;
    }
    return meta;
  }

  async fetchTranscript(link) {
    if (!cp || !this.settings.ytDlpPath) return [];
    if (!["bilibili", "youtube", "douyin", "direct"].includes(link.kind)) return [];
    const os = require("os");
    const pathApi = require("path");
    const fs = require("fs");
    const tmp = fs.mkdtempSync(pathApi.join(os.tmpdir(), "vns-"));
    try {
      await runProcess(this.settings.ytDlpPath, [
        "--skip-download", "--write-subs", "--write-auto-subs",
        "--sub-langs", this.settings.subsLangs || "zh-Hans,zh,en",
        "--sub-format", "vtt", "--no-playlist", "--no-warnings",
        "-o", pathApi.join(tmp, "sub.%(ext)s"), link.url,
      ], tmp);
      const files = fs.readdirSync(tmp).filter((f) => f.endsWith(".vtt"));
      if (!files.length) return [];
      const raw = fs.readFileSync(pathApi.join(tmp, files[0]), "utf8");
      return mergeLines(parseVtt(raw));
    } catch (e) {
      console.warn("[vns] 字幕获取失败", e.message);
      return [];
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  async localTranscript(link) {
    if (!cp || !this.settings.asrEnabled) {
      this.settings.lastAsrError = "本地转录开关没打开";
      return [];
    }
    const fs = require("fs");
    const nodePath = require("path");
    const script = this.bridgePath;
    if (!script || !fs.existsSync(script)) {
      this.settings.lastAsrError = `找不到 asr_bridge.py（manifest.dir=${this.manifest.dir || "?"}）`;
      console.warn("[vns]", this.settings.lastAsrError);
      await this.saveSettings();
      return [];
    }
    let lastErr = "";
    for (const bin of this.pythonCandidates()) {
      try {
        const out = await runProcess(bin, [
          script, "--url", link.url,
          "--model", this.settings.asrModel || "small",
          "--language", this.settings.asrLanguage || "",
          "--ytdlp", this.settings.ytDlpPath || "yt-dlp",
        ], nodePath.dirname(script), 30 * 60 * 1000);
        const line = String(out).trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
        const parsed = JSON.parse(line);
        if (parsed.error) throw new Error(parsed.error);
        this.settings.lastAsrError = "";
        await this.saveSettings();
        const segs = (parsed.segments || []).map((x) => [Number(x[0]), String(x[1])]);
        if (!segs.length) {
          this.settings.lastAsrError = `识别到 0 段语音（语言检测 ${parsed.language || "?"}），这个视频大概率没人声/只有配乐`;
          await this.saveSettings();
          return [];
        }
        return segs;
      } catch (e) {
        lastErr = `${bin} → ${e.message}`;
        console.warn("[vns] 本地转录尝试失败", lastErr);
        if (!/ENOENT|not found|不是内部或外部命令/i.test(e.message)) break;
      }
    }
    this.settings.lastAsrError = lastErr;
    await this.saveSettings();
    new Notice(`本地转录失败：${lastErr}`, 10000);
    return [];
  }

  /* ---------- 模型能力 ---------- */
  async summarize(meta, text) {
    const head = `标题：${meta.title}\n来源：${meta.author || "未知"}\n\n正文/转录：\n${text.slice(0, 12000)}`;
    return chat(this.settings, [
      { role: "system", content: "你是严谨的中文笔记助手。只依据给定内容，不编造。输出 Markdown。" },
      { role: "user", content: `${head}\n\n请输出两节：\n## 概要\n2-4 句，说清这段内容到底在讲什么。\n## 要点\n3-7 条，每条具体到观点/步骤/结论，禁止写「介绍了…」。` },
    ]);
  }

  async translate(text) {
    const out = [];
    const chunks = String(text).match(/[\s\S]{1,4000}/g) || [];
    for (const c of chunks) {
      out.push(await chat(this.settings, [
        { role: "system", content: `把下面的内容翻译成${this.settings.translateTo || "中文"}，保留时间戳与分段，不要解释。` },
        { role: "user", content: c },
      ]));
    }
    return out.join("\n\n");
  }

  async noteText() {
    const f = this.app.workspace.getActiveFile();
    if (!f) throw new Error("先打开一篇笔记");
    return { file: f, text: await this.app.vault.read(f) };
  }

  async summarizeCurrentNote() {
    const { file, text } = await this.noteText();
    const body = text.replace(/^---[\s\S]*?---/, "").trim();
    const md = await this.summarize({ title: file.basename }, body);
    await this.app.vault.process(file, (d) => `${d.trimEnd()}\n\n${md}\n`);
    new Notice("已追加 AI 摘要");
  }

  async translateCurrentNote() {
    const { file, text } = await this.noteText();
    const body = text.replace(/^---[\s\S]*?---/, "").trim().slice(0, 8000);
    const tr = await this.translate(body);
    await this.app.vault.process(file, (d) => `${d.trimEnd()}\n\n## 译文\n\n${tr}\n`);
    new Notice("已追加译文");
  }

  /* ---------- 贴链接 → 笔记 ---------- */
  async importLinkPrompt() { new UrlModal(this.app, (u) => this.importLink(u)).open(); }

  async importLink(rawUrl, opts = {}) {
    const url = String(rawUrl || "").trim();
    if (!url) return null;
    const link = detectLink(url);
    link.url = url;
    new Notice(`解析 ${link.kind} 链接…`);

    const meta = await this.fetchMeta(link);
    let transcript = [];
    if (["bilibili", "youtube", "douyin", "direct"].includes(link.kind)) {
      transcript = await this.fetchTranscript(link);
      if (!transcript.length && this.settings.asrEnabled) {
        new Notice("没有平台字幕，改用本地 Whisper 转录（可能要 1-3 分钟）…", 6000);
        transcript = await this.localTranscript(link);
      }
    }
    let article = "";
    if (meta.html && ["weixin", "web", "netdisk", "douyin"].includes(link.kind)) {
      article = htmlToText(meta.html).slice(0, 20000);
    }
    const bodyText = transcript.length ? transcript.map((x) => x[1]).join("\n") : article;

    let summary = "";
    if (this.settings.autoSummarize && this.settings.llmApiKey && bodyText) {
      try { summary = await this.summarize(meta, bodyText); } catch (e) { summary = `> 摘要生成失败：${e.message}`; }
    }

    const md = this.buildNote(link, meta, { transcript, article, summary });
    await ensureFolder(this.app, this.settings.inboxFolder);
    const path = uniquePath(this.app, this.settings.inboxFolder, slug(meta.title));
    const file = await this.app.vault.create(path, md);
    this.noteIndex.set(url, path);

    if (opts.player instanceof VideoPlayerView) {
      opts.player.notePath = path;
      if (!opts.player.link) opts.player.attach(link);
    }
    if (this.settings.autoCanvas) {
      try { await this.makeCanvas(meta.title, md, this.settings.canvasFolder); } catch (e) { console.warn(e); }
    }
    new Notice(`已生成笔记：${path}`, 6000);
    return file;
  }

  buildNote(link, meta, parts) {
    const now = new Date();
    const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const tags = ["videos"];
    if (this.settings.clipperCompat) tags.push(this.settings.clipperTags || "clippings");

    const fm = ["---", `title: ${fmValue(meta.title)}`, `source: ${fmValue(link.url)}`];
    if (meta.author) fm.push(`author: [${fmValue(meta.author)}]`);
    fm.push(`platform: ${link.kind}`);
    if (link.id) fm.push(`video_id: ${link.id}`);
    if (meta.published) fm.push(`published: ${meta.published}`);
    if (meta.duration) fm.push(`duration: ${fmValue(fmtTime(meta.duration))}`);
    if (this.settings.clipperCompat) fm.push("created: " + today);
    fm.push("transcript: " + (parts.transcript.length ? "subtitle" : parts.article ? "article" : "none"));
    fm.push("tags:");
    for (const t of tags) fm.push(`  - ${t}`);
    if (meta.extra) fm.push(`extra: ${fmValue(meta.extra)}`);
    fm.push("---", "");

    const body = [];
    const embed = embedFor(link);
    body.push(`> [!info] 播放`);
    body.push(`> 用命令 **Video Note Studio: 打开视频播放器窗口**，把这个链接贴进去即可独立窗口观看：`);
    body.push(`> \`${link.url}\``);
    body.push("");

    const metaLine = [];
    if (meta.author) metaLine.push(`**作者**：${meta.author}`);
    if (meta.duration) metaLine.push(`**时长**：${fmtTime(meta.duration)}`);
    if (meta.stats) metaLine.push(meta.stats);
    if (meta.extra) metaLine.push(meta.extra);
    if (metaLine.length) body.push(metaLine.join(" ｜ "), "");

    if (meta.description) {
      body.push("## 简介", "", meta.description.trim().slice(0, 2000), "");
    }
    if (meta.tagList && meta.tagList.length) {
      body.push("## 标签", "", meta.tagList.map((t) => `\`${t}\``).join(" "), "");
    }
    if (meta.pages && meta.pages.length) {
      body.push("## 分P", "", ...meta.pages.map((p) => `- ${p}`), "");
    }
    if (parts.summary) {
      body.push(parts.summary.trim(), "");
    } else if (parts.transcript.length) {
      body.push("> [!note] 没配模型 API Key，所以没有自动摘要；下面是逐句转录。", "");
    }
    if (parts.article) {
      body.push("## 正文", "", parts.article.trim().slice(0, 12000), "");
    }
    body.push("## 时间戳", "");
    if (parts.transcript.length) {
      for (const [t, text] of parts.transcript) {
        body.push(`- [${fmtTime(t)}](${tsLink(link, t, this.settings.timestampMode)}) ${text}`);
      }
    } else {
      body.push("> [!warning] 这篇笔记没能拿到正文，原因逐条列在下面：", "");
      body.push("- **平台字幕**：没有。B站 多数视频只提供弹幕流，没有 CC / AI 字幕，yt-dlp 抓不到文本。");
      body.push(`- **本地转录**：${this.settings.asrEnabled ? "已开启但失败" : "未开启——去「设置 → 本地转录」打开它"}。`);
      if (this.settings.lastAsrError) {
        body.push(`  - 具体报错：\`${String(this.settings.lastAsrError).slice(0, 300)}\``);
      }
      body.push("- **AI 摘要**：需要填模型 API Key 才会生成。");
      body.push("");
      body.push(meta.description ? "简介已写在上面，其余只有链接与元数据。" : "只能记录链接与元数据。");
    }
    body.push("", "## 原文", "", link.url, "");
    return fm.join("\n") + body.join("\n");
  }

  /* ---------- Canvas ---------- */
  async makeCanvas(title, markdown, folder) {
    const bullets = String(markdown).split(/\r?\n/)
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, "").replace(/\[[^\]]*\]\([^)]*\)/g, "").trim())
      .filter(Boolean).slice(0, 14);
    const nid = () => `n${Math.random().toString(36).slice(2, 10)}`;
    const nodes = [];
    const edges = [];
    const rootId = nid();
    nodes.push({ id: rootId, type: "text", text: `# ${title}`, x: 0, y: 0, width: 320, height: 140, color: "4" });
    bullets.forEach((t, i) => {
      const id = nid();
      const col = i % 2;
      nodes.push({ id, type: "text", text: t.slice(0, 200), x: 420 + col * 360, y: Math.floor(i / 2) * 180, width: 330, height: 140, color: "1" });
      edges.push({ id: nid(), fromNode: rootId, toNode: id, fromSide: "right", toSide: "left" });
    });
    await ensureFolder(this.app, folder);
    const path = uniquePath(this.app, folder, `${slug(title)}-拆解`).replace(/\.md$/, ".canvas");
    await this.app.vault.create(path, JSON.stringify({ nodes, edges }, null, 2));
    new Notice(`已生成 Canvas：${path}`, 6000);
    return path;
  }

  async canvasFromActiveNote() {
    const { file, text } = await this.noteText();
    await this.makeCanvas(file.basename, text, this.settings.canvasFolder);
  }

  /* ---------- 拆书 ---------- */
  async distillBookPrompt() {
    new FilePickModal(this.app, BOOK_EXT, (f) => this.distillBook(f).catch((e) => this.fail(e)), "选一本书（md / txt / epub）").open();
  }

  async distillBook(file) {
    if (!this.settings.llmApiKey) throw new Error("拆书需要模型 API Key");
    new Notice(`读取《${file.basename}》…`);
    let chapters = [];
    if ((file.extension || "").toLowerCase() === "epub") {
      const buf = await this.app.vault.readBinary(file);
      chapters = parseEpub(buf).map((c) => ({ name: `${file.basename} · ${c.name}`, text: c.text }));
    } else {
      const text = await this.app.vault.read(file);
      chapters = splitChapters(text);
      if (!chapters.length) chapters = [{ name: file.basename, text }];
    }
    if (!chapters.length) throw new Error("没能切出章节");
    const outDir = `${this.settings.bookFolder}/${slug(file.basename)}`;
    await ensureFolder(this.app, outDir);
    const index = [`# 《${file.basename}》拆解`, "", `- 章节数：${chapters.length}`, `- 生成时间：${new Date().toLocaleString()}`, "", "## 章节", ""];
    let n = 0;
    for (const ch of chapters) {
      n += 1;
      new Notice(`拆解 ${n}/${chapters.length}…`, 1500);
      let md = "";
      try {
        md = await chat(this.settings, [
          { role: "system", content: "你是精读助手。只依据给定原文，不编造，输出 Markdown。" },
          { role: "user", content: `原文（章节：${ch.name}）：\n${ch.text.slice(0, 14000)}\n\n请输出：\n## 一句话总结\n## 核心论点\n（3-5 条，每条附原文关键句）\n## 概念与人物\n## 可执行启发\n（2-4 条）` },
        ], { maxTokens: 2500 });
      } catch (e) {
        md = `> 本章摘要生成失败：${e.message}`;
      }
      const head = `---\ntitle: ${fmValue(ch.name)}\nbook: ${fmValue(file.basename)}\nchapter: ${n}\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags:\n  - book-notes\n---\n\n`;
      const path = uniquePath(this.app, outDir, `${pad2(n)} ${slug(ch.name)}`);
      await this.app.vault.create(path, head + md + "\n");
      index.push(`- [[${path.replace(/\.md$/, "")}|${headingOf(ch.name)}]]`);
    }
    await this.app.vault.create(uniquePath(this.app, outDir, "00 索引"), index.join("\n") + "\n");
    new Notice(`拆书完成：${outDir}`, 8000);
    this.recordHabit("distill-book");
  }

  /* ---------- OCR ---------- */
  async ocrPrompt() {
    new FilePickModal(this.app, ["png", "jpg", "jpeg", "webp", "gif", "bmp"], (f) => this.ocrImage(f).catch((e) => this.fail(e)), "选一张图片").open();
  }

  async ocrImage(file) {
    if (!this.settings.visionModel) throw new Error("先在设置里填「视觉模型」");
    const buf = await this.app.vault.readBinary(file);
    const b64 = Buffer.from(buf).toString("base64");
    const ext = (file.extension || "png").toLowerCase().replace("jpg", "jpeg");
    const md = await chat(this.settings, [{
      role: "user",
      content: [
        { type: "text", text: "把图片里的文字完整提取出来，保留标题层级和列表结构；如果有表格用 Markdown 表格。只输出内容，不要解释。" },
        { type: "image_url", image_url: { url: `data:image/${ext};base64,${b64}` } },
      ],
    }], { model: this.settings.visionModel, maxTokens: 3000 });

    await ensureFolder(this.app, this.settings.ocrFolder);
    const head = `---\ntitle: ${fmValue(file.basename)}\nsource: ${fmValue(file.path)}\ntype: ocr\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags:\n  - ocr\n---\n\n![[${file.name}]]\n\n`;
    const path = uniquePath(this.app, this.settings.ocrFolder, `${slug(file.basename)}-OCR`);
    await this.app.vault.create(path, head + md + "\n");
    new Notice(`OCR 完成：${path}`, 6000);
  }

  /* ---------- Web Clipper 兼容 ---------- */
  async rebuildIndex() {
    this.noteIndex.clear();
    for (const f of this.app.vault.getMarkdownFiles()) {
      try {
        const head = await this.app.vault.cachedRead(f);
        if (!/^source:/m.test(head)) continue;
        const m = head.match(/^source:\s*"?([^"\n]+)"?/m);
        if (!m) continue;
        const url = m[1].trim();
        if (/bilibili\.com|youtube\.com|youtu\.be|douyin\.com/.test(url)) this.noteIndex.set(url, f.path);
      } catch (e) { /* ignore */ }
    }
    console.log(`[vns] 索引到 ${this.noteIndex.size} 篇视频笔记`);
  }

  reindexFile() { /* 重命名后索引会在下次启动重建，这里保持轻量 */ }

  async enrichClippings() {
    const folder = this.settings.inboxFolder;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(`${folder}/`));
    let done = 0;
    for (const f of files) {
      if (done >= 15) break;
      const text = await this.app.vault.cachedRead(f);
      if (!/^source:/m.test(text)) continue;
      if (/^## 时间戳/m.test(text)) continue;
      const m = text.match(/^source:\s*"?([^"\n]+)"?/m);
      if (!m) continue;
      const link = detectLink(m[1]);
      if (!["bilibili", "youtube", "douyin"].includes(link.kind)) continue;
      link.url = m[1].trim();
      new Notice(`补全 ${f.basename}…`, 1500);
      const transcript = await this.fetchTranscript(link);
      if (!transcript.length) continue;
      const section = ["", "## 时间戳", "", ...transcript.map(([t, s]) => `- [${fmtTime(t)}](${tsLink(link, t, this.settings.timestampMode)}) ${s}`), ""].join("\n");
      await this.app.vault.process(f, (d) => `${d.trimEnd()}\n${section}`);
      done += 1;
    }
    new Notice(done ? `已补全 ${done} 篇剪藏` : "没有需要补全的剪藏（或都没有字幕）", 6000);
  }

  /* ---------- 使用习惯 ---------- */
  recordHabit(kind) {
    if (!this.settings.habitEnabled) return;
    const h = this.settings.habits || { counters: {}, events: [] };
    h.counters[kind] = (h.counters[kind] || 0) + 1;
    h.events = [{ t: new Date().toISOString(), kind }].concat(h.events || []).slice(0, 200);
    this.settings.habits = h;
    clearTimeout(this._habitTimer);
    this._habitTimer = setTimeout(() => this.saveSettings().catch(() => {}), 2000);
  }

  async writeHabitNote() {
    const h = this.settings.habits || { counters: {}, events: [] };
    const rows = Object.entries(h.counters || {}).sort((a, b) => b[1] - a[1]);
    const lines = [
      `# 使用习惯`,
      "",
      `> 由 Video Note Studio 自动统计，最近更新 ${new Date().toLocaleString()}`,
      "",
      "## 功能使用频次",
      "",
      "| 操作 | 次数 |",
      "| --- | --- |",
      ...rows.map(([k, v]) => `| ${k} | ${v} |`),
      "",
      "## 最近操作",
      "",
      ...(h.events || []).slice(0, 30).map((e) => `- ${String(e.t).replace("T", " ").slice(0, 16)} · ${e.kind}`),
      "",
      "## 给后续开发的提示",
      "",
      ...(rows.length
        ? [`- 用得最多的是 \`${rows[0][0]}\`（${rows[0][1]} 次），优先打磨这条路径。`,
           `- 冷门操作：${rows.filter((r) => r[1] <= 1).map((r) => `\`${r[0]}\``).join("、") || "暂无"}，考虑合并或下线。`]
        : ["- 还没有统计数据，用几次功能后再生成。"]),
      "",
    ];
    await ensureFolder(this.app, (this.settings.habitNote || "").split("/").slice(0, -1).join("/") || ".");
    const existing = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.habitNote));
    if (existing) await this.app.vault.modify(existing, lines.join("\n"));
    else await this.app.vault.create(normalizePath(this.settings.habitNote), lines.join("\n"));
    new Notice(`已更新习惯笔记：${this.settings.habitNote}`, 6000);
  }
}

function headingOf(name) { return String(name).replace(/[#\[\]|]/g, "").slice(0, 60); }

module.exports = VideoNoteStudio;
