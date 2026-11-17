// Kokoro voice: one-time setup into <workspace>/.tts and a `speak` helper around tts.py.
// Shared by render-video.mjs and voice-samples.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, skill } from './style.mjs'

// cached in the project's workspace (shared by every video), not in the skill folder: a plugin's folder changes per version
export const ttsDir = loadConfig(process.argv[2]).ttsDir

/** Language Kokoro should phonemise with, from the voice name (ef_/em_ = Spanish, bf_/bm_ = British). */
export const langFor = (voice) =>
  voice.startsWith('e') ? 'es' : voice.startsWith('b') ? 'en-gb' : 'en-us'

/** Creates the venv and downloads the model files the first time (~120 MB). Returns the venv's python. */
export function ensureKokoro() {
  const py = join(ttsDir, 'venv', 'bin', 'python')
  if (
    existsSync(py) &&
    existsSync(join(ttsDir, 'kokoro-v1.0.int8.onnx')) &&
    existsSync(join(ttsDir, 'voices-v1.0.bin'))
  )
    return py
  console.log(`setting up the Kokoro voice in ${ttsDir} (once, ~120 MB)…`)
  mkdirSync(ttsDir, { recursive: true })
  if (!existsSync(py))
    execFileSync('python3', ['-m', 'venv', join(ttsDir, 'venv')], { stdio: 'inherit' })
  execFileSync(join(ttsDir, 'venv', 'bin', 'pip'), ['install', '-q', 'kokoro-onnx', 'soundfile'], {
    stdio: 'inherit'
  })
  for (const f of ['kokoro-v1.0.int8.onnx', 'voices-v1.0.bin'])
    if (!existsSync(join(ttsDir, f)))
      execFileSync(
        'curl',
        [
          '-sSfL',
          '-o',
          join(ttsDir, f),
          `https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/${f}`
        ],
        { stdio: 'inherit' }
      )
  return py
}

/** Voices available in voices-v1.0.bin. */
export function listVoices() {
  const py = ensureKokoro()
  const out = execFileSync(
    py,
    [
      '-I',
      '-c',
      'import json,sys; from kokoro_onnx import Kokoro; k=Kokoro(sys.argv[1],sys.argv[2]); print(json.dumps(sorted(k.get_voices())))',
      join(ttsDir, 'kokoro-v1.0.int8.onnx'),
      join(ttsDir, 'voices-v1.0.bin')
    ],
    { encoding: 'utf8' }
  )
  return JSON.parse(out.trim().split('\n').pop())
}

/**
 * Speaks [{id, text}] into <outDir>/<id>.wav (cached per line by tts.py) and returns {id: seconds}.
 */
export function speak(lines, outDir, { voice, speed, lang = langFor(voice), maxPause = 0.2 }) {
  const py = ensureKokoro()
  mkdirSync(outDir, { recursive: true })
  const linesPath = join(outDir, '.lines.json')
  writeFileSync(linesPath, JSON.stringify(lines, null, 1))
  const out = execFileSync(
    py,
    [
      join(skill, 'scripts', 'tts.py'),
      linesPath,
      outDir,
      '--voice',
      voice,
      '--speed',
      String(speed),
      '--lang',
      lang,
      '--max-pause',
      String(maxPause)
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 1 << 26,
      env: { ...process.env, KOKORO_DIR: ttsDir }
    }
  )
  return JSON.parse(out.trim().split('\n').pop())
}
