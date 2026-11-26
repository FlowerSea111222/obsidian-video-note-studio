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

## 4. 外部依赖现状（本机检测结果，2026-11-26）

| 依赖 | 现状 | 影响 |
| --- | --- | --- |
| `yt-dlp` | ❌ 未安装（不在 PATH） | 抓不到 B站/YouTube 字幕 |
| `ffmpeg` | ❌ 未安装 | yt-dlp 音频转码失败 |
| `python` | ❌ 只有 `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`（应用商店占位符，子进程返回 9009） | 本地 Whisper 转录起不来 |
| `faster-whisper` | ❌ 未安装 | 同上 |

补齐命令（管理员 PowerShell，按需）：

```powershell
winget install -e --id Python.Python.3.12
winget install -e --id yt-dlp.yt-dlp
winget install -e --id Gyan.FFmpeg
python -m pip install -U faster-whisper
```

装完在插件设置里把「Python 路径」填成真实解释器（如 `C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe`），
点「测试本地转录」确认 Python / faster-whisper / asr_bridge.py 三项都就位。
模型第一次用 `small` 会在 `~/.cache/huggingface` 下载约 500 MB。

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
