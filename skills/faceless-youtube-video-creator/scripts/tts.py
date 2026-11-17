#!/usr/bin/env python3
"""Voiceover for the slides, locally, with Kokoro (kokoro-onnx, Apache-2.0 weights).

    <venv>/bin/python tts.py <lines.json> <out_dir> [--voice af_heart] [--speed 1.0] [--lang en-us] [--max-pause 0.2]

lines.json: [{"id": "s01", "text": "…"}, …]. For every line it keeps Kokoro's raw take in <out_dir>/<id>.raw.wav
(re-spoken only when the text, voice, speed or language change; cached by a hash in <out_dir>/.cache.json) and
writes <out_dir>/<id>.wav: the same take with every pause inside it capped at --max-pause seconds and the
edges trimmed, so the voiceover keeps moving (Kokoro leaves ~0.4 s between sentences). Changing --max-pause
re-cuts the raw takes without re-speaking them. Prints {"<id>": seconds, …} as JSON on the last line of stdout.

Model files live next to the venv: <workspace>/.tts/{kokoro-v1.0.int8.onnx,voices-v1.0.bin}
(tts-setup.mjs sets them up on first run).
"""
import hashlib
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def arg(name, default):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def cap_pauses(x, rate, max_pause, lead=0.02, tail=0.05, thr_db=-40.0):
    """Shorten every silent run longer than max_pause to max_pause; trim the edges to lead/tail."""
    if len(x) == 0:
        return x
    win = max(1, int(rate * 0.01))
    n = len(x) // win
    if n == 0:
        return x
    peak = float(np.abs(x).max()) or 1.0
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    loud = 20 * np.log10(rms / peak) >= thr_db
    if not loud.any():
        return x
    first, last = int(np.argmax(loud)), int(n - 1 - np.argmax(loud[::-1]))
    keep = []
    start = max(0, first * win - int(lead * rate))
    end = min(len(x), (last + 1) * win + int(tail * rate))
    i, cur = first, first * win
    max_w = int(round(max_pause / 0.01))
    while i <= last:
        if loud[i]:
            i += 1
            continue
        j = i
        while j <= last and not loud[j]:
            j += 1
        if j - i > max_w:  # cut the middle of the pause, keep max_pause of it (half each side)
            half = (max_w * win) // 2
            keep.append(x[cur : i * win + half])
            cur = j * win - (max_w * win - half)
        i = j
    keep.append(x[cur:end])
    return np.concatenate([x[start : first * win]] + keep)


lines_path, out_dir = sys.argv[1], sys.argv[2]
voice = arg("--voice", "af_heart")
speed = float(arg("--speed", "1.0"))
lang = arg("--lang", "en-us")
max_pause = float(arg("--max-pause", "0.2"))
models = os.environ.get("KOKORO_DIR") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(sys.executable)))
)

lines = json.load(open(lines_path))
os.makedirs(out_dir, exist_ok=True)
cache_path = os.path.join(out_dir, ".cache.json")
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
cuts = cache.setdefault("_cut", {})

kokoro = None
durations = {}
for i, line in enumerate(lines):
    lid = line["id"]
    key = hashlib.sha1(f"{voice}|{speed}|{lang}|{line['text']}".encode()).hexdigest()
    raw = os.path.join(out_dir, f"{lid}.raw.wav")
    wav = os.path.join(out_dir, f"{lid}.wav")
    # takes from before the raw/cut split: the .wav is the raw take
    if cache.get(lid) == key and not os.path.exists(raw) and os.path.exists(wav) and lid not in cuts:
        os.replace(wav, raw)
    if cache.get(lid) != key or not os.path.exists(raw):
        if kokoro is None:
            kokoro = Kokoro(
                os.path.join(models, "kokoro-v1.0.int8.onnx"), os.path.join(models, "voices-v1.0.bin")
            )
        samples, rate = kokoro.create(line["text"], voice=voice, speed=speed, lang=lang)
        sf.write(raw, samples, rate)
        cache[lid] = key
        cuts.pop(lid, None)
        print(f"  voice {i + 1}/{len(lines)} {lid}", file=sys.stderr, flush=True)
    cut_key = f"{key}|{max_pause}"
    if cuts.get(lid) != cut_key or not os.path.exists(wav):
        x, rate = sf.read(raw)
        sf.write(wav, cap_pauses(x, rate, max_pause), rate)
        cuts[lid] = cut_key
    info = sf.info(wav)
    durations[lid] = round(info.frames / info.samplerate, 3)

json.dump(cache, open(cache_path, "w"))
print(json.dumps(durations))
