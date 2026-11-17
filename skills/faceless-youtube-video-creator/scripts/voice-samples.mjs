#!/usr/bin/env node
// Short voice samples to choose the narrator before the video is rendered.
//
//   node voice-samples.mjs [--lang en|es] [--voices af_heart,af_bella,am_michael] [--speed 0.92] [--text "…"]
//
// Speaks one channel reminder line (the project's channel.md or the example; a fixed line for Spanish) in each voice and writes
// <workspace>/.tts/samples/<voice>.wav (cached across videos). Play one with `afplay` (macOS), `ffplay -nodisp -autoexit`
// (Linux/Windows with ffmpeg), or open it.
// The first run sets up Kokoro (~120 MB, needs PyPI and github.com).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, skill } from './style.mjs'
import { listVoices, speak, ttsDir } from './tts-setup.mjs'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : (args[i + 1] ?? d)
}
const lang = flag('--lang', 'en')

// The candidates offered in the setup question, with what each sounds like.
export const CANDIDATES = {
  en: [
    ['af_heart', 'warm, the most natural US female voice; the first draft used it'],
    ['af_bella', 'brighter and more energetic US female; suits pace 4–5'],
    ['am_michael', 'calm, steady US male explainer; a little less natural than the female voices']
  ],
  es: [
    ['ef_dora', 'Spanish female, clear and friendly'],
    ['em_alex', 'Spanish male, neutral narrator']
    // em_santa also exists but is a Santa Claus character voice: not for this channel
  ]
}

const voices = flag('--voices', '')
  ? flag('--voices', '')
      .split(',')
      .map((v) => v.trim())
  : (CANDIDATES[lang] || CANDIDATES.en).map(([v]) => v)

const reminder = () => {
  const config = loadConfig()
  const own = config.at(config.paths.channel)
  const md = readFileSync(
    own && existsSync(own) ? own : join(skill, 'references/channel.example.md'),
    'utf8'
  )
  const m = md.match(/## Channel reminder lines[\s\S]*?\n- "(.+?)"/)
  return m ? m[1] : 'Welcome back to the channel. Today we look at one idea, step by step.'
}
const text = flag(
  '--text',
  lang === 'es'
    ? 'En este canal pruebo lo que la inteligencia artificial puede hacer de verdad, y dónde falla, para que tú no tengas que hacerlo.'
    : reminder()
)

const available = new Set(listVoices())
const missing = voices.filter((v) => !available.has(v))
if (missing.length) {
  console.error(`voice-samples: not in voices-v1.0.bin: ${missing.join(', ')}`)
  console.error(`available: ${[...available].join(', ')}`)
  process.exit(2)
}

const outDir = join(ttsDir, 'samples')
const speed = Number(flag('--speed', '0.92'))
for (const voice of voices) {
  const d = speak([{ id: voice, text }], outDir, { voice, speed })
  const note = (CANDIDATES[lang] || []).find(([v]) => v === voice)?.[1] || ''
  console.log(
    `${voice}\t${d[voice].toFixed(1)}s\t${join(outDir, voice + '.wav')}${note ? '\t' + note : ''}`
  )
}
