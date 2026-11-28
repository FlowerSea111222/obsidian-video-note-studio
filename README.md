# Video Note Studio

一个把「看视频 / 读网页 / 拆书」合到一条流水线上的 Obsidian 插件：**独立播放器窗口** + **贴链接转笔记** + **时间戳** + **模型摘要/翻译/OCR/Canvas 拆解**。

> 面向桌面版 Obsidian。播放器不内嵌在笔记正文里，而是占用一个可任意拖动的独立 leaf，方便和笔记并排编辑。

## 功能

| # | 能力 | 怎么用 |
| --- | --- | --- |
| 1 | 链接视频 + 本地视频播放 | 命令 `打开视频播放器窗口` → 顶栏粘贴链接，或点「本地文件」 |
| 2 | B站 / 抖音 / 公众号 / 网盘 / 网页 贴链接转笔记 | 命令 `贴链接生成笔记` / `从剪贴板链接生成笔记` |
| 3 | 看视频时打时间戳 | 播放器里点 `⏱ 时间戳`，自动插到绑定/当前笔记的 `## 时间戳` 下 |
| 4 | 播放器独立窗口 | 设置里可选 分屏 / 新标签页 / 独立窗口 |
| 5 | 接模型 API 自动摘要 | 设置里填 Base URL + Key + 模型名，生成笔记时自动写 `## 概要`/`## 要点` |
| 6 | 翻译 | 设置开「自动翻译」；或对任意笔记用 `把当前笔记翻译成中文` |
| 7 | 图文 OCR | 命令 `图片 OCR 转笔记`（需要设置里填**视觉模型**） |
| 8 | 生成 Canvas 拆解 | 命令 `把当前笔记拆成 Canvas 白板`，或在设置里开「生成笔记时自动画 Canvas」 |
| 9 | 使用习惯记录 | 自动统计命令频次，命令 `生成使用习惯笔记` 落成一份 md |
| 10 | 兼容 Obsidian Web Clipper | 设置开关；生成的笔记沿用 `source/created/tags: clippings` 字段，另有命令 `补全 Clippings 里的视频剪藏` |
| 11 | 拆书 | 命令 `拆书：书籍转章节笔记`，支持 `md / txt / epub`，每章一篇 + 索引 |
| 12 | B站扫码登录 | 播放器或设置里点「B站登录」，手机扫码确认；登录后播放器使用账号可用清晰度（大会员画质仍需对应账号） |
| 13 | magpie 路由 | 设置里开「使用 magpie 路由」，直连本机 magpie 网关，无需 API Key；模型可下拉选择 |
| 14 | 简繁体统一 | 转录/摘要/翻译/拆书统一输出简体中文（Whisper 经 OpenCC 转换） |
| 15 | 抖音内嵌播放 | 抖音用 Electron `webview` 打开官方播放页（iframe 会被反嵌拦死），可从页面里打时间戳、跳转进度；顺手抓 Cookie 与播放直链 |
| 17 | 网页视频内嵌播放 | 普通网页 / 公众号 / 网盘链接用 webview 打开（iframe 常被 X-Frame-Options 挡），页面里有 <video> 就能打时间戳、抓媒体直链 |
| 16 | 分享短链解析 | `v.douyin.com/xxx`、`b23.tv/xxx` 自动展开成短视频/视频页链接，播放与生成笔记都认；直接贴**整段分享文案**也行（自动从乱码/话题标签/尾注里抠出链接） |

## 安装（手动）

1. 把 `manifest.json`、`main.js`、`styles.css` 放进 `你的vault/.obsidian/plugins/video-note-studio/`
2. Obsidian → 设置 → 第三方插件 → 关闭安全模式 → 启用 **Video Note Studio**

## 外部依赖

| 依赖 | 用途 | 是否必需 |
| --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 抓 B站/YouTube 字幕 | 转录才需要；不填则只保留播放与元数据 |
| OpenAI 兼容模型 API | 摘要 / 翻译 / 拆书 | 摘要类功能需要；播放与转笔记不依赖 |

ffmpeg 仅 yt-dlp 的音频场景需要，本插件不直接调用。

## 时间戳跳转播放

笔记里生成的每一行都是 `- [0:29](obsidian://vns?u=…&t=29)`：

- 在**阅读视图**里单击时间戳 → 插件打开播放器窗口（或复用已开的那个），加载这个链接并跳到 29 秒开始播。
- 在**编辑/实时预览**里，Obsidian 默认要把链接当作普通文本编辑，需要 `Ctrl/Cmd + 单击`（或临时切到阅读视图）。
- 设置里可切换「时间戳点击行为」：`在播放器里跳转播放`（默认，走 `obsidian://vns`）或 `打开网页定位`（写成 B站/YouTube 的 `?t=` 链接）。

各平台定位方式：

| 类型 | 定位实现 |
| --- | --- |
| 本地视频 / 直链 mp4 | 直接设置 `<video>.currentTime` 并播放 |
| YouTube | 通过官方 iframe `postMessage` 发 `seekTo` |
| B站 | 播放器不对外暴露 seek 接口，改为带 `&t=秒&autoplay=1` 重载 iframe（实测 `t` 参数生效） |
| 抖音 | 在 `webview` 里执行 JS 设置 `video.currentTime`，进度按 1 秒轮询回读 |
| 网页 / 网盘 | 无时间轴，链接照旧指向原文 |

> 实测依据：`player.bilibili.com/player.html?...&autoplay=0&t=60` 加载后 `video.currentTime === 60`，说明 B站 播放器确实认 `t` 参数。



## 抖音怎么用

抖音把 `X-Frame-Options` + JS 反嵌一起上，`iframe` 和内嵌 API 全部报废（官方 `open.douyin.com/player` 只给 SDK 演示页），所以插件换成 **Electron `webview`**：它是独立 guest 进程，天然绕过这些限制。

1. 粘贴 `v.douyin.com/…` 短链或 `douyin.com/video/<id>` → 播放器用 webview 打开官方播放页。
2. 首次可能需要点一下页面里的播放键 / 登录（登录态存在 `persist:vns-douyin` 分区里，重启不丢）。
3. 页面里的 `<video>` 一就绪，插件就抓到 **播放直链 + Cookie**：直链给 Whisper 转录用（不再受 yt-dlp「需要新鲜 Cookie」的折磨），Cookie 给 yt-dlp 取标题/时长/点赞。
4. 点 `⏱ 打时间戳`、点笔记里的时间戳跳转，全部按 webview 里的真实进度走。
5. 命令面板 `抖音：打开页面抓取 Cookie` 可以单独刷新 Cookie；设置页可关闭「抖音使用内嵌浏览器播放」。

## 本地转录（asr_bridge.py）

B站 绝大多数视频没有 CC/AI 字幕，yt-dlp 只列得出弹幕流。所以插件带了一个本地转录桥（已内嵌进 `main.js`，不依赖额外文件）：

```
yt-dlp 下音频 → ffmpeg 解成 16 kHz PCM → faster-whisper 逐段识别 → OpenCC 简繁统一 → JSON 回给插件
```

- 文件：插件目录下的 `asr_bridge.py`（也内嵌在 `main.js` 里，官方安装器只装 `main.js`/`manifest.json`/`styles.css` 也能跑）
- 依赖：本机 Python 3 + `faster-whisper`（`pip install faster-whisper`），外加 `yt-dlp` 与 `ffmpeg`
- 设置项：`没有字幕时用本地 Whisper 转录`、`Python 路径`、`Whisper 模型`、`转录语言`
- 实测：4 分 54 秒的 B站 视频，`small` 模型在 CPU 上约 1 分钟出 29 行带时间戳文本

## 已知限制（都是真的）

- **B站 多数视频没有 CC/AI 字幕**，`yt-dlp` 只能列出弹幕流；插件会自动回退到本地 Whisper 转录，因此需要本机装好 Python + faster-whisper，没装时笔记里会写明卡在哪一步，不会给你一篇空壳。
- **B站 iframe 不暴露播放进度**，时间戳按钮对 B站 使用的是内部计时器（近似值），可手动修正；YouTube 走官方 `postMessage` 取值，本地文件直接读 `<video>.currentTime`，都准确。
- **抖音** 页面强依赖 JS，`requestUrl` 只拿得到分享页骨架；播放靠 `webview`，转录靠播放器抓到的 CDN 直链（直链有有效期，过期重新打开播放页即可）。yt-dlp 取元数据需要新鲜 Cookie，插件会自动从 webview 抓。
- **网盘** 只做元数据与提取码识别（`提取码：xxxx`），不做下载。
- **PDF 拆书** 未实现，请先转成 txt/md/epub。
- 桌面端专用：`child_process` 与 `readBinary` 依赖 Electron。

## 参考的开源项目

本插件为独立实现（未复制第三方代码），思路参考了：

- [aidenlx/media-extended](https://github.com/aidenlx/media-extended) —— 媒体播放 + 时间戳笔记的产品形态
- [larryxu001/video-transcript-obsidian-fetch](https://github.com/larryxu001/video-transcript-obsidian-fetch) —— 字幕优先、无字幕再转写的取舍
- [vancoder4-cyber/anycontent-obsidian-importer](https://github.com/vancoder4-cyber/anycontent-obsidian-importer) —— 多平台链接统一成 Markdown 的思路
- [DiTingAI/obsidian-aiditing](https://github.com/DiTingAI/obsidian-aiditing) —— B站 时间戳跳转的写法

## 开发

无构建步骤，`main.js` 即产物（CommonJS）：

```bash
node --check main.js
```

## License

MIT

## 抖音沉浸播放（默认开启）

抖音播放页自带顶部导航、右侧评论、底部推荐，直接塞进播放器只看得到一小块。插件默认开「沉浸」，目标是**整个播放区只剩视频本体**：

1. 沿 `<video>` 的祖先链清掉 `transform / filter` 等会让 `position: fixed` 失效的属性（否则视频浮不出容器，页面头尾照旧露着），并给链上每一级抬 `z-index`，保证视频真的浮到最上层；
2. 把播放链之外的所有兄弟节点（页面头尾 / 评论区 / 播放器控制条）`visibility: hidden`；
3. 再垫一层全屏黑幕兜底。

- 播放器右上角：`− / + / 适配 / 比例 / 沉浸 / 全屏`
- **比例**：默认开启，播放区缩放成视频的真实比例，画面 `contain` 完整显示——**一根像素都不裁**，上下黑边随之消失；再点恢复固定播放区（设置里也有「按视频比例适配」开关）
- 沉浸时点画面 = 暂停 / 续播（页面自己的控制条已隐藏）
- 退出沉浸 = 重载页面回到完整网页；设置里可关掉「抖音默认沉浸（只留视频）」
- 抖音 SPA 会重渲染（切下个视频、评论区懒加载），注入的脚本每秒自动补妆，不会看两眼就打回原形
- 缩放默认 0.8（普通网页 1.0），会记住上次的值
- 播放区高度从固定 16:9 改成 `72vh`，竖屏/高页面也能看全