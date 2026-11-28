#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""asr_bridge.py — 给 Obsidian 插件用的本地转录桥。

用法：
  python asr_bridge.py --url <视频链接> [--model small] [--language zh] [--ytdlp yt-dlp]

输出（stdout 最后一行）：{"segments": [[秒, "文本"], ...], "language": "zh", "duration": 294.3}
日志一律走 stderr，不影响插件解析。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_OFFLINE", "0")

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def run_bytes(cmd, timeout=1800):
    log("$ " + " ".join(cmd))
    return subprocess.run(cmd, capture_output=True, timeout=timeout)


def download_audio(url, ytdlp, tmp, cookie=""):
    out = str(tmp / "audio.%(ext)s")
    cmd = [ytdlp, "-f", "bestaudio[ext=m4a]/bestaudio/best",
           "--no-warnings", "--no-playlist"]
    if cookie:
        cmd += ["--add-header", f"Cookie: {cookie}"]
    cmd += ["-o", out, url]
    p = run_bytes(cmd)
    files = [f for f in tmp.glob("audio.*") if f.is_file()]
    if not files:
        raise RuntimeError("音频下载失败: " + (p.stderr or b"").decode("utf-8", "replace")[-500:])
    return files[0]


# 抖音这类平台没有平台字幕、也不给 yt-dlp 抓（要新鲜 Cookie），
# 播放器里能直接拿到 CDN 直链，这里就用 urllib 直下，绕开 yt-dlp。
DIRECT_MEDIA_RE = re.compile(r"\.(mp4|m4a|mp3|webm|aac|m4s)(\?|$)", re.I)


def download_direct(url, tmp, referer="https://www.douyin.com/"):
    import urllib.request

    out = tmp / "audio.mp4"
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
        "Referer": referer or "https://www.douyin.com/",
        "Accept": "*/*",
    })
    log(f"$ GET {url[:120]}…")
    with urllib.request.urlopen(req, timeout=180) as resp, open(out, "wb") as f:
        shutil.copyfileobj(resp, f)
    if out.stat().st_size < 10 * 1024:
        raise RuntimeError("直链下载的文件太小，可能是防盗链或已过期")
    return out


def load_audio(path, sr=16000):
    import numpy as np
    p = run_bytes(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                   "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"])
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError("ffmpeg 解码失败: " + (p.stderr or b"").decode("utf-8", "replace")[-400:])
    return np.frombuffer(p.stdout, dtype=np.int16).astype("float32") / 32768.0


try:
    from opencc import OpenCC
    T2S = OpenCC("t2s")
except Exception:
    T2S = None


def simplified(text):
    """Whisper 在中文口音/中英混说时可能吐出繁体，统一转简体。"""
    if not text:
        return text
    return T2S.convert(text) if T2S else text


NOISE_RE = re.compile(r"^[\s♪🎵*\[\(（]*(music|音乐|applause|掌声|静音|silence)[\s♪🎵*\]\)）]*$", re.I)


def drop_noise(items):
    """whisper 对纯音乐视频会吐出 "Music" 这类标签，不能当转录用。"""
    out = []
    for start, text in items:
        t = (text or "").strip()
        if not t or NOISE_RE.match(t):
            continue
        out.append([start, t])
    return out


def merge(items, min_chars=24, max_gap=8.0, max_chars=140):
    out = []
    for start, text in items:
        if out:
            ls, lt = out[-1]
            ended = bool(re.search(r"[。？！?!.；;]$", lt)) and len(lt) >= min_chars
            if (not ended and len(lt) < max_chars and len(lt) < min_chars * 4
                    and start - ls <= max_gap and len(lt) + len(text) <= max_chars):
                out[-1] = [ls, (lt + " " + text).strip()]
                continue
        out.append([start, text])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--model", default="small")
    ap.add_argument("--language", default="")
    ap.add_argument("--ytdlp", default="yt-dlp")
    ap.add_argument("--cookie", default="")
    ap.add_argument("--media-url", default="", help="播放器抓到的 CDN 直链（优先于 yt-dlp）")
    ap.add_argument("--referer", default="")
    ap.add_argument("--timeout", type=int, default=1800)
    args = ap.parse_args()

    tmp = tempfile.mkdtemp(prefix="vns-asr-")
    try:
        tmp_path = __import__("pathlib").Path(tmp)
        if args.media_url and (DIRECT_MEDIA_RE.search(args.media_url) or "douyinvod" in args.media_url
                               or "bytecdn" in args.media_url):
            try:
                audio = download_direct(args.media_url, tmp_path, args.referer)
            except Exception as exc:
                log(f"[asr] 直链下载失败，回退 yt-dlp：{exc}")
                audio = download_audio(args.url, args.ytdlp, tmp_path, args.cookie)
        else:
            audio = download_audio(args.url, args.ytdlp, tmp_path, args.cookie)
        log(f"[asr] 音频就绪 {audio.stat().st_size // 1024} KB")
        samples = load_audio(audio)
        log(f"[asr] 采样点 {len(samples)}")

        from faster_whisper import WhisperModel
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        lang = args.language or None

        def collect(use_vad):
            segs, info = model.transcribe(
                samples, language=lang, vad_filter=use_vad, beam_size=5,
                condition_on_previous_text=False,
            )
            got = []
            for seg in segs:
                text = simplified(seg.text.strip())
                if text:
                    got.append([round(float(seg.start), 2), text])
            return got, info

        items, info = collect(True)
        used_vad = True
        if not items:
            log("[asr] VAD 过滤后没有语音，关掉 VAD 再试一次")
            items, info = collect(False)
            used_vad = False
        items = merge(drop_noise(items))
        payload = {
            "segments": items,
            "language": getattr(info, "language", ""),
            "duration": round(float(getattr(info, "duration", 0) or 0), 2),
            "count": len(items),
            "vad": used_vad,
        }
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        log(f"[error] {exc}")
        return 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
