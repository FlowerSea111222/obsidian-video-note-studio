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

## 安装（手动）

1. 把 `manifest.json`、`main.js`、`styles.css` 放进 `你的vault/.obsidian/plugins/video-note-studio/`
2. Obsidian → 设置 → 第三方插件 → 关闭安全模式 → 启用 **Video Note Studio**

## 外部依赖

| 依赖 | 用途 | 是否必需 |
| --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 抓 B站/YouTube 字幕 | 转录才需要；不填则只保留播放与元数据 |
| OpenAI 兼容模型 API | 摘要 / 翻译 / 拆书 | 摘要类功能需要；播放与转笔记不依赖 |

ffmpeg 仅 yt-dlp 的音频场景需要，本插件不直接调用。

## 已知限制（都是真的）

- **B站 多数视频没有 CC/AI 字幕**，`yt-dlp` 只能列出弹幕流，所以「B站 视频自动出逐句转录」这件事不成立；插件会如实写「没拿到字幕」，不会编造。
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
