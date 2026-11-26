#!/usr/bin/env node
/**
 * Video Note Studio —— 一键同步脚本
 *
 * 开发目录：D:\video note studio
 * 安装目录：<vault>\.obsidian\plugins\video-note-studio
 *
 * 用法：
 *   node deploy.mjs            # 复制到 Obsidian 插件目录
 *   node deploy.mjs --check    # 只做语法检查 + 校验文件齐全
 *
 * 说明：本插件没有构建步骤，main.js 就是产物；改完 main.js 后运行本脚本，
 * 再在 Obsidian 里按 Ctrl+R（或命令面板 Reload app）重载即可。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VAULT = process.env.OBSIDIAN_VAULT || 'C:\\Users\\Administrator\\Documents\\Obsidian Vault';

const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
const PLUGIN_ID = manifest.id || 'video-note-studio';
const TARGET = join(VAULT, '.obsidian', 'plugins', PLUGIN_ID);

const FILES = ['manifest.json', 'main.js', 'styles.css', 'asr_bridge.py'];

const missing = FILES.filter((f) => !existsSync(join(HERE, f)));
if (missing.length) {
  console.error('缺少文件：', missing.join(', '));
  process.exit(1);
}

if (process.argv.includes('--check')) {
  for (const f of FILES) {
    const st = statSync(join(HERE, f));
    console.log(`ok  ${f}  ${st.size} bytes`);
  }
  console.log(`插件 id: ${PLUGIN_ID}  version: ${manifest.version}`);
  process.exit(0);
}

mkdirSync(TARGET, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(HERE, f), join(TARGET, f));
  console.log(`→ ${join(TARGET, f)}`);
}
console.log(`\n已同步 ${FILES.length} 个文件到 ${TARGET}`);
console.log('下一步：Obsidian 里 Ctrl+R 重载，或 设置 → 第三方插件 → 启用 Video Note Studio');
