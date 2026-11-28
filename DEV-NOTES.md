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

## 8. 自研功能：抖音收藏 → Obsidian 笔记

> 目标：把抖音「我的收藏」批量同步成结构化笔记（文案 + 封面 + 配图 + AI 要点 + 可选视频/转录），
> 参考实现了 yumingtao/douyin-favorites-sync、jinmm1233/douyin-knowledge-vault、
> lyxdream/obsidian-douyin-capture（前两个依赖本地 Python 后端，本插件不引入后端，全部在 Electron webview 里完成）。

### 8.1 原理（绕开签名服务的做法）

抖音的收藏接口需要签名，但**抖音自己的页面里就带着签名能力**：

```js
const fn = window.use('webSignUrl');            // 抖音内部签名入口
const { url } = await fn(unsignedUrl);          // 返回带 timestamp + x-secsdk-web-signature 的 url
await fetch(url, { method: 'POST', credentials: 'include', ... });
```

所以插件只需要一个加载了 `https://www.douyin.com/user/self?showTab=favorite_collection` 的
`<webview>`（分区 `persist:vns-douyin`，登录态持久化），然后在页内 `executeJavaScript`：

1. 从 `localStorage.SysInfo.webid`（或 `__tea_cache_tokens_*` 的 `user_unique_id`）取 `webid`；
2. 从 `document.cookie` 取 `UIFID`；
3. 组装 `COLLECTION_BASE_PARAMS`（`device_platform=webapp&aid=6383&...`）+ `webid` + `uifid`；
4. `window.use('webSignUrl')` 出签；
5. `POST https://www.douyin.com/aweme/v1/web/aweme/listcollection?<query>`，
   body `count=20&cursor=<上一页 cursor>`，header 带 `x-secsdk-csrf-token: DOWNGRADE`；
6. 响应 `aweme_list[]`（每条含 desc / author / create_time / video.play_addr / images / statistics），`has_more`、`cursor` 翻页。

**踩坑记录**：

| 现象 | 原因 / 结论 |
| --- | --- |
| `listcollection/` **带尾斜杠 → 404 `Not Found`** | 端点必须写 `.../aweme/v1/web/aweme/listcollection`（无尾斜杠） |
| `/aweme/v1/web/favorite/collect/list/` → `Unsupported path(Janus)` | 不是收藏接口，别用 |
| 出签结果里没有 `a_bogus`，只有 `timestamp` + `x-secsdk-web-signature` | 新版 secsdk 签名，照样 200，不用强求 a_bogus |
| 站外 curl / requestUrl 直连接口 | 403 `Blocked by ArgusSecurityPlugin Uifid Not Found`，**必须**在页面上下文里请求 |
| 页面上 `performance.getEntriesByType('resource')` 能直接看到页面自己的签名 URL | 调试时用它对照参数（页面 UA 是 `browser_name=Electron`） |
| 一页 20 条约 900 KB JSON | 在页内先把条目裁成精简结构再返回，避免每次回传整包 |

### 8.2 代码位置（main.js）

| 方法 / 类 | 作用 |
| --- | --- |
| `fetchDouyinFavPage(wv, cursor, count)` | 页内出签 + 拉一页收藏，返回精简 items |
| `waitFavSigner(wv, timeout)` | 轮询等 `window.use('webSignUrl')` 就绪（首次可能要登录） |
| `importFavItem(item, mode, opts)` | 单条 → 一篇笔记（下载封面/配图/视频 + 可选转录 + 可选 AI 要点） |
| `buildFavNote(item, extra)` | 笔记模板（frontmatter `douyin_id` 用于去重） |
| `ensureFavBinary(url, relPath, referer)` | 下载二进制进 vault（封面/视频），已存在跳过 |
| `loadFavIndex()/saveFavIndex()` | `.vns/douyin-favorites.json`：`{ aweme_id: notePath }` 去重索引 |
| `DouyinFavSyncModal` | 同步面板：内嵌抖音页（可登录）+ 进度 + 日志 + 停止 |
| 命令 / ribbon | `抖音：同步收藏到笔记`、ribbon `bookmark` |
| 调试协议 | `obsidian://vns?cmd=fav`（接口诊断）、`obsidian://vns?cmd=favsync&l=3&mode=heavy`（同步 N 条，可指定模式） |

### 8.3 笔记结构

```markdown
---
type: douyin
content_type: video|image
douyin_id: "7712843892600753458"
author: "渣渣辉！"
source: https://www.douyin.com/video/7712843892600753458
create_time: "2026-11-27 13:33"
favorite: true
synced: 2026-11-28
tags: [douyin, douyin-favorite, <文案里的 #话题>]
---
# 标题（文案第一句）
![[抖音收藏/附件/<id>/video.mp4]]      ← heavy 模式；light 模式放封面
> [!note] 抖音收藏 ｜ 作者 ｜ 发布时间 ｜ 时长 ｜ 👍💬⭐
## 文案
## 要点     ← AI 摘要（magpie / API）
## 配图     ← 图文笔记
## 时间戳   ← heavy 模式，Obsidian 内点击跳转播放器
```

### 8.4 设置项

收藏笔记目录（默认 `抖音收藏`）、附件目录（默认 `抖音收藏/附件`）、
同步模式（light/heavy）、每次条数（默认 20）、翻页间隔（6-12 秒随机，防风控）、
启动时自动同步（默认关，距上次 >12h 才触发）。

### 8.5 已知限制

- 收藏列表按「最近收藏」倒序，已同步的靠 `douyin_id` 跳过；如果一次翻页太多会被风控，插件会等 30 秒重试 2 次。
- heavy 模式的视频直链有时效，**必须在同一次同步里**下载/转录，隔太久会 403。
- 图文作品的图片按 `01.jpg`、`02.jpg`… 落盘，视频作品只有 `cover.jpg` + `video.mp4`。
- 没登录时接口返回空列表，面板会提示去窗口里登录。

### 8.6 自检与回归

`obsidian://vns?cmd=selftest` 会伪渲染设置页（`new VnsSettingTab(...).display()` 到游离 div），
并把节点数 / 关键方法存在性 / 索引条数写到 `%TEMP%\vns-selftest.json`，
用于改完代码后确认「设置页没炸、收藏方法和面板都在」。实测：`settingsNodes: 50`、`favIndexCount: 6`。

### 8.7 迭代（第二轮）

- 逐字稿改成折叠 callout：`> [!quote]- 视频逐字稿（N 段，点击时间戳跳转播放）`，收起不占版面。
- 常驻定时同步：`favEveryMin`（分钟，0=关闭），`registerInterval` 每分钟检查一次，到点自动打开同步面板；
  面板里用 `_favSyncing` 防重入。
- 探测协议 `obsidian://vns?cmd=probe&u=<url>`：抓页面自己发的 `/aweme/v1/web/*` 接口，用于发现「喜欢 / 作品 / 收藏夹」端点。
  实测：`/user/self?showTab=favorite` 只触发 social/count 等公共接口，**喜欢列表要页面内点 tab 才发请求**（按 URL 参数切 tab 无效），
  所以「喜欢 / 作品 / 多收藏夹」需要先做页内点击 tab 再抓，属于下一轮。

### 8.8 选片界面（DouyinFavGalleryModal）

`obsidian://vns?cmd=gallery` / ribbon 书签图标 / 命令「抖音收藏：打开选片界面」打开一张**卡片墙**：

- 顶栏：模式下拉（轻量 / 重量）、连接抖音-登录、刷新列表、生成笔记（选中数）
- 工具行：搜索（文案/作者）、筛选 chips（全部 / 未生成 / 视频 / 图文 / 已生成）、排序（收藏顺序 / 点赞 / 时长）
- 卡片：封面（本地 `附件/<id>/cover.jpg` 优先，没有就用远程 URL）、时长角标、图文角标、已生成角标、
  标题、@作者、👍💬、单条「生成 / 重新生成」「打开」（用插件播放器打开抖音页）
- 交互：点封面或标题切换勾选（右上角 checkbox），底部「全选当前 / 清空选择 / 加载更多」，
  生成时实时显示进度，完成后打「已生成」角标并写索引
- 隐藏 webview（2×2px，`opacity:.01`）常驻在容器里，专门用来出签取数，用户看不到
- 说明：一开始做成 `ItemView`（tab 视图），实测打开后 tab 被替换/丢失，改成 `Modal` 后稳定，因此现在是模态界面

已知待做：`加载更多` 在模态里要滚到底；批量生成没有失败重试；「喜欢 / 作品 / 多收藏夹」还需页内点 tab 才能取到接口。

### 8.9 第三轮：笔记精简 / 点卡片同时开笔记+播放器 / 不存附件 / 收藏夹 / 播放器控件

按用户反馈改的五件事：

1. **笔记属性只留 3 个**：`buildFavNote()` 的 frontmatter 现在只有
   `douyin_id` / `author` / `tags`（tags = `douyin` + 话题标签）。
   来源链接、发布时间、时长、点赞数等都挪进正文的 `> [!note]` callout。
2. **点卡片 = 笔记 + 播放器**：`DouyinFavGalleryModal.openItem(item)`：
   索引里有旧文件就直接打开，没有就先 `importFavItem()` 生成再打开，
   最后 `plugin.playVideoUrl('https://www.douyin.com/video/<id>')` 把右侧播放器也打开，
   与 B 站链接的体验一致。卡片的「勾选」只留给右上角 checkbox。
3. **不保存附件**：`importFavItem()` 不再调 `ensureFavBinary()`，封面/配图用远程 URL（抖音图床），
   重量模式的视频直链直接作为 `--media-url` 交给 `asr_bridge.py`，由它在临时目录下载、转完即弃，
   vault 里不再出现 `附件/<id>/`。
   （历史版本留下的 `抖音收藏/附件/` 不会被自动删除。）
4. **按收藏夹选片**：见下面 8.10。
5. **播放器可暂停/调音量**：`VideoPlayerView` 给 webview 加了一条自己画的悬浮控制条
   `.vns-wv-ctl`（`−5s` / ▶⏸ / `+5s` / 🔊 / 音量滑块），
   每 800ms `syncWebviewState()` 读一次 `JSON.stringify({p,m,vol,t,r})` 同步按钮与滑块状态；
   `webviewSeek` / `webviewTogglePlay` 改用 `webviewPickVideo()`（按面积取页面上最大的 `<video>`），
   因为抖音播放器里除了主视频还有一堆隐藏的 `<video>` 元素。

### 8.10 收藏夹（收藏合集）是怎么取到的

抖音的收藏夹**没有可用的公开接口**（这一轮逐一排除）：

- `/aweme/v1/web/collects/list/`：POST → `403 Blocked by ArgusSecurityPlugin Sign Invalid`，
  GET → 200 但返回 835KB 的 SPA HTML（说明这条路径在服务端不是 API）。
- `/aweme/v1/web/collects/video/list/`、`/collects/detail/`、`/collects/aweme/list/`：
  404 `Unsupported path(Janus)` 或回落 HTML。
- `/aweme/v1/web/aweme/listcollection` 加 `collection_folder_id` / `folder_id` / `collects_id` /
  `collect_type=2`（query 和 body 都试过）返回的永远是默认那 10 条，接口不认收藏夹参数。
- 收藏夹页的 URL 参数（`collection_folder_id=`）也无效；`/collection/<id>`、`/folder/<id>` 都不对。

最终走**页面内操作 + React 数据 + detail 接口**这条路，实测可用：

1. 打开 `https://www.douyin.com/user/self?showTab=favorite_collection&showSubTab=favorite_folder`，
   等 `ul[data-e2e="scroll-list"] > li` 出现（约 5–20s）。
2. 每个 `li` 的 React fiber（`__reactFiber$…` 向上 `return.memoizedProps`）里有
   `{collectionFolderId, collectionFolderName, videoTotal, cover}` —— 这就是收藏夹清单，
   `loadDouyinFolders(wv)` 读出来填进下拉框。
3. 进收藏夹必须点**封面区** `.pZnOIHUE`（点 li、点名字 `.rHOsituu`、点 ⋯ 都没反应，
   页面不跳转也不发请求）；点完网格出现，`loadDouyinFolderIds(wv, i)` 收集页面上
   `a[href*="/video/"]` 里的 id，并向下滚几屏多拿一些。
4. 收藏夹内网格条目的 React props 里读不到 aweme 对象，所以改用
   `/aweme/v1/web/aweme/detail/?…&aweme_id=<id>`（页内 `fetch`，带 cookie，无需额外签名）
   逐条取详情，`fetchDouyinDetails(wv, ids)` 归一化成和列表页同样的结构。

UI 上：选片界面顶栏多了一个「收藏夹」下拉（`全部收藏` + 各收藏夹及数量），
切到某个收藏夹时用一个**独立的隐藏 webview**（`this.fwv`）去点，不打断「全部收藏」那条列表。

已知限制：收藏夹一次性只取当前一屏（滚动抓到 14–35 条，取决于该夹的懒加载），
没有做无限翻页；收藏夹列表也只取到当前可见的 10 个，没做滚动加载。
