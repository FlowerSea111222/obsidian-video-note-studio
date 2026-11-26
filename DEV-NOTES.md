# Video Note Studio —— 二次开发工作目录

上游仓库：https://github.com/FlowerSea111222/obsidian-video-note-studio
当前基线：`de3cb0a`（main 分支，v0.6.1，2026-11-26 拉取）

## 1. 目录说明

| 路径 | 作用 |
| --- | --- |
| `main.js` | **产物即源码**：单文件 CommonJS（4015 行，140 KB），插件全部逻辑都在这里，没有构建步骤 |
| `manifest.json` | 插件清单（id `video-note-studio`，v0.6.1，桌面端专用） |
| `styles.css` | 播放器与设置界面样式 |
| `asr_bridge.py` | 本地转录桥（yt-dlp → ffmpeg → faster-whisper → OpenCC 简繁统一），也内嵌了一份在 main.js |
| `smoke-test.js` | 上游自带的冒烟脚本，`node smoke-test.js` |
| `deploy.mjs` | 本机新增：把上面 4 个文件同步到 Obsidian 插件目录 |
| `README.md` / `SUBMIT-TO-COMMUNITY.md` / `LICENSE` | 上游原文（MIT） |

上游只有 `main` 一个分支、没有 tag、没有 `package.json` / `src/`，所以**二次开发直接改 `main.js`**（改动前先 `git diff`，方便对照上游）。

## 2. 安装位置（已生效）

```
C:\Users\Administrator\Documents\Obsidian Vault\.obsidian\plugins\video-note-studio\
    manifest.json  main.js  styles.css  asr_bridge.py  data.json(运行时生成)
```

Obsidian 端已做的事：`community-plugins.json` 里已追加 `"video-note-studio"`（即已启用）。
插件设置项（含 API Key、magpie 路由、习惯统计）存在**插件目录的 `data.json`**，不属于源码，改代码时不要覆盖它。

## 3. 开发 → 生效 流程

```bash
cd "D:\video note studio"
node --check main.js      # 语法检查
node deploy.mjs           # 复制到 vault 插件目录
node deploy.mjs --check   # 只校验文件齐全，不复制
```

然后回 Obsidian：`Ctrl+R`（或命令面板搜 `Reload app`）重载插件。
`deploy.mjs` 默认 vault 路径写死为上面那个，可用环境变量覆盖：

```bash
OBSIDIAN_VAULT="D:\其它 Vault" node deploy.mjs
```

## 4. 外部依赖（2026-11-26 已装齐，实测跑通）

| 依赖 | 版本 / 路径 | 状态 |
| --- | --- | --- |
| Python | 3.12.10 → `C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe` | ✅ winget 安装 |
| faster-whisper | 1.2.1（ctranslate2 4.9.1、av 19.0.2、onnxruntime 1.32.0、numpy 2.5.5） | ✅ pip（阿里云源） |
| opencc | 1.4.2（t2s 简繁统一） | ✅ pip（阿里云源） |
| yt-dlp | 2026.11.23 → `C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe` | ✅ winget 安装 |
| ffmpeg | 9.1-full_build（Gyan）→ `...\WinGet\Links\ffmpeg.exe` | ✅ winget 安装 |
| Whisper small 模型 | `C:\Users\Administrator\.cache\huggingface`（464 MB） | ✅ 已缓存 |

已写进插件设置（`data.json`）：`pythonPath` / `ytDlpPath` 用绝对路径，`asrModel=small`、`asrLanguage=zh`、`asrEnabled=true`。

实测记录：`BV1rFWY6REYD`（1:36 中文讲解）→ yt-dlp 取音频 1.7 MB → ffmpeg 16 kHz 单声道 → small/int8 出 13 条带时间戳文本，
Obsidian 内「生成笔记」成功写出 `## 时间戳`，前端 `## 概要`/`## 要点` 由 magpie 路由生成。冷启动（含 500 MB 模型下载）约 4 分钟，热跑 1 分钟级。

> ⚠️ 坑：pip 官方源可用，**清华 tuna 源会 reset**（`ConnectionResetError 10054`），本机用阿里云源
> `-i https://mirrors.aliyun.com/pypi/simple/`。
> 另：winget / Python 安装器会改用户 PATH，**已运行的 Obsidian 进程读不到新 PATH**，装完必须重启 Obsidian（或用注册表 PATH 显式起进程）。

## 5. 已知限制（上游自述，实测一致）

- B站 iframe 不暴露播放进度，时间戳用内部计时器，偏近似值；
- 抖音正文抓不到，通常只有标题/封面；
- 网盘只识别元数据与提取码，不下载；
- PDF 拆书未实现，需先转 txt/md/epub；
- 桌面端专用（依赖 Electron 的 `child_process` / `readBinary`）。

## 6. 与上游同步

```bash
git pull --rebase origin main   # 拉上游
node deploy.mjs                 # 再同步到 vault
```

本地对 `main.js` 的改动会在 rebase 时冲突，建议在自有分支上开发：

```bash
git switch -c dev
```

## 7. 已发现的上游小问题（二次开发候选）

1. `main.js:3738` —— `fm.push("transcript: " + (parts.transcript.length ? "subtitle" : ...))`：
   只要拿到任何转录就写 `transcript: subtitle`，本地 Whisper 转出来的也标成 subtitle。
   建议改成记录真实来源（`subtitle` / `whisper` / `article`）。
2. `main.js:2848-2860` 的「测试本地转录」只校验 `python` + `faster_whisper` + `opencc`，
   **不校验 `ffmpeg` / `yt-dlp`**，所以 PATH 缺 ffmpeg 时测试通过但真正转录会失败。
3. `asr_bridge.py` 里 `ffmpeg` 是裸命令名，没有配置项；PATH 变化必须重启 Obsidian，
   建议加一个 `--ffmpeg` 参数并在设置里暴露。
