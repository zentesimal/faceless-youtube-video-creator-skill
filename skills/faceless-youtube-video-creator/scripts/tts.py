#!/usr/bin/env python3
"""Voiceover for the slides: locally with Kokoro (kokoro-onnx, Apache-2.0 weights), or, optionally, with a paid
cloud voice when the voice name has a provider prefix:

    <venv>/bin/python tts.py <lines.json> <out_dir> [--voice af_heart] [--speed 1.0] [--lang en-us] [--max-pause 0.2]
                                                    [--model <id>] [--instructions "<how to speak>"]

  --voice af_heart            Kokoro, free and offline (the default)
  --voice openai:coral        OpenAI speech API (OPENAI_API_KEY; --model default gpt-4o-mini-tts; --instructions
                              steer tone and accent)
  --voice elevenlabs:<id>     ElevenLabs (ELEVENLABS_API_KEY; <id> = a voice id from your ElevenLabs library,
                              voice-samples.mjs --provider elevenlabs --list prints them; --model default eleven_v4,
                              which also reads inline audio tags such as [curious])

Cloud takes are billed per request by the provider; the cache below means each line is bought once. --speed is
Kokoro's own speed, and for cloud voices it's applied afterwards with ffmpeg (atempo), so it works the same.

lines.json: [{"id": "s01", "text": "…"}, …]. A line may carry its own delivery (a `> TONE` in the script, set by
render-video.mjs from tones.mjs): "speed" and "maxPause" (instead of --speed / --max-pause), "instructions" (OpenAI,
instead of --instructions) and "settings" (ElevenLabs voice_settings: stability, similarity_boost, style). Every raw take is stored by what
it contains, <out_dir>/raw/<hash>.wav (the text, voice, language and delivery; plus the speed for Kokoro, which
speaks at it natively), so reordering, adding or removing slides never re-speaks a line, and a paid line is
bought once. Cloud takes are bought at their natural pace and sped up afterwards with ffmpeg (atempo), so
changing the speed doesn't buy them again. For every line it writes <out_dir>/<id>.wav: the raw take (sped up
for cloud voices) with every pause inside it capped at --max-pause seconds and the edges trimmed, so the
voiceover keeps moving (Kokoro leaves ~0.4 s between sentences). Changing --max-pause or a cloud voice's speed
re-cuts the raw takes without re-speaking them. Prints {"<id>": seconds, …} as JSON on the last line of stdout.

Model files live next to the venv: <workspace>/.tts/{kokoro-v1.0.int8.onnx,voices-v1.0.bin}
(tts-setup.mjs sets them up on first run).
"""
import hashlib
import json
import os
import sys

import subprocess
import tempfile
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf


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


def post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf8", "replace")[:400]
        sys.exit(f"tts: {url.split('/')[2]} answered {e.code}: {detail}{hint(e.code, detail)}")
    except urllib.error.URLError as e:
        sys.exit(f"tts: cannot reach {url.split('/')[2]} ({e.reason}); is the host allowed on this network?")


def hint(code, detail):
    """What the user should do about a provider error (the same advice as providers.mjs --check)."""
    if code == 401:
        return "\n  → the key was rejected: create a new one and replace it in the project's .env (providers.mjs --check tests it)"
    if code == 403:
        return "\n  → this key can't use the model: check the project's model permissions (and organisation verification) in the dashboard"
    if code == 404:
        return "\n  → the model isn't available to this key: fix its name (style.json voiceModel) or pick a free Kokoro voice"
    if code == 429:
        if "quota" in detail or "billing" in detail:
            return "\n  → the account has no credit left: add credit in the provider's billing settings"
        return "\n  → rate-limited: wait a minute and re-run (finished lines are cached)"
    return ""


def need_key(name):
    key = os.environ.get(name)
    if not key:
        sys.exit(f"tts: {name} is not set (environment or the project's .env); it's needed for this voice")
    return key


def synth_openai(text, voice_id, model, instructions):
    body = {"model": model or "gpt-4o-mini-tts", "voice": voice_id, "input": text, "response_format": "wav"}
    if instructions:
        body["instructions"] = instructions
    data = post(
        "https://api.openai.com/v1/audio/speech",
        {"Authorization": f"Bearer {need_key('OPENAI_API_KEY')}", "Content-Type": "application/json"},
        body,
    )
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        t.write(data)
    x, rate = sf.read(t.name)
    os.unlink(t.name)
    return x, rate


def synth_elevenlabs(text, voice_id, model, settings=None):
    rate = 24000
    body = {"text": text, "model_id": model or "eleven_v4"}
    if settings:
        body["voice_settings"] = settings
    data = post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=pcm_{rate}",
        {"xi-api-key": need_key("ELEVENLABS_API_KEY"), "Content-Type": "application/json"},
        body,
    )
    return np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768.0, rate


def tempo(x, rate, speed):
    """Changes the pace without changing the pitch (ffmpeg atempo), for voices with no speed setting of their own."""
    if abs(speed - 1.0) < 1e-3:
        return x
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, rate)
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", a, "-filter:a", f"atempo={speed}", b], check=True
        )
        y, _ = sf.read(b)
    return y


lines_path, out_dir = sys.argv[1], sys.argv[2]
voice = arg("--voice", "af_heart")
provider, voice_id = voice.split(":", 1) if ":" in voice else ("kokoro", voice)
model = arg("--model", "")
instructions = arg("--instructions", "")
speed = float(arg("--speed", "1.0"))
lang = arg("--lang", "en-us")
max_pause = float(arg("--max-pause", "0.2"))
models = os.environ.get("KOKORO_DIR") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(sys.executable)))
)

lines = json.load(open(lines_path))
os.makedirs(out_dir, exist_ok=True)
# raw takes are stored by what they contain (raw/<hash>.wav), not by slide id: moving, adding or removing slides
# reuses every take whose words and delivery didn't change, so a paid line is never bought twice
raw_dir = os.path.join(out_dir, "raw")
os.makedirs(raw_dir, exist_ok=True)
cache_path = os.path.join(out_dir, ".cache.json")
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
cuts = cache.setdefault("_cut", {})
cloud = provider != "kokoro"

kokoro = None
durations = {}
for i, line in enumerate(lines):
    lid = line["id"]
    # a line's own delivery (its tone) wins over the run's settings
    l_speed = float(line.get("speed", speed))
    l_pause = float(line.get("maxPause", max_pause))
    l_instr = line.get("instructions", instructions)
    l_settings = line.get("settings")
    if cloud:
        # a cloud take is bought at its natural pace and sped up afterwards (ffmpeg), so the speed isn't part
        # of what was bought: changing it re-cuts the take without paying again
        extra = f"|{model}|{l_instr}"
        if provider == "elevenlabs" and l_settings:
            extra += "|" + json.dumps(l_settings, sort_keys=True)
        key = hashlib.sha1(f"{voice}|{lang}|{line['text']}{extra}".encode()).hexdigest()
    else:
        # Kokoro speaks at the speed natively, so the speed is part of the take
        key = hashlib.sha1(f"{voice}|{l_speed}|{lang}|{line['text']}".encode()).hexdigest()
    raw = os.path.join(raw_dir, f"{key}.wav")
    wav = os.path.join(out_dir, f"{lid}.wav")
    # Kokoro takes from older versions (stored per slide id) move into the store instead of being re-spoken
    old_raw = os.path.join(out_dir, f"{lid}.raw.wav")
    if not cloud and not os.path.exists(raw) and cache.get(lid) == key:
        if os.path.exists(old_raw):
            os.replace(old_raw, raw)
        elif os.path.exists(wav) and lid not in cuts:
            os.replace(wav, raw)
    if not os.path.exists(raw):
        if provider == "openai":
            samples, rate = synth_openai(line["text"], voice_id, model, l_instr)
        elif provider == "elevenlabs":
            samples, rate = synth_elevenlabs(line["text"], voice_id, model, l_settings)
        elif provider == "kokoro":
            if kokoro is None:
                from kokoro_onnx import Kokoro

                kokoro = Kokoro(
                    os.path.join(models, "kokoro-v1.0.int8.onnx"), os.path.join(models, "voices-v1.0.bin")
                )
            samples, rate = kokoro.create(line["text"], voice=voice, speed=l_speed, lang=lang)
        else:
            sys.exit(f"tts: unknown voice provider '{provider}' (use a Kokoro voice, openai:<voice> or elevenlabs:<id>)")
        sf.write(raw, samples, rate)
        print(f"  voice {i + 1}/{len(lines)} {lid}", file=sys.stderr, flush=True)
    cache[lid] = key
    cut_key = f"{key}|{l_speed if cloud else ''}|{l_pause}"
    if cuts.get(lid) != cut_key or not os.path.exists(wav):
        x, rate = sf.read(raw)
        if cloud:
            x = tempo(x, rate, l_speed)
        sf.write(wav, cap_pauses(x, rate, l_pause), rate)
        cuts[lid] = cut_key
    info = sf.info(wav)
    durations[lid] = round(info.frames / info.samplerate, 3)
    # saved as it goes, so an interrupted run keeps what it already bought
    if i % 10 == 9:
        json.dump(cache, open(cache_path, "w"))

json.dump(cache, open(cache_path, "w"))
print(json.dumps(durations))
