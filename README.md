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
| 抖音 / 网页 / 网盘 | 无时间轴，链接照旧指向原文 |

> 实测依据：`player.bilibili.com/player.html?...&autoplay=0&t=60` 加载后 `video.currentTime === 60`，说明 B站 播放器确实认 `t` 参数。



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
- **抖音** 页面强依赖 JS，`requestUrl` 抓不到正文，通常只能拿到标题/封面；有 yt-dlp 时可尝试取字幕。
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
