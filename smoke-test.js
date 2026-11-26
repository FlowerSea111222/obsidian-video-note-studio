// 离线冒烟测试：不启动 Obsidian，用 mock 验证内嵌资源与 Canvas 布局。
const fs = require("fs");
const path = require("path");
const Module = require("module");

class Dummy {}
const obsidianMock = new Proxy({
  Plugin: Dummy, ItemView: Dummy, WorkspaceLeaf: Dummy, Notice: Dummy,
  PluginSettingTab: Dummy, Setting: Dummy, Modal: Dummy, FuzzySuggestModal: Dummy,
  TFile: class TFile {}, TFolder: Dummy, TAbstractFile: Dummy,
  normalizePath: (p) => String(p).replace(/\\/g, "/"),
  requestUrl: async () => { throw new Error("network disabled in smoke test"); },
}, { get: (target, key) => key in target ? target[key] : Dummy });

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return obsidianMock;
  return originalLoad.call(this, request, parent, isMain);
};

const file = path.join(__dirname, "main.js");
let source = fs.readFileSync(file, "utf8");
source = source.replace("module.exports = VideoNoteStudio;", "module.exports = { VideoNoteStudio, qrGenerator, ASR_BRIDGE_B64 };");
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(source, file);
const { VideoNoteStudio, qrGenerator, ASR_BRIDGE_B64 } = m.exports;

const qr = qrGenerator(0, "M");
qr.addData("https://passport.bilibili.com/x/passport-login/web/qrcode/generate");
qr.make();
const svg = qr.createSvgTag(2, 0);
if (!svg.includes("<svg")) throw new Error("QR generation failed");
console.log("QR_OK", svg.length);

const asr = Buffer.from(ASR_BRIDGE_B64, "base64").toString("utf8");
if (!asr.includes("faster_whisper") || !asr.includes("OpenCC")) throw new Error("ASR embed incomplete");
fs.writeFileSync(path.join(__dirname, ".smoke-asr.py"), asr, "utf8");
console.log("ASR_EMBED_OK", asr.length);

const writes = [];
const fake = {
  app: {
    vault: {
      getAbstractFileByPath: () => null,
      createFolder: async () => {},
      create: async (p, data) => { writes.push({ p, data }); return { path: p }; },
    },
  },
};
const md = "---\ntitle: 测试\n---\n\n## 概要\n这是一个用于验证布局的摘要。\n\n## 要点\n- 第一条要点应该完整显示，而不是在两百字以后被截断。\n- 第二条要点继续说明左侧工作区需要单列布局。\n\n## 时间戳\n- [0:01](obsidian://vns?u=x&t=1) 转录不应抢占要点。";
VideoNoteStudio.prototype.makeCanvas.call(fake, "测试标题", md, "Canvas").then((canvasPath) => {
  const canvas = JSON.parse(writes[0].data);
  if (canvas.nodes.some((n) => n.x !== 0 || n.width !== 320)) throw new Error("not a narrow single column");
  if (canvas.nodes[1].text.includes("转录不应")) throw new Error("wrong section selected");
  if (!canvas.edges.every((e) => e.fromSide === "bottom" && e.toSide === "top")) throw new Error("wrong edge direction");
  console.log("CANVAS_OK", canvasPath, `nodes=${canvas.nodes.length}`, `rootHeight=${canvas.nodes[0].height}`);
}).catch((e) => { console.error(e); process.exitCode = 1; });
