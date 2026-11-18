#!/usr/bin/env node
// Short voice samples to choose the narrator before the video is rendered.
//
//   node voice-samples.mjs [--lang en|es] [--provider openai] [--voices af_heart,af_bella,am_michael] [--speed 0.92] [--text "…"]
//
//   --provider openai   the OpenAI candidates instead of Kokoro's (billed: one short line per voice, cached),
//                       read with the default narrator instructions, as in the video
//
// Speaks one channel reminder line (the project's channel.md or the example; a fixed line for Spanish) in each voice and writes
// <workspace>/.tts/samples/<voice>.wav (cached across videos). Play one with `afplay` (macOS), `ffplay -nodisp -autoexit`
// (Linux/Windows with ffmpeg), or open it.
// The first run sets up Kokoro (~120 MB, needs PyPI and github.com).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, skill } from './style.mjs'
import { NARRATOR } from './tones.mjs'
import { langFor, listVoices, providerOf, speak, ttsDir } from './tts-setup.mjs'

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
  ],
  // paid, multilingual (they speak the video's language), and they act the script's tones
  openai: [
    ['openai:coral', 'warm, friendly female; the most expressive of the three'],
    ['openai:sage', 'calm, measured female; suits documentary looks'],
    ['openai:onyx', 'deep, steady male narrator']
  ]
}

const provider = flag('--provider', '')
const pool = provider === 'openai' ? CANDIDATES.openai : CANDIDATES[lang] || CANDIDATES.en
const voices = flag('--voices', '')
  ? flag('--voices', '')
      .split(',')
      .map((v) => v.trim())
  : pool.map(([v]) => v)

const reminder = () => {
  const config = loadConfig()
  const own = config.channelMd
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

// cloud voices (openai:<voice>, elevenlabs:<id>) aren't in Kokoro's list; they need their API key instead
const kokoroVoices = voices.filter((v) => providerOf(v) === 'kokoro')
const available = new Set(kokoroVoices.length ? listVoices() : [])
const missing = kokoroVoices.filter((v) => !available.has(v))
if (missing.length) {
  console.error(`voice-samples: not in voices-v1.0.bin: ${missing.join(', ')}`)
  console.error(`available: ${[...available].join(', ')}`)
  process.exit(2)
}

const outDir = join(ttsDir, 'samples')
const speed = Number(flag('--speed', '0.92'))
for (const voice of voices) {
  const id = voice.replace(/[^\w.-]/g, '_')
  const cloud = providerOf(voice) === 'openai'
  // a cloud sample is cached per voice and language, so the English and Spanish samples don't overwrite each other
  const sid = cloud ? `${id}-${lang}` : id
  const d = speak([{ id: sid, text }], outDir, {
    voice,
    speed,
    lang: langFor(voice, lang),
    instructions: cloud ? NARRATOR[lang === 'es' ? 'es' : 'en'] : ''
  })
  const note =
    [...(CANDIDATES[lang] || []), ...CANDIDATES.openai].find(([v]) => v === voice)?.[1] || ''
  console.log(
    `${voice}\t${d[sid].toFixed(1)}s\t${join(outDir, sid + '.wav')}${note ? '\t' + note : ''}`
  )
}
