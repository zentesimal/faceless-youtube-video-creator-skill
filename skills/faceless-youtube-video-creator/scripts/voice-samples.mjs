#!/usr/bin/env node
// Short voice samples to choose the narrator before the video is rendered.
//
//   node voice-samples.mjs [--lang en|es] [--provider openai|elevenlabs] [--voices af_heart,af_bella,am_michael] [--speed 0.92] [--text "…"]
//
//   --provider openai       the OpenAI candidates instead of Kokoro's (billed: one short line per voice, cached),
//                           read with the default narrator instructions, as in the video
//   --provider elevenlabs   3 narrators from the account's own ElevenLabs voice library (ELEVENLABS_API_KEY), picked for
//                           narration, the video's language and a mix of voices; billed per line like OpenAI, cached;
//                           read on the default model (eleven_v4, voices.mjs) with a warm tag, as the video would
//   --list                  with --provider elevenlabs: print every voice in the library (id, name, labels) and stop,
//                           for "Other" in the voice question
//
// Speaks one channel reminder line (the project's channel.md or the example; a fixed line for Spanish) in each voice and writes
// <workspace>/.tts/samples/<voice>.wav (cached across videos). Play one with `afplay` (macOS), `ffplay -nodisp -autoexit`
// (Linux/Windows with ffmpeg), or open it.
// The first run sets up Kokoro (~120 MB, needs PyPI and github.com).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, skill } from './style.mjs'
import { NARRATOR, TONES } from './tones.mjs'
import { apiKey, langFor, listVoices, providerOf, speak, ttsDir } from './tts-setup.mjs'
import { DEFAULT_MODEL, readsTags } from './voices.mjs'

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

// ElevenLabs: voice ids differ per account (and the default voices change), so the candidates come from the library
const NARRATION = /narrat|story|documentar|audiobook|informative|educational|news/i
async function elevenLabsVoices() {
  const key = apiKey('elevenlabs', '.')
  if (!key) {
    console.error(
      "voice-samples: no ELEVENLABS_API_KEY (environment or the project's .env): add it, or pick a free or OpenAI voice"
    )
    process.exit(2)
  }
  let r
  try {
    r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key },
      signal: AbortSignal.timeout(20000)
    })
  } catch (e) {
    console.error(`voice-samples: can't reach api.elevenlabs.io (${e.cause?.code || e.message})`)
    process.exit(2)
  }
  if (!r.ok) {
    console.error(
      `voice-samples: api.elevenlabs.io answered ${r.status}` +
        (r.status === 401 ? ': the key was rejected (ElevenLabs › Profile › API keys)' : '')
    )
    process.exit(2)
  }
  return ((await r.json()).voices || []).map((v) => {
    const l = v.labels || {}
    const langs = (v.verified_languages || []).map((x) => x.language)
    return {
      voice: `elevenlabs:${v.voice_id}`,
      name: v.name,
      gender: l.gender || '',
      speaks: langs.length ? langs : [l.language || 'en'],
      note: [v.name, l.gender, l.accent, l.age, l.descriptive || l.description, l.use_case]
        .filter(Boolean)
        .join(', ')
    }
  })
}
/** Up to 3: narration voices that speak the video's language first, then a mix of genders. */
function pickNarrators(all) {
  const score = (v) =>
    (NARRATION.test(v.note) ? 2 : 0) + (v.speaks.some((x) => x.startsWith(lang)) ? 1 : 0)
  const ranked = [...all].sort((a, b) => score(b) - score(a))
  const out = []
  for (const g of ['female', 'male']) {
    const v = ranked.find((x) => x.gender === g && !out.includes(x))
    if (v) out.push(v)
  }
  for (const v of ranked) if (out.length < 3 && !out.includes(v)) out.push(v)
  return out
}
const library = provider === 'elevenlabs' ? await elevenLabsVoices() : []
if (provider === 'elevenlabs' && args.includes('--list')) {
  for (const v of library) console.log(`${v.voice}\t${v.note}\tspeaks ${v.speaks.join(', ')}`)
  process.exit(0)
}
if (provider === 'elevenlabs' && !library.length) {
  console.error(
    'voice-samples: the ElevenLabs library is empty: add a voice in ElevenLabs › Voices first'
  )
  process.exit(2)
}
CANDIDATES.elevenlabs = pickNarrators(library).map((v) => [v.voice, v.note])

const pool =
  provider === 'openai' || provider === 'elevenlabs'
    ? CANDIDATES[provider]
    : CANDIDATES[lang] || CANDIDATES.en
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
  const p = providerOf(voice)
  const cloud = p !== 'kokoro'
  // a cloud sample is cached per voice and language, so the English and Spanish samples don't overwrite each other
  const sid = cloud ? `${id}-${lang}` : id
  const model = p === 'elevenlabs' ? loadConfig().models?.elevenlabs || DEFAULT_MODEL[p] : ''
  // ElevenLabs reads the sample the way the video reads a warm line: the tag on a model that reads tags
  const said = p === 'elevenlabs' && readsTags(model) ? `${TONES.warm.tag} ${text}` : text
  const d = speak([{ id: sid, text: said }], outDir, {
    voice,
    speed,
    lang: langFor(voice, lang),
    model,
    instructions: p === 'openai' ? NARRATOR[lang === 'es' ? 'es' : 'en'] : ''
  })
  const note =
    [...(CANDIDATES[lang] || []), ...CANDIDATES.openai, ...CANDIDATES.elevenlabs].find(
      ([v]) => v === voice
    )?.[1] || ''
  console.log(
    `${voice}\t${d[sid].toFixed(1)}s\t${join(outDir, sid + '.wav')}${note ? '\t' + note : ''}`
  )
}
