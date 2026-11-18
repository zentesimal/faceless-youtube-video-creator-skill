// Voiceover: one-time setup into <workspace>/.tts and a `speak` helper around tts.py. Kokoro (free, local) is the
// default; a voice named `openai:<voice>` or `elevenlabs:<voice id>` uses that paid API instead, with its key from
// the environment or the project's .env (env.mjs).
// Shared by render-video.mjs and voice-samples.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env } from './env.mjs'
import { loadConfig, skill } from './style.mjs'

// cached in the project's workspace (shared by every video), not in the skill folder: a plugin's folder changes per version
export const ttsDir = loadConfig(process.argv[2]).ttsDir

/** `kokoro`, `openai` or `elevenlabs`, from the voice name's prefix. */
export const providerOf = (voice) => (voice.includes(':') ? voice.split(':')[0] : 'kokoro')

/** The cloud voices' API key variable, per provider. */
export const KEYS = { openai: 'OPENAI_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY' }

/**
 * Language of the voice. Kokoro's comes from the voice name (ef_/em_ = Spanish, bf_/bm_ = British); cloud voices
 * are multilingual, so they speak the video's language.
 */
export const langFor = (voice, language = 'en') =>
  providerOf(voice) !== 'kokoro'
    ? language === 'es'
      ? 'es'
      : 'en-us'
    : voice.startsWith('e')
      ? 'es'
      : voice.startsWith('b')
        ? 'en-gb'
        : 'en-us'

/** The API key for a cloud voice: the environment, else the project's .env (env.mjs), else null. */
export function apiKey(provider, start = process.argv[2]) {
  const name = KEYS[provider]
  return (name && env(name, start)) || null
}

/**
 * Creates the venv and, unless `model` is false (cloud voices only), downloads the Kokoro model files the first
 * time (~120 MB). Returns the venv's python.
 */
export function ensureKokoro({ model = true } = {}) {
  const py = join(ttsDir, 'venv', 'bin', 'python')
  const files = ['kokoro-v1.0.int8.onnx', 'voices-v1.0.bin']
  if (existsSync(py) && (!model || files.every((f) => existsSync(join(ttsDir, f))))) return py
  console.log(`setting up the Kokoro voice in ${ttsDir} (once, ~120 MB)…`)
  mkdirSync(ttsDir, { recursive: true })
  if (!existsSync(py))
    execFileSync('python3', ['-m', 'venv', join(ttsDir, 'venv')], { stdio: 'inherit' })
  execFileSync(join(ttsDir, 'venv', 'bin', 'pip'), ['install', '-q', 'kokoro-onnx', 'soundfile'], {
    stdio: 'inherit'
  })
  for (const f of model ? files : [])
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
 * Cloud voices also take `model` and `instructions` (OpenAI: how to speak, e.g. tone and accent).
 */
export function speak(
  lines,
  outDir,
  { voice, speed, lang = langFor(voice), maxPause = 0.2, model = '', instructions = '' }
) {
  const provider = providerOf(voice)
  const env = { ...process.env, KOKORO_DIR: ttsDir }
  if (provider !== 'kokoro') {
    const key = apiKey(provider)
    if (!key)
      throw new Error(
        `${voice} is a paid ${provider} voice: set ${KEYS[provider]} in the environment or the project's .env, or pick a free Kokoro voice`
      )
    env[KEYS[provider]] = key
  }
  const py = ensureKokoro({ model: provider === 'kokoro' })
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
      String(maxPause),
      ...(model ? ['--model', model] : []),
      ...(instructions ? ['--instructions', instructions] : [])
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 1 << 26,
      env
    }
  )
  return JSON.parse(out.trim().split('\n').pop())
}
