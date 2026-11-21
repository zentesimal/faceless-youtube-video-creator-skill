#!/usr/bin/env node
// Renders the voiceover + slides video from script.md, locally: Kokoro voice (tts.py), Playwright slides, ffmpeg.
//
//   node render-video.mjs <$W> [--slides] [--preview s012,s020] [--voice af_heart] [--speed 0.92] [--pace 1-5]
//                             [--anim auto|off] [--gap 0.1] [--section-gap 0.3] [--max-pause 0.2] [--beat 0.6]
//                             [--expressive 1] [--vertical] [--out <file.mp4>]
//
//   --slides   only render the slide PNGs + $W/video/sheet.png (no voice, no MP4): fast layout check
//   --preview  like --slides, plus a short MP4 of each named slide as it will move ($W/video/preview-<id>.mp4)
//   --anim     animations: "auto" animates every slide where it suits (entrances, count-ups, drawn doodles,
//              acting characters); "off" = still slides. Default: style.json "animate", else off
//   --camera   with animations: a camera move with parallax on scene and illustration slides (auto, drift, push,
//              pull, pan-left, pan-right, rise, sink, off). Default: style.json "camera", else off; a cue's own wins
//   default    voice for every slide (cached; only changed lines are re-spoken), then
//              $W/out/video.mp4 (1920×1080, 30 fps, H.264 + AAC), $W/out/video.srt, $W/out/chapters.txt (real times),
//              $W/out/timeline.json (every slide's id, section, start, length and voice takes)
//   --vertical a Short (also style.json "format": "short"): 1080×1920, sections [HOOK] [PAYOFF] [LOOP], no chapter
//              cards, label, logo or progress bar, captions burned in (style.json "captions": false = off), pace ≥ 4
//              unless --pace says otherwise. Writes $W/out/short.mp4 + short.srt (../references/shorts-playbook.md)
//
// Look, pace and voice come from $W/style.json (see style.mjs); flags override it. Pace 1–2 = hard cuts on still
// slides; 3–5 = slow push-ins and crossfades, shorter slides (profile below; spec: ../references/video-playbook.md).
// Slides come from `> SLIDE {json}` cues in $W/script.md: each cue starts a slide, and the spoken lines after it
// (until the next cue) are that slide's voiceover. `> TONE <name>` right before a spoken line sets how that line is
// delivered (suspense, surprise, …; tones.mjs): a held pause before it, its own speed and pauses, and for paid
// voices the acting itself. style.json "expressive" (or --expressive) scales it; 0 = one flat tone.
// Story teller (style.json "mode": "storyteller"; storyteller.mjs): every sentence is its own slide with its own
// generated illustration. The renderer checks one sentence per picture, crossfades between pictures at any pace,
// pushes into still pictures, and with animations on gives each picture its own camera move (camera "auto").
// Exit code 2 = a slide overflows or runs too long for the pace, a spoken line has no slide, or the script is malformed.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { STORY_FADE, STORY_MAX, STORY_MOVES, isStoryteller, storyChecks } from './storyteller.mjs'
import {
  channel,
  dataUrl,
  families,
  fontsCss,
  genPath,
  launchBrowser,
  loadStyle,
  skill,
  themeWarnings
} from './style.mjs'
import { NARRATOR, TONE_NAMES, delivery, parseTone } from './tones.mjs'
import { langFor, providerOf, speak } from './tts-setup.mjs'
import { defaultSpeed, voiceWpm } from './voices.mjs'

const args = process.argv.slice(2)
const stop = (m, code = 1) => {
  console.error('render-video: ' + m)
  process.exit(code)
}
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : (args[i + 1] ?? d)
}
const W = args[0] && resolve(args[0])
if (!W || !existsSync(join(W, 'script.md')))
  stop(
    'usage: render-video.mjs <video folder with script.md> [--slides] [--voice af_heart] [--speed 0.92] [--pace 1-5]'
  )
let style
try {
  style = loadStyle(W)
} catch (e) {
  stop(e.message)
}
const preview = new Set(
  flag('--preview', '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
)
const onlySlides = args.includes('--slides') || preview.size > 0
// a Short: 1080×1920 (slide.html › vertical), its own sections and checks
const VERT = args.includes('--vertical') || style.format === 'short'
const [VW, VH] = VERT ? [1080, 1920] : [1920, 1080]
const CAPTIONS = VERT && style.captions !== false
const VOICE = flag('--voice', style.voice || 'af_heart')
// Kokoro reads at 0.92, cloud voices at 1.1 by default (voices.mjs), so both land near the same pace
const SPEED = Number(flag('--speed', String(style.speed ?? defaultSpeed(VOICE))))
const RATE_EST = voiceWpm(VOICE, SPEED)
// silence after each slide's voice, and extra at a section change: short, so the voiceover keeps going
const GAP = Number(flag('--gap', String(style.gap ?? 0.1)))
const SECTION_GAP = Number(flag('--section-gap', String(style.sectionGap ?? 0.3)))
const CHAPTER = 1.8 // seconds a chapter card shows, over the start of its idea's first line
// longest pause allowed inside one slide's voice (Kokoro leaves ~0.4 s between sentences)
const MAX_PAUSE = Number(flag('--max-pause', String(style.maxPause ?? 0.2)))
// a beat: the longer pause after a hook, a wow line or a conclusion, so the viewer takes it in before the next
// idea. 3× the pause inside a line by default. `> BEAT` after a spoken line asks for one, and the last line of
// every section but the outro gets one. style.json "beat": 0 (or --beat 0) turns them off.
const BEAT = Math.max(
  0,
  Number(flag('--beat', String(style.beat ?? Math.round(MAX_PAUSE * 300) / 100)))
)
// how much the `> TONE` cues change the delivery: 0 = off (one tone), 1 = default, 1.5 = more dramatic
const EXPRESSIVE = Math.max(0, Number(flag('--expressive', String(style.expressive ?? 1))))
const LANG = flag('--lang', langFor(VOICE, style.language))
// style.json "language" (asked before the script) and the voice must agree: an English voice can't read Spanish
if (style.language && !LANG.startsWith(style.language)) {
  console.error(
    `render-video: style.json says language "${style.language}" but ${VOICE} speaks ${LANG}; pick a ${style.language} voice (voice-samples.mjs --lang ${style.language})`
  )
  process.exit(2)
}
// a Short cuts quicker: pace 4 at least, unless --pace asks for less
const PACE = Math.min(
  5,
  Math.max(
    1,
    Math.round(
      Number(flag('--pace', String(VERT ? Math.max(4, style.pace ?? 4) : (style.pace ?? 2))))
    )
  )
)
const outFile = resolve(flag('--out', join(W, 'out', VERT ? 'short.mp4' : 'video.mp4')))
const END_HOLD = 20 // seconds the end slide stays up, so YouTube's end-screen elements have room

// max = longest a slide should stay up; fade = crossfade into the next slide (0 = cut);
// push = which layouts get a slow push-in; zoom = how far it pushes over the slide
const PACES = {
  1: { max: 20, fade: 0, push: [], zoom: 0 },
  2: { max: 15, fade: 0, push: [], zoom: 0 },
  3: {
    max: 10,
    fade: 0.25,
    push: ['statement', 'chapter', 'quote', 'word', 'point', 'number'],
    zoom: 0.03
  },
  4: { max: 7, fade: 0.2, push: 'all', zoom: 0.04 },
  5: { max: 5, fade: 0.15, push: 'all', zoom: 0.05, punch: ['word'] }
}
// story teller: the cut is the sentence, so a picture holds for its sentence (≤ STORY_MAX s at any pace), and
// pictures dissolve into each other and push in slowly even at pace 1–2
const STORY = isStoryteller(style)
const P = { ...PACES[PACE] }
if (STORY) {
  P.max = STORY_MAX
  P.fade = Math.max(P.fade, STORY_FADE)
  if (P.push !== 'all') P.push = [...P.push, 'illustration']
  P.zoom = Math.max(P.zoom, 0.04)
}
// a slide far over its max stops the render from pace 3, and always in story-teller mode
const HARD = PACE >= 3 || STORY
const FPS = 30
// animations: "auto" = entrances etc. on every layout that suits them (window.anim in slide.html)
const ANIM = /^(auto|on|true)$/.test(String(flag('--anim', String(style.animate ?? 'off'))))
const STILL = ['subscribe', 'end']
const animated = (s) => ANIM && s.animate !== false && !STILL.includes(s.layout)
// camera: one slow move with parallax over the whole slide on scene and illustration slides (slide.html ›
// camera). A cue's "camera" wins; else style.json "camera" ("auto" = a drift on illustrations and layered
// scenes; a move name applies it to every scene and illustration); else none. Only with animations on.
// Story teller: camera "auto" by default, and "auto" gives each picture the next move in STORY_MOVES.
const CAMERA = flag('--camera', style.camera ?? (STORY ? 'auto' : 'off'))
const cameraFor = (s) => {
  if (!animated(s)) return undefined
  let c = s.camera ?? (['scene', 'illustration', 'flow'].includes(s.layout) ? CAMERA : 'off')
  if (STORY && c === 'auto' && s.layout === 'illustration' && s._shot != null)
    c = STORY_MOVES[s._shot % STORY_MOVES.length]
  return c === 'off' || c === 'none' || c === false ? undefined : c
}

const vdir = join(W, 'video')
mkdirSync(join(vdir, 'slides'), { recursive: true })
for (const w of style.story ? themeWarnings(style) : []) console.warn('warning: style.json ' + w)

// ---------- parse script.md into slides ----------
const sections = []
let sec = null
let slide = null
const cues = []
const problems = []
// a `> TONE <name>` cue waits for the next spoken line
let tone = null
readFileSync(join(W, 'script.md'), 'utf8')
  .split('\n')
  .forEach((raw, ln) => {
    const line = raw.trim()
    const h = line.match(/^##\s*\[([A-Z ]+?)(?:\s+(\d+))?\]\s*(.*)$/)
    if (h) {
      if (tone) problems.push(`line ${tone.ln}: TONE must come right before a spoken line`)
      tone = null
      sec = { tag: h[1].trim(), n: h[2] ? Number(h[2]) : null, title: h[3].trim() }
      sections.push(sec)
      slide = null
      return
    }
    if (!sec || !line || line.startsWith('#') || line.startsWith('<!--')) return
    if (line.startsWith('>')) {
      if (/^>\s*BEAT\s*$/i.test(line)) {
        if (slide?.say.length) (slide.beats ??= []).push(slide.say.length - 1)
        else problems.push(`line ${ln + 1}: BEAT must come right after a spoken line`)
        return
      }
      const tn = parseTone(line)
      if (tn !== null) {
        if (!tn)
          problems.push(
            `line ${ln + 1}: unknown TONE (${line.replace(/^>\s*TONE\s*:?\s*/i, '') || 'none given'}); use one of ${TONE_NAMES.join(', ')}`
          )
        else tone = { name: tn, ln: ln + 1 }
        return
      }
      const m = line.match(/^>\s*SLIDE\s+(\{.*\})\s*$/)
      if (m) {
        try {
          slide = { ...JSON.parse(m[1]), say: [], sec, line: ln + 1 }
          cues.push(slide)
        } catch (e) {
          problems.push(`line ${ln + 1}: SLIDE cue is not valid JSON (${e.message})`)
        }
      }
      return
    }
    if (!slide) problems.push(`line ${ln + 1}: spoken text in [${sec.tag}] before any SLIDE cue`)
    else {
      if (tone) (slide.tones ??= {})[slide.say.length] = tone.name
      slide.say.push(line)
    }
    tone = null
  })
if (tone) problems.push(`line ${tone.ln}: TONE must come right before a spoken line`)
if (!cues.length) problems.push('no `> SLIDE {…}` cues in script.md')
if (VERT) {
  // a Short: [HOOK] [PAYOFF] [LOOP]; no chapters, subscribe click or end screen (Shorts have none of them)
  for (const sc of sections)
    if (!['HOOK', 'PAYOFF', 'LOOP'].includes(sc.tag))
      problems.push(`[${sc.tag}]: a Short has only [HOOK], [PAYOFF] and [LOOP] sections`)
  for (const c of cues) {
    if (['chapter', 'subscribe', 'end'].includes(c.layout))
      problems.push(`line ${c.line}: no "${c.layout}" slide in a Short`)
    else if (['table', 'doc', 'fields', 'flow'].includes(c.layout))
      console.warn(
        `warning: line ${c.line}: a "${c.layout}" slide is hard to read on a phone; prefer number, point, chat or a scene`
      )
  }
}

// `points` (or a `flow`'s nodes) with reveal: one slide per point, spoken line i with point i
const slides = []
for (const c of cues) {
  if (!['points', 'flow'].includes(c.layout) || !c.reveal) {
    slides.push(c)
    continue
  }
  const flow = c.layout === 'flow'
  const pts = (flow ? c.nodes : c.points) || []
  if (c.say.length !== pts.length) {
    problems.push(
      `line ${c.line}: reveal needs one spoken line per ${flow ? 'node' : 'point'} (${pts.length} ${flow ? 'nodes' : 'points'}, ${c.say.length} lines); put each one's voiceover on its own line`
    )
    continue
  }
  // a flow grows one box at a time (the newest highlighted); "one" only applies to points
  if (flow) {
    pts.forEach((p, i) =>
      slides.push({
        ...c,
        sec: c.sec,
        line: c.line,
        say: [c.say[i]],
        beats: c.beats?.includes(i) ? [0] : [],
        tones: c.tones?.[i] ? { 0: c.tones[i] } : undefined,
        reveal: undefined,
        visible: i + 1,
        current: i
      })
    )
    continue
  }
  pts.forEach((p, i) => {
    const base = {
      sec: c.sec,
      line: c.line,
      say: [c.say[i]],
      highlight: c.highlight,
      beats: c.beats?.includes(i) ? [0] : [],
      tones: c.tones?.[i] ? { 0: c.tones[i] } : undefined
    }
    if (c.reveal === 'one')
      slides.push({
        ...base,
        layout: 'point',
        n: i + 1,
        of: pts.length,
        text: p.replace(/\*\*/g, ''),
        title: c.title
      })
    else slides.push({ ...c, ...base, reveal: undefined, visible: i + 1, current: i, done: i })
  })
}
// story teller: one sentence per picture (storyteller.mjs)
if (STORY) {
  const sc = storyChecks(slides)
  problems.push(...sc.problems)
  for (const w of sc.warnings) console.warn('warning: ' + w)
  let shot = 0
  for (const s of slides) if (s.layout === 'illustration') s._shot = shot++
}
if (problems.length) {
  problems.forEach((p) => console.error('PROBLEM: ' + p))
  process.exit(2)
}

// chapter cards before each idea (silent), labels for the chrome
const ideas = sections.filter((s) => s.tag === 'IDEA')
// labels for the chrome, in the video's language
const T = {
  en: {
    intro: 'Intro',
    half: 'Halfway',
    summary: 'Summary',
    chapter: 'Chapter',
    idea: 'Idea',
    of: 'of',
    subscribe: 'Subscribe',
    subscribed: 'Subscribed'
  },
  es: {
    intro: 'Introducción',
    half: 'A mitad',
    summary: 'Resumen',
    chapter: 'Capítulo',
    idea: 'Idea',
    of: 'de',
    subscribe: 'Suscribirme',
    subscribed: 'Suscrito'
  }
}[style.language === 'es' ? 'es' : 'en']
const label = (s) =>
  VERT
    ? ''
    : ({
        HOOK: '',
        INTRO: T.intro,
        'MID HOOK': T.half,
        SUMMARY: T.summary,
        OUTRO: ''
      }[s.tag] ??
      (s.tag === 'IDEA'
        ? style.story
          ? s.title
          : `${T.idea} ${s.n} ${T.of} ${ideas.length} · ${s.title}`
        : s.tag))
const all = []
let lastSec = null
for (const s of slides) {
  if (!VERT && s.sec !== lastSec && s.sec.tag === 'IDEA')
    all.push({
      layout: 'chapter',
      eyebrow: style.story
        ? `${T.chapter} ${s.sec.n}`
        : `${T.idea} ${s.sec.n} ${T.of} ${ideas.length}`,
      text: s.sec.title,
      say: [],
      hold: 2.2,
      sec: s.sec,
      auto: true
    })
  all.push(s)
  lastSec = s.sec
}
all.forEach((s, i) => (s.id = 's' + String(i + 1).padStart(3, '0')))
// the Subscribe pill and the "n of N" counter speak the video's language unless the cue sets them
all.forEach((s) => {
  if (s.layout === 'subscribe') {
    s.button ??= T.subscribe
    s.done ??= T.subscribed
  }
  if (s.layout === 'point') s.ofWord ??= T.of
})
// beats: every section but the outro ends on one (its conclusion, the hook's promise, the mid hook's tease)
for (const sc of sections) {
  const last = all.findLast((s) => s.sec === sc && s.say.length)
  if (last && sc.tag !== 'OUTRO' && sc.tag !== 'LOOP')
    last.beats = [...(last.beats || []), last.say.length - 1]
}
// a slide's voice is spoken in takes: a beat or a change of tone inside it splits it, and each take is spoken
// on its own (in its tone). `gap` = the silence before a take: the beat, or the tone's held breath before it
// (on a slide's first take, only what the pause after the previous slide doesn't already give).
// A beat on a slide's last line lengthens the pause after the slide instead.
const toneOf = (s, i) => (EXPRESSIVE > 0 ? s.tones?.[i] || null : null)
all.forEach((s, si) => {
  const beats = BEAT > 0 ? s.beats || [] : []
  const parts = []
  let cur = null
  s.say.forEach((l, i) => {
    const tn = toneOf(s, i)
    if (!cur || beats.includes(i - 1) || tn !== cur.tone) {
      cur = { lines: [], tone: tn, beat: i > 0 && beats.includes(i - 1) }
      parts.push(cur)
    }
    cur.lines.push(l)
  })
  s.beatEnd = s.say.length > 0 && beats.includes(s.say.length - 1)
  const prev = all[si - 1]
  const prevPad = !prev?.say.length
    ? GAP
    : prev.beatEnd
      ? BEAT
      : GAP + (prev.sec !== s.sec ? SECTION_GAP : 0)
  s.takes = parts.map((p, k) => {
    const d = p.tone ? delivery(p.tone, { scale: EXPRESSIVE, maxPause: MAX_PAUSE }) : null
    const before = d?.before || 0
    // the video never opens on silence: the first slide's first take starts at once
    const gap =
      k === 0 ? (si === 0 ? 0 : Math.max(0, before - prevPad)) : Math.max(p.beat ? BEAT : 0, before)
    return {
      id: parts.length === 1 ? s.id : `${s.id}-${k + 1}`,
      text: p.lines.join(' '),
      tone: p.tone,
      gap: Math.round(gap * 1000) / 1000
    }
  })
})
// a slide that continues the previous one (same layout and title/text, e.g. a list stepping `current`) only
// animates what changed
all.forEach((s, i) => {
  const p = all[i - 1]
  if (
    p &&
    !s.auto &&
    p.layout === s.layout &&
    p.sec === s.sec &&
    (s.title ?? s.text) === (p.title ?? p.text)
  )
    s._cont = true
})
const moving = P.fade > 0 || P.push.length > 0 || all.some(animated)

// ---------- browser ----------
const fam = families(style)
const ytIcon = join(skill, 'assets/youtube/youtube-icon.svg')
const html = readFileSync(join(skill, 'assets/slide.html'), 'utf8')
  .replace('/*FONTS*/', () => fontsCss(style))
  .replace('/*DOODLES*/', () => readFileSync(join(skill, 'assets/doodles.js'), 'utf8'))
  .replace('/*SCENES*/', () => readFileSync(join(skill, 'assets/scenes.js'), 'utf8'))
  .replace('__LOGO__', () => (style.brand && style.logo ? dataUrl(style.logo) : ''))
  .replace('__YTICON__', () => (existsSync(ytIcon) ? dataUrl(ytIcon) : ''))
const pagePath = join(vdir, '.slide.html')
writeFileSync(pagePath, html)
const ch = channel(style)

let browser
try {
  browser = await launchBrowser()
} catch (e) {
  stop(e.message)
}

// ---------- voice ----------
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const durations = {}
// tones: the timing for every voice; the acting for the paid ones (OpenAI follows instructions per line,
// ElevenLabs gets expressive settings and, on eleven_v3, an audio tag)
const PROVIDER = providerOf(VOICE)
// OpenAI voices: style.json voiceModel, else the config's models.speech (providers.mjs --check tests that one)
const MODEL = style.voiceModel || (PROVIDER === 'openai' ? style.config.models?.speech || '' : '')
const BASE_INSTRUCTIONS =
  style.voiceInstructions ||
  (PROVIDER === 'openai' && EXPRESSIVE > 0 ? NARRATOR[style.language === 'es' ? 'es' : 'en'] : '')
const toneCount = {}
for (const k of all.flatMap((s) => s.takes))
  if (k.tone) toneCount[k.tone] = (toneCount[k.tone] || 0) + 1
const toneLine = Object.entries(toneCount)
  .map(([t, n]) => `${t} ${n}`)
  .join(', ')
if (EXPRESSIVE > 0 && !toneLine)
  console.warn(
    'warning: no `> TONE` cues: the whole voiceover is read in one tone (script playbook › Emotion and delivery)'
  )
if (!onlySlides) {
  const lines = all.flatMap((s) =>
    s.takes.map((k) => {
      const d = k.tone ? delivery(k.tone, { scale: EXPRESSIVE, maxPause: MAX_PAUSE }) : null
      if (!d) return { id: k.id, text: k.text }
      const line = {
        id: k.id,
        text: k.text,
        speed: Math.round(SPEED * d.speedFactor * 1000) / 1000,
        maxPause: Math.round(d.maxPause * 1000) / 1000
      }
      if (PROVIDER === 'openai')
        line.instructions = [BASE_INSTRUCTIONS, d.instructions].filter(Boolean).join(' ')
      if (PROVIDER === 'elevenlabs') {
        line.settings = d.settings
        if (/^eleven_v3/.test(MODEL)) line.text = `${d.tag} ${k.text}`
      }
      return line
    })
  )
  console.log(
    `voice: ${VOICE} at speed ${SPEED}, ${lines.length} lines, ${lines.reduce((a, l) => a + words(l.text), 0)} words` +
      (toneLine
        ? `; tones: ${toneLine}${EXPRESSIVE !== 1 ? ` (expressive ${EXPRESSIVE})` : ''}`
        : '')
  )
  Object.assign(
    durations,
    speak(lines, join(vdir, 'voice'), {
      voice: VOICE,
      speed: SPEED,
      lang: LANG,
      maxPause: MAX_PAUSE,
      model: MODEL,
      instructions: BASE_INSTRUCTIONS
    })
  )
  // the voice's real rate, to keep voices.mjs (and every estimate) honest
  const spokenSecs = Object.values(durations).reduce((a, x) => a + x, 0)
  const spokenWords = lines.reduce((a, l) => a + words(l.text), 0)
  if (spokenSecs > 0) {
    const real = Math.round(spokenWords / (spokenSecs / 60))
    console.log(`voice: ${real} wpm as spoken (voices.mjs estimates ${RATE_EST})`)
    if (Math.abs(real - RATE_EST) / RATE_EST > 0.1)
      console.warn(
        `warning: ${VOICE} reads ${Math.round((100 * (real - RATE_EST)) / RATE_EST)}% off the estimate: update RATES in scripts/voices.mjs so the checker times scripts right`
      )
  }
} else if (toneLine) console.log(`tones: ${toneLine}`)

// ---------- timeline ----------
// The voice never waits for the pictures: between slides there is only GAP (a breath) and SECTION_GAP at a
// section change, and a chapter card is shown over the opening of its idea's first line instead of in silence.
// s.start/s.dur = when the slide is on screen; s.astart = when its voice starts (earlier than s.start only
// for the slide right after a chapter card).
// before the voice exists, estimate each take at the chosen voice's rate (voices.mjs)
const RATE = RATE_EST
// (a toned take at its own speed: suspense and serious lines are read slower)
const toneSpeed = (k) =>
  (k.tone && delivery(k.tone, { scale: EXPRESSIVE, maxPause: MAX_PAUSE })?.speedFactor) || 1
const takeLen = (k) =>
  onlySlides ? ((words(k.text) / RATE) * 60) / toneSpeed(k) : durations[k.id] || 0
const voiceLen = (s) => s.takes.reduce((a, k) => a + k.gap + takeLen(k), 0)
let t = 0
all.forEach((s, i) => {
  const next = all[i + 1]
  s.audio = voiceLen(s)
  s.start = t
  s.astart = s.carry ?? t
  if (s.auto && next && next.say.length) {
    s.dur = Math.min(CHAPTER, Math.max(0.8, voiceLen(next) * 0.45))
    next.carry = t
  } else if (s.say.length) {
    let pad = GAP + (next && next.sec !== s.sec ? SECTION_GAP : 0)
    if (s.beatEnd && next) pad = Math.max(pad, BEAT)
    s.dur = s.astart + s.audio + pad - t
  } else s.dur = s.hold ?? 2
  if (s.layout === 'end' && !next) s.dur = Math.max(s.dur, END_HOLD)
  t += s.dur
})
const total = t
const fmt = (sec) => {
  sec = Math.round(sec)
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
}

// with the real voice every slide's length is known now: stop before filming the clips (minutes of work) when
// a slide is far too long for the pace. The voice is cached, so the re-run after the fix buys nothing again.
if (!onlySlides) {
  const far = all.filter(
    (s) => s.say.length && !['end', 'subscribe'].includes(s.layout) && HARD && s.dur > P.max * 1.3
  )
  if (far.length) {
    for (const s of far)
      console.error(
        `PROBLEM [${s.id}, script line ${s.line}, ${s.layout}] ${s.dur.toFixed(1)}s on screen with the real voice; ${STORY ? 'story teller' : `pace ${PACE}`} wants ≤ ${P.max}s: ${STORY ? 'split the sentence in two, each with its own picture' : 'add a SLIDE cue between its lines (no new words, nothing re-bought) or split a sentence'}`
      )
    await browser.close()
    stop(
      'fix the slides above and re-run: stopped before filming the clips; the voice is already cached.',
      2
    )
  }
}

// frames: what is actually on screen. A subscribe slide is clicked over 3 frames (resting, cursor, subscribed),
// timed against its voice; every other slide is one frame.
const frames = []
for (const s of all) {
  const parts =
    s.layout === 'subscribe'
      ? [
          [0, 0.4],
          [1, 0.15],
          [2, 0.45]
        ]
      : [[null, 1]]
  let at = s.start
  parts.forEach(([f, frac], k) => {
    const dur = k === parts.length - 1 ? s.start + s.dur - at : s.dur * frac
    frames.push({
      s,
      f,
      k,
      png: join(vdir, 'slides', s.id + (f == null ? '' : `-${k + 1}`) + '.png'),
      start: at,
      dur
    })
    at += dur
  })
}

// ---------- clip plan (pace 3–5, or any animated slide) ----------
// Every frame becomes a clip (push-in where the pace wants it; animated slides are filmed frame by frame),
// then clips are joined with crossfades. A clip runs `fade` seconds longer than its slot so the crossfade
// overlaps the next slot, which keeps every slide starting exactly at its timeline time.
const clipsDir = join(vdir, 'clips')
const pushes = (s) =>
  s.layout !== 'end' && s.layout !== 'subscribe' && (P.push === 'all' || P.push.includes(s.layout))
// transition out of frame i into frame i+1: cut inside a subscribe click, into/out of punchy word slides at pace 5
const fadeOut = (i) => {
  const a = frames[i]
  const b = frames[i + 1]
  if (!b || P.fade === 0) return 0
  if (a.s === b.s) return 0
  if (P.punch && (P.punch.includes(a.s.layout) || P.punch.includes(b.s.layout))) return 0
  return P.fade
}
// `filmed` = the slide's own camera moves it for the whole slot (slide.html), so no push-in on top
const plan = (i, filmed = false) => {
  const fr = frames[i]
  const T = fadeOut(i)
  const n = Math.max(1, Math.round((fr.dur + T) * FPS))
  const punch = P.punch && P.punch.includes(fr.s.layout)
  const z =
    !filmed && pushes(fr.s)
      ? punch
        ? `1+${P.zoom * 1.6}*min(on/12\\,1)+${P.zoom * 0.4}*on/${n}`
        : `1+${P.zoom}*on/${n}`
      : '1'
  const vf =
    z === '1'
      ? `scale=${VW}:${VH},fps=${FPS},format=yuv420p,settb=AVTB`
      : `scale=${VW * 2}:${VH * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${VW}x${VH}:fps=${FPS},format=yuv420p,settb=AVTB`
  return { T, n, vf }
}
const ENC = ['-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']
const stillClip = (fr, i) => {
  const { n, vf } = plan(i)
  const key = createHash('sha1')
    .update(readFileSync(fr.png))
    .update(`|${n}|${vf}`)
    .digest('hex')
    .slice(0, 16)
  const file = join(clipsDir, key + '.mp4')
  if (!existsSync(file))
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-i',
      fr.png,
      '-frames:v',
      String(n),
      '-vf',
      vf,
      ...ENC,
      file
    ])
  return file
}

// Films the slide on the page: window.anim() builds its animations, then every frame of the intro (and one
// idle loop for scenes) is screenshotted and piped into ffmpeg, which holds the last frame (or repeats the loop)
// for the rest of the slot and applies the pace's push-in. Returns null when the slide has nothing to animate.
const animTemplate = createHash('sha1')
  .update(html)
  .update(readFileSync(join(skill, 'assets/scenes.js')))
  .digest('hex')
async function animClip(fr, i, spec) {
  const { n, vf } = plan(i)
  const key = createHash('sha1')
    .update(
      [
        animTemplate,
        JSON.stringify(spec),
        style.brand ? fr.start.toFixed(2) : '',
        fr.dur.toFixed(2),
        n,
        vf,
        VERT ? 'anim1v' : 'anim1'
      ].join('|')
    )
    .digest('hex')
    .slice(0, 16)
  const file = join(clipsDir, 'a-' + key + '.mp4')
  const none = join(clipsDir, 'a-' + key + '.none')
  if (existsSync(file)) return file
  if (existsSync(none)) return null
  mkdirSync(clipsDir, { recursive: true })
  // dur = the clip's length: the camera and particles (if any) run over all of it
  const dur = n / FPS
  let info = await page.evaluate(([S, fps, dur]) => window.anim(S, { fps, dur }), [spec, FPS, dur])
  if (!info.intro && !info.loop && !info.full) {
    writeFileSync(none, '')
    return null
  }
  // a short slide plays its entrance faster: it never takes more than 60 % of the time on screen
  const room = fr.dur * 0.6
  if (info.intro > room)
    info = await page.evaluate(
      ([S, fps, speed, dur]) => window.anim(S, { fps, speed, dur }),
      [spec, FPS, info.intro / room, dur]
    )
  const intro = Math.round(info.intro * FPS)
  const L = info.loop && fr.dur > info.intro + 0.6 ? Math.round(info.loop * FPS) : 0
  // a moving camera or particles: film every frame of the slot (no held frame, no loop, no push-in on top)
  const count = info.full ? n : Math.min(n, L ? intro + L : intro + 1)
  const pre = info.full
    ? ''
    : L && count === intro + L
      ? `loop=loop=-1:size=${L}:start=${intro},`
      : 'tpad=stop_mode=clone:stop=-1,'
  const filter = info.full ? plan(i, true).vf : vf
  const ffp = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-framerate',
      String(FPS),
      '-i',
      '-',
      '-vf',
      pre + filter,
      '-frames:v',
      String(n),
      ...ENC,
      file
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  )
  const done = new Promise((ok, ko) =>
    ffp.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg exited ' + c))))
  )
  for (let k = 0; k < count; k++) {
    await page.evaluate((t) => window.seek(t), k / FPS)
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 })
    if (!ffp.stdin.write(buf)) await new Promise((r) => ffp.stdin.once('drain', r))
  }
  ffp.stdin.end()
  await done
  return file
}

// ---------- slides ----------
const page = await browser.newPage({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(pathToFileURL(pagePath).href)
if (VERT) await page.evaluate(() => document.documentElement.classList.add('vertical'))
await page.evaluate(() => document.fonts.ready)
let failed = false
for (const fr of frames) {
  const s = fr.s
  const spec = {
    ...s,
    sec: undefined,
    say: undefined,
    beats: undefined,
    beatEnd: undefined,
    takes: undefined,
    tones: undefined,
    _frame: fr.f ?? undefined,
    _camera: cameraFor(s)
  }
  if (s.layout === 'image' && s.src) {
    const p = resolve(W, s.src)
    if (!existsSync(p)) {
      console.error(`PROBLEM [${s.id}, line ${s.line}]: image not found: ${s.src}`)
      failed = true
    } else spec._src = dataUrl(p)
  }
  // generated pictures (scripts/gen-images.mjs): an illustration (one picture, or `layers`: a backdrop and
  // cut-outs), or a scene's background. Returns a data URL, or null after reporting it missing.
  const picture = (src, prompt, kind) => {
    const p = src ? resolve(W, src) : prompt ? genPath(W, prompt, style, kind) : null
    if (p && existsSync(p)) return dataUrl(p)
    const msg = `[${s.id}, line ${s.line}]: ${src ? 'image not found: ' + src : 'picture not generated yet: run scripts/gen-images.mjs'}`
    if (onlySlides) console.warn('warning ' + msg + ' (placeholder for now)')
    else {
      console.error('PROBLEM ' + msg)
      failed = true
    }
    return null
  }
  if (s.layout === 'illustration' && Array.isArray(s.layers) && s.layers.length) {
    const got = s.layers.map((l, j) => ({
      src: picture(l.src, l.prompt, j ? 'layer' : 'backdrop'),
      depth: l.depth ?? (s.layers.length > 1 ? j / (s.layers.length - 1) : 1),
      blur: l.blur,
      // where the cut-out's centre goes in the 1920×1080 frame, and its size (cut-outs come back centred)
      x: l.x,
      y: l.y,
      scale: l.scale
    }))
    if (got.every((l) => l.src)) spec._layers = got
  } else if (s.layout === 'illustration') {
    const u = picture(s.src, s.prompt, 'illustration')
    if (u) spec._src = u
  } else if (s.layout === 'scene' && s.bg && typeof s.bg === 'object') {
    const u = picture(s.bg.src, s.bg.prompt, 'background')
    if (u) spec._bg = u
  }
  await page.evaluate(
    ([spec, chrome]) => window.show(spec, chrome),
    [
      spec,
      {
        label: label(s.sec),
        progress: total ? fr.start / total : 0,
        brand: style.brand,
        name: ch.name,
        mascot: style.mascot,
        theme: style.theme,
        fonts: fam,
        channel: ch
      }
    ]
  )
  await page.evaluate(() =>
    Promise.all([...document.images].map((im) => im.decode().catch(() => {})))
  )
  await page.waitForTimeout(
    ['image', 'subscribe', 'illustration'].includes(s.layout) || spec._bg ? 120 : 0
  )
  if (errors.length) stop(`slide ${s.id}: template error: ${errors.join(' | ')}`, 2)
  if (fr.k === 0) {
    const issues = await page.evaluate(() => window.check())
    for (const i of issues)
      console.error(
        `PROBLEM [${s.id}${s.line ? ', script line ' + s.line : ''}, ${s.layout}]: ${i}`
      )
    if (issues.length) failed = true
  }
  await page.screenshot({ path: fr.png })
  // animated slide: film it now, while it's on the page (cached by content, so re-renders are quick)
  const i = frames.indexOf(fr)
  if (fr.f == null && animated(s) && (!onlySlides || preview.has(s.id)))
    fr.animFile = await animClip(fr, i, spec)
}
rmSync(pagePath, { force: true })
console.log(`rendered ${frames.length} frames (${all.length} slides) to ${join(vdir, 'slides')}`)

// pace: slides that stay up too long
const tooLong = all.filter(
  (s) => s.say.length && s.layout !== 'end' && s.layout !== 'subscribe' && s.dur > P.max
)
for (const s of tooLong) {
  const hard = HARD && s.dur > P.max * 1.3
  const msg = `[${s.id}, script line ${s.line}, ${s.layout}] ${s.dur.toFixed(1)}s on screen; ${STORY ? 'story teller' : `pace ${PACE}`} wants ≤ ${P.max}s: ${STORY ? 'split the sentence, each half with its own picture' : 'split it (another cue, or reveal on points)'}`
  if (hard) {
    console.error('PROBLEM ' + msg)
    failed = true
  } else console.warn('warning ' + msg)
}

// contact sheet: every frame small, with its start time
{
  const cells = frames
    .map(
      (fr) =>
        `<figure><img src="${pathToFileURL(fr.png).href}"><figcaption>${fr.s.id}${fr.f == null ? '' : '.' + (fr.k + 1)} · ${fmt(fr.start)} · ${fr.dur.toFixed(1)}s · ${fr.s.layout}${animated(fr.s) ? ' ▶' : ''}${fr.s.dur > P.max && fr.s.say.length && fr.s.layout !== 'end' ? ' ⚠' : ''}</figcaption></figure>`
    )
    .join('')
  const sheetHtml = join(vdir, '.sheet.html')
  // landscape: 6 across at 320×180; a Short: 8 across at 216×384
  const [cw, chh, across] = VERT ? [216, 384, 8] : [320, 180, 6]
  writeFileSync(
    sheetHtml,
    `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#ddd;font:14px monospace;display:grid;grid-template-columns:repeat(${across},${cw}px);gap:14px;width:max-content}figure{margin:0}img{width:${cw}px;height:${chh}px;display:block;border-radius:6px}figcaption{margin-top:4px;color:#333;font-size:${VERT ? 12 : 14}px;overflow-wrap:anywhere}</style>${cells}`
  )
  const p2 = await browser.newPage({ viewport: { width: 2100, height: 600 } })
  await p2.goto(pathToFileURL(sheetHtml).href)
  await p2.waitForLoadState('load')
  await p2.screenshot({ path: join(vdir, 'sheet.png'), fullPage: true })
  rmSync(sheetHtml, { force: true })
  console.log(`wrote ${join(vdir, 'sheet.png')}`)
}
// captions for a Short: one transparent PNG per 2–4-word chunk (this ffmpeg may lack libass/drawtext, so the
// page draws them in the video's fonts), laid over the video as one track when muxing
const capDir = join(vdir, 'captions')
let capList = null
if (CAPTIONS && !onlySlides && !failed) capList = await renderCaptions(captionCues())
await browser.close()
if (failed) stop('fix the slide problems above and re-run.', 2)

console.log(
  `${onlySlides ? 'estimated' : 'total'} length ${fmt(total)} (${all.length} slides, ${STORY ? `story teller, ${all.filter((s) => s.layout === 'illustration').length} pictures, pace ${PACE}: ≤ ${P.max}s a sentence` : `pace ${PACE}: ≤ ${P.max}s a slide`}${P.fade ? `, ${P.fade}s crossfades` : ', cuts'}${P.push.length ? ', push-ins' : ''})`
)
{
  // `minutes` (8–20) from style.json is the target: warn when the render lands over a minute off it
  const T = Number(style.minutes)
  const [lo, hi] = Number.isFinite(T) ? [Math.max(8, T - 1), Math.min(20, T + 1)] : [12, 18]
  // the length before the end slide, when there is one (its hold is for YouTube's end screen)
  const last = all[all.length - 1]
  const body = last && last.layout === 'end' ? total - last.dur : total
  // a Short: 30–55 s is the target; YouTube takes up to 3 min, but past 60 s it stops looping and loses reach
  if (VERT && !preview.size && (body < 20 || body > 58))
    console.warn(
      `warning: the Short runs ${fmt(body)}; aim for 30–55 s (shorts-playbook.md › Length)`
    )
  if (!VERT && !preview.size && (body < lo * 60 || body > hi * 60))
    console.warn(
      `warning: ${fmt(body)} before the end slide is outside ${lo}–${hi} min${Number.isFinite(T) ? ` (target ${T} min)` : ''}`
    )
}
if (preview.size) {
  // the named slides as they will move (estimated length, no voice)
  for (const id of preview) {
    const i = frames.findIndex((fr) => fr.s.id === id)
    if (i < 0) {
      console.warn(`preview: no slide ${id}`)
      continue
    }
    const out = join(vdir, `preview-${id}.mp4`)
    const src = frames[i].animFile || (moving ? stillClip(frames[i], i) : null)
    if (!src) {
      console.warn(`preview: ${id} is a still slide at pace ${PACE} with animations off`)
      continue
    }
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      src,
      '-t',
      frames[i].dur.toFixed(3),
      '-c',
      'copy',
      out
    ])
    console.log(
      `wrote ${out} (${frames[i].dur.toFixed(1)}s${frames[i].animFile ? ', animated' : ''})`
    )
  }
}
if (onlySlides) process.exit(0)

// ---------- audio ----------
const ff = (a, opts) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], opts)
const tmp = join(vdir, '.build')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
const silence = (sec) => {
  const ms = Math.max(1, Math.round(sec * 1000))
  const p = join(tmp, `sil-${ms}.wav`)
  if (!existsSync(p))
    ff([
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=24000:cl=mono',
      '-t',
      String(ms / 1000),
      '-c:a',
      'pcm_s16le',
      p
    ])
  return p
}
// laid out by voice start, not by slide: a line that starts under a chapter card plays straight on
const aList = []
let at = 0
for (const s of all) {
  if (!s.say.length) continue
  if (s.astart - at > 0.001) aList.push(silence(s.astart - at))
  s.takes.forEach((k) => {
    if (k.gap > 0.0005) aList.push(silence(k.gap))
    aList.push(join(vdir, 'voice', k.id + '.wav'))
  })
  at = s.astart + s.audio
}
if (total - at > 0.001) aList.push(silence(total - at))
writeFileSync(join(tmp, 'a.txt'), aList.map((p) => `file '${p}'`).join('\n'))
// normalise every piece to the same PCM format, then join
ff([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  join(tmp, 'a.txt'),
  '-ar',
  '24000',
  '-ac',
  '1',
  '-c:a',
  'pcm_s16le',
  join(tmp, 'voice.wav')
])
mkdirSync(dirname(outFile), { recursive: true })

// ---------- video ----------
const silent = join(tmp, 'video.mp4')
if (!moving) {
  // pace 1–2: still slides joined with hard cuts (fast)
  const vList = []
  for (const fr of frames) vList.push(`file '${fr.png}'`, `duration ${fr.dur.toFixed(3)}`)
  vList.push(`file '${frames[frames.length - 1].png}'`)
  writeFileSync(join(tmp, 'v.txt'), vList.join('\n'))
  console.log('encoding video (still slides, cuts)…')
  ff(
    [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(tmp, 'v.txt'),
      '-vf',
      'fps=30,format=yuv420p',
      '-c:v',
      'libx264',
      '-tune',
      'stillimage',
      '-crf',
      '20',
      '-preset',
      'medium',
      silent
    ],
    { stdio: 'inherit' }
  )
} else {
  // pace 3–5 or animated slides: one clip per frame (see "clip plan"), joined with crossfades
  mkdirSync(clipsDir, { recursive: true })
  const clips = frames.map((fr, i) => {
    const { T, n } = plan(i)
    return { file: fr.animFile || stillClip(fr, i), len: n / FPS, T }
  })
  console.log(`rendered ${clips.length} clips (cached in ${clipsDir})`)

  // join a run of clips: crossfade where T > 0, cut otherwise. Output length = Σ slot + last T.
  let chunkNo = 0
  const join_ = (list) => {
    const out = join(tmp, `chunk-${++chunkNo}.mp4`)
    if (list.length === 1) return { ...list[0] }
    const inputs = list.flatMap((c) => ['-i', c.file])
    // every input and every intermediate on the same frame rate + timebase, or xfade refuses to join them
    const f = list.map((_, i) => `[${i}:v]fps=${FPS},settb=AVTB[i${i}]`)
    let prev = '[i0]'
    let acc = list[0].len
    for (let i = 1; i < list.length; i++) {
      const T = list[i - 1].T
      const lab = `[v${i}]`
      if (T > 0) {
        f.push(
          `${prev}[i${i}]xfade=transition=fade:duration=${T}:offset=${(acc - T).toFixed(4)},settb=AVTB${lab}`
        )
        acc = acc - T + list[i].len
      } else {
        f.push(`${prev}[i${i}]concat=n=2:v=1:a=0,settb=AVTB${lab}`)
        acc += list[i].len
      }
      prev = lab
    }
    ff([
      ...inputs,
      '-filter_complex',
      f.join(';'),
      '-map',
      prev,
      '-c:v',
      'libx264',
      '-crf',
      '16',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      out
    ])
    return { file: out, len: acc, T: list[list.length - 1].T }
  }
  const CHUNK = Number(process.env.YT_CHUNK) || 25 // clips per ffmpeg join (env only to test the multi-pass path)
  let level = clips
  while (level.length > 1) {
    const next = []
    for (let i = 0; i < level.length; i += CHUNK) next.push(join_(level.slice(i, i + CHUNK)))
    level = next
    console.log(`joined into ${level.length} part${level.length > 1 ? 's' : ''}…`)
  }
  ff(
    [
      '-i',
      level[0].file,
      '-t',
      total.toFixed(3),
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-preset',
      'medium',
      '-pix_fmt',
      'yuv420p',
      silent
    ],
    { stdio: 'inherit' }
  )
}

console.log(capList ? 'muxing voice and captions…' : 'muxing voice…')
ff(
  [
    '-i',
    silent,
    '-i',
    join(tmp, 'voice.wav'),
    ...(capList
      ? [
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          capList,
          '-filter_complex',
          `[2:v]fps=${FPS},format=rgba[c];[0:v][c]overlay=0:0:eof_action=pass,format=yuv420p[v]`,
          '-map',
          '[v]',
          '-c:v',
          'libx264',
          '-crf',
          '18',
          '-preset',
          'medium'
        ]
      : ['-map', '0:v', '-c:v', 'copy']),
    '-map',
    '1:a',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    '-shortest',
    outFile
  ],
  { stdio: 'inherit' }
)
rmSync(tmp, { recursive: true, force: true })

// ---------- subtitles + chapters (real times) ----------
const ts = (sec) => {
  const ms = Math.round(sec * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}
// each spoken take split into pieces (sentences for the .srt, 2–4-word chunks for a Short's captions), its
// length shared out by characters: [{ at, end, text }]
function timedPieces(split) {
  const out = []
  for (const s of all.filter((x) => x.say.length)) {
    let c = s.astart
    for (const k of s.takes) {
      c += k.gap
      const pieces = split(k.text)
      const chars = pieces.reduce((a, x) => a + x.length, 0) || 1
      const len = takeLen(k)
      for (const x of pieces) {
        const d = (x.length / chars) * len
        out.push({ at: c, end: c + d, text: x })
        c += d
      }
    }
  }
  return out
}
const sentencesOf = (text) =>
  (text.match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g) || []).map((x) => x.trim()).filter(Boolean)
// caption chunks: up to 3 words or ~16 characters, and a chunk always ends at punctuation
function captionCues() {
  return timedPieces((text) => {
    const chunks = []
    let cur = []
    for (const w of text.replace(/\*\*/g, '').split(/\s+/).filter(Boolean)) {
      cur.push(w)
      if (cur.length >= 3 || cur.join(' ').length >= 16 || /[,.!?;:…]["')]?$/.test(w)) {
        chunks.push(cur.join(' '))
        cur = []
      }
    }
    if (cur.length) chunks.push(cur.join(' '))
    return chunks
  })
}
// draws each caption chunk on a transparent 1080×1920 page (the video's display font, white with a thick
// outline in the theme's ink, centred at y ≈ 1340: under the slide text, above YouTube's title overlay) and
// writes an ffmpeg concat list that shows each one for its time and nothing in between
async function renderCaptions(cues) {
  rmSync(capDir, { recursive: true, force: true })
  mkdirSync(capDir, { recursive: true })
  const ink = style.theme?.second || '#111'
  const p = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })
  await p.setContent(
    `<!doctype html><meta charset="utf-8"><style>${fontsCss(style)}
    html,body{margin:0;width:${VW}px;height:${VH}px;background:transparent}
    #c{position:absolute;left:90px;right:120px;top:1270px;height:170px;display:flex;align-items:center;justify-content:center;text-align:center;
      font-family:${fam.display || 'sans-serif'};font-weight:800;font-size:76px;line-height:1.05;color:#fff;
      -webkit-text-stroke:16px ${ink};paint-order:stroke fill;letter-spacing:.01em}</style><div id="c"></div>`
  )
  await p.evaluate(() => document.fonts.ready)
  const blank = join(capDir, 'blank.png')
  await p.screenshot({ path: blank, omitBackground: true })
  const list = []
  let t = 0
  for (const [i, c] of cues.entries()) {
    if (c.at - t > 0.001) list.push(`file '${blank}'`, `duration ${(c.at - t).toFixed(3)}`)
    const png = join(capDir, `c${String(i + 1).padStart(4, '0')}.png`)
    await p.evaluate((txt) => {
      const e = document.getElementById('c')
      e.textContent = txt
      // one or two lines: shrink a long chunk until it fits
      let fs = 76
      e.style.fontSize = fs + 'px'
      while (fs > 48 && (e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth)) {
        fs -= 4
        e.style.fontSize = fs + 'px'
      }
    }, c.text)
    await p.screenshot({ path: png, omitBackground: true })
    list.push(`file '${png}'`, `duration ${(c.end - c.at).toFixed(3)}`)
    t = c.end
  }
  list.push(`file '${blank}'`, `duration ${Math.max(0.1, total - t).toFixed(3)}`, `file '${blank}'`)
  await p.close()
  const file = join(capDir, 'captions.txt')
  writeFileSync(file, list.join('\n'))
  console.log(`rendered ${cues.length} captions to ${capDir}`)
  return file
}

const out = dirname(outFile)
const srt = timedPieces(sentencesOf).map(
  (c, i) => `${i + 1}\n${ts(c.at)} --> ${ts(c.end)}\n${c.text}\n`
)
const srtFile = join(out, VERT ? 'short.srt' : 'video.srt')
writeFileSync(srtFile, srt.join('\n'))
// the timeline as rendered: lets a later step cut a clip (a hook preview) or find a moment by time
writeFileSync(
  join(out, VERT ? 'short-timeline.json' : 'timeline.json'),
  JSON.stringify(
    {
      total: Math.round(total * 1000) / 1000,
      slides: all.map((s) => ({
        id: s.id,
        section: s.sec.tag + (s.sec.n ? ' ' + s.sec.n : ''),
        layout: s.layout,
        line: s.line,
        start: Math.round(s.start * 1000) / 1000,
        dur: Math.round(s.dur * 1000) / 1000,
        voiceStart: Math.round(s.astart * 1000) / 1000,
        takes: s.takes.map((k) => ({ id: k.id, tone: k.tone, text: k.text }))
      }))
    },
    null,
    2
  ) + '\n'
)
if (!VERT) {
  const chapters = [{ at: 0, title: T.intro }]
  for (const s of all) {
    if (s.auto) chapters.push({ at: s.start, title: s.sec.title })
    if (s.sec.tag === 'SUMMARY' && !chapters.some((c) => c.title === T.summary))
      chapters.push({ at: s.start, title: T.summary })
  }
  writeFileSync(
    join(out, 'chapters.txt'),
    chapters.map((c) => `${fmt(c.at)} ${c.title}`).join('\n') + '\n'
  )
}
const endSlide = all[all.length - 1]
const mb = (statSync(outFile).size / 1048576).toFixed(1)
console.log(
  `wrote ${outFile}  (${VW}×${VH}, ${fmt(total)}, ${mb} MB, MP4 · H.264 + AAC, pace ${PACE}, voice ${VOICE}${capList ? ', captions' : ''})`
)
console.log(
  `wrote ${srtFile}${VERT ? '' : ', chapters.txt (real times)'} and the timeline (${VERT ? 'short-' : ''}timeline.json)`
)
if (endSlide.layout === 'end')
  console.log(
    `end slide from ${fmt(endSlide.start)} to ${fmt(total)}: add the end screen there in Studio`
  )
