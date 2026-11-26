# 提交到 Obsidian 社区插件目录 — 复制粘贴清单

> 官方流程（已核对 docs.obsidian.md）：**不支持提 PR**，只能用 community.obsidian.md 的网站表单提交。
> 需要登录一个 Obsidian 账号，并绑定 GitHub 账号做仓库所有权验证。

## 入口

https://community.obsidian.md/plugins/new

## 填表内容（直接复制）

**Repository URL**
```
https://github.com/FlowerSea111222/obsidian-video-note-studio
```

**Description**（英文，目录站用英文展示更稳妥）
```
A desktop-first video workflow for Obsidian: a detachable player window, paste-a-link to note conversion (Bilibili / YouTube / Douyin / WeChat / netdisk / web), clickable timestamps that seek the player, AI summaries and translation, image OCR, Canvas breakdown boards, book splitting, Bilibili QR sign-in for account-level video quality, and optional local magpie gateway routing with no API key.
```

**中文简介**（若表单允许中文，可替换上面）
```
独立播放器窗口 + 贴链接转笔记 + 时间戳点击跳转播放 + AI 摘要/翻译/OCR/Canvas 拆解 + 拆书 + B站扫码登录 + magpie 免 Key 路由。
```

**Categories**
```
Video
Notes
Productivity
```

## 提交前自检（都已完成）

| 项 | 状态 |
| --- | --- |
| 仓库 public | ✅ |
| README.md | ✅ 含功能表、安装、依赖、限制 |
| LICENSE（MIT） | ✅ |
| manifest.json 在默认分支 HEAD | ✅ version 0.6.1 |
| Release tag = manifest version | ✅ 0.6.1 |
| Release 资产 main.js / manifest.json / styles.css | ✅ 三个齐全 |
| id 唯一且不含 obsidian | ✅ video-note-studio |
| 无默认热键、无 window.app、日志用 console.debug | ✅ |

## 已知会被审核挑的点（如被问，这样答）

1. **`isDesktopOnly: true`** — 插件用 `child_process` 调 yt-dlp/Python 做转录，桌面专属是真实需求，不是偷懒。
2. **B站 Cookie** — 只存本地 `data.json`，不上传；README 已写明。
3. **内嵌 asr_bridge.py（Base64）** — 因为官方安装器只下发三个文件，运行时落地到临时目录调用，不是隐藏二进制。

## 提交后

自动审核会给出提示项；改完代码 → 升版本 → 发新 Release 即可，无需重新提交。审核通过前只能手动安装。
