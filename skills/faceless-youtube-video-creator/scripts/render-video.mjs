#!/usr/bin/env node
// Renders the voiceover + slides video from script.md, locally: Kokoro voice (tts.py), Playwright slides, ffmpeg.
//
//   node render-video.mjs <$W> [--slides] [--preview s012,s020] [--voice af_heart] [--speed 0.92] [--pace 1-5]
//                             [--anim auto|off] [--gap 0.1] [--section-gap 0.3] [--max-pause 0.2] [--beat 0.6]
//                             [--out <file.mp4>]
//
//   --slides   only render the slide PNGs + $W/video/sheet.png (no voice, no MP4): fast layout check
//   --preview  like --slides, plus a short MP4 of each named slide as it will move ($W/video/preview-<id>.mp4)
//   --anim     animations: "auto" animates every slide where it suits (entrances, count-ups, drawn doodles,
//              acting characters); "off" = still slides. Default: style.json "animate", else off
//   default    voice for every slide (cached; only changed lines are re-spoken), then
//              $W/out/video.mp4 (1920×1080, 30 fps, H.264 + AAC), $W/out/video.srt, $W/out/chapters.txt (real times)
//
// Look, pace and voice come from $W/style.json (see style.mjs); flags override it. Pace 1–2 = hard cuts on still
// slides; 3–5 = slow push-ins and crossfades, shorter slides (profile below; spec: ../references/video-playbook.md).
// Slides come from `> SLIDE {json}` cues in $W/script.md: each cue starts a slide, and the spoken lines after it
// (until the next cue) are that slide's voiceover.
// Exit code 2 = a slide overflows or runs too long for the pace, a spoken line has no slide, or the script is malformed.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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
import { langFor, speak } from './tts-setup.mjs'

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
const VOICE = flag('--voice', style.voice || 'af_heart')
const SPEED = Number(flag('--speed', String(style.speed ?? 0.92)))
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
const LANG = flag('--lang', langFor(VOICE))
// style.json "language" (asked before the script) and the voice must agree: an English voice can't read Spanish
if (style.language && !LANG.startsWith(style.language)) {
  console.error(
    `render-video: style.json says language "${style.language}" but ${VOICE} speaks ${LANG}; pick a ${style.language} voice (voice-samples.mjs --lang ${style.language})`
  )
  process.exit(2)
}
const PACE = Math.min(5, Math.max(1, Math.round(Number(flag('--pace', String(style.pace ?? 2))))))
const outFile = resolve(flag('--out', join(W, 'out', 'video.mp4')))
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
const P = PACES[PACE]
const FPS = 30
// animations: "auto" = entrances etc. on every layout that suits them (window.anim in slide.html)
const ANIM = /^(auto|on|true)$/.test(String(flag('--anim', String(style.animate ?? 'off'))))
const STILL = ['subscribe', 'end']
const animated = (s) => ANIM && s.animate !== false && !STILL.includes(s.layout)

const vdir = join(W, 'video')
mkdirSync(join(vdir, 'slides'), { recursive: true })
for (const w of style.story ? themeWarnings(style) : []) console.warn('warning: style.json ' + w)

// ---------- parse script.md into slides ----------
const sections = []
let sec = null
let slide = null
const cues = []
const problems = []
readFileSync(join(W, 'script.md'), 'utf8')
  .split('\n')
  .forEach((raw, ln) => {
    const line = raw.trim()
    const h = line.match(/^##\s*\[([A-Z ]+?)(?:\s+(\d+))?\]\s*(.*)$/)
    if (h) {
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
    else slide.say.push(line)
  })
if (!cues.length) problems.push('no `> SLIDE {…}` cues in script.md')

// `points` with reveal: one slide per point, spoken line i with point i
const slides = []
for (const c of cues) {
  if (c.layout !== 'points' || !c.reveal) {
    slides.push(c)
    continue
  }
  const pts = c.points || []
  if (c.say.length !== pts.length) {
    problems.push(
      `line ${c.line}: reveal needs one spoken line per point (${pts.length} points, ${c.say.length} lines); put each point's voiceover on its own line`
    )
    continue
  }
  pts.forEach((p, i) => {
    const base = {
      sec: c.sec,
      line: c.line,
      say: [c.say[i]],
      highlight: c.highlight,
      beats: c.beats?.includes(i) ? [0] : []
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
if (problems.length) {
  problems.forEach((p) => console.error('PROBLEM: ' + p))
  process.exit(2)
}

// chapter cards before each idea (silent), labels for the chrome
const ideas = sections.filter((s) => s.tag === 'IDEA')
const label = (s) =>
  ({
    HOOK: '',
    INTRO: 'Intro',
    'MID HOOK': 'Halfway',
    SUMMARY: 'Summary',
    OUTRO: ''
  })[s.tag] ??
  (s.tag === 'IDEA'
    ? style.story
      ? s.title
      : `Idea ${s.n} of ${ideas.length} · ${s.title}`
    : s.tag)
const all = []
let lastSec = null
for (const s of slides) {
  if (s.sec !== lastSec && s.sec.tag === 'IDEA')
    all.push({
      layout: 'chapter',
      eyebrow: style.story ? `Chapter ${s.sec.n}` : `Idea ${s.sec.n} of ${ideas.length}`,
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
// beats: every section but the outro ends on one (its conclusion, the hook's promise, the mid hook's tease)
for (const sc of sections) {
  const last = all.findLast((s) => s.sec === sc && s.say.length)
  if (last && sc.tag !== 'OUTRO') last.beats = [...(last.beats || []), last.say.length - 1]
}
// a beat inside a slide's voice splits it into takes (each spoken on its own), joined by BEAT of silence;
// a beat on its last line lengthens the pause after the slide instead
all.forEach((s) => {
  const beats = BEAT > 0 ? s.beats || [] : []
  const parts = []
  let cur = []
  s.say.forEach((l, i) => {
    cur.push(l)
    if (i < s.say.length - 1 && beats.includes(i)) {
      parts.push(cur)
      cur = []
    }
  })
  if (cur.length) parts.push(cur)
  s.beatEnd = s.say.length > 0 && beats.includes(s.say.length - 1)
  s.takes = parts.map((p, k) => ({
    id: parts.length === 1 ? s.id : `${s.id}-${k + 1}`,
    text: p.join(' ')
  }))
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
if (!onlySlides) {
  const lines = all.flatMap((s) => s.takes)
  console.log(
    `voice: ${VOICE} at speed ${SPEED}, ${lines.length} lines, ${lines.reduce((a, l) => a + words(l.text), 0)} words`
  )
  Object.assign(
    durations,
    speak(lines, join(vdir, 'voice'), {
      voice: VOICE,
      speed: SPEED,
      lang: LANG,
      maxPause: MAX_PAUSE
    })
  )
}

// ---------- timeline ----------
// The voice never waits for the pictures: between slides there is only GAP (a breath) and SECTION_GAP at a
// section change, and a chapter card is shown over the opening of its idea's first line instead of in silence.
// s.start/s.dur = when the slide is on screen; s.astart = when its voice starts (earlier than s.start only
// for the slide right after a chapter card).
const takeLen = (k) => (onlySlides ? (words(k.text) / 185) * 60 : durations[k.id] || 0)
const voiceLen = (s) =>
  s.takes.length ? s.takes.reduce((a, k) => a + takeLen(k), 0) + BEAT * (s.takes.length - 1) : 0
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
const plan = (i) => {
  const fr = frames[i]
  const T = fadeOut(i)
  const n = Math.max(1, Math.round((fr.dur + T) * FPS))
  const punch = P.punch && P.punch.includes(fr.s.layout)
  const z = pushes(fr.s)
    ? punch
      ? `1+${P.zoom * 1.6}*min(on/12\\,1)+${P.zoom * 0.4}*on/${n}`
      : `1+${P.zoom}*on/${n}`
    : '1'
  const vf =
    z === '1'
      ? `scale=1920:1080,fps=${FPS},format=yuv420p,settb=AVTB`
      : `scale=3840:2160,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=${FPS},format=yuv420p,settb=AVTB`
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
        'anim1'
      ].join('|')
    )
    .digest('hex')
    .slice(0, 16)
  const file = join(clipsDir, 'a-' + key + '.mp4')
  const none = join(clipsDir, 'a-' + key + '.none')
  if (existsSync(file)) return file
  if (existsSync(none)) return null
  mkdirSync(clipsDir, { recursive: true })
  let info = await page.evaluate(([S, fps]) => window.anim(S, { fps }), [spec, FPS])
  if (!info.intro && !info.loop) {
    writeFileSync(none, '')
    return null
  }
  // a short slide plays its entrance faster: it never takes more than 60 % of the time on screen
  const room = fr.dur * 0.6
  if (info.intro > room)
    info = await page.evaluate(
      ([S, fps, speed]) => window.anim(S, { fps, speed }),
      [spec, FPS, info.intro / room]
    )
  const intro = Math.round(info.intro * FPS)
  const L = info.loop && fr.dur > info.intro + 0.6 ? Math.round(info.loop * FPS) : 0
  const count = Math.min(n, L ? intro + L : intro + 1)
  const pre =
    L && count === intro + L
      ? `loop=loop=-1:size=${L}:start=${intro},`
      : 'tpad=stop_mode=clone:stop=-1,'
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
      pre + vf,
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
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(pathToFileURL(pagePath).href)
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
    _frame: fr.f ?? undefined
  }
  if (s.layout === 'image' && s.src) {
    const p = resolve(W, s.src)
    if (!existsSync(p)) {
      console.error(`PROBLEM [${s.id}, line ${s.line}]: image not found: ${s.src}`)
      failed = true
    } else spec._src = dataUrl(p)
  }
  // generated pictures (scripts/gen-images.mjs): an illustration, or a scene's background
  const pic =
    s.layout === 'illustration'
      ? { src: s.src, prompt: s.prompt, key: '_src', kind: 'illustration' }
      : s.layout === 'scene' && s.bg && typeof s.bg === 'object'
        ? { src: s.bg.src, prompt: s.bg.prompt, key: '_bg', kind: 'background' }
        : null
  if (pic) {
    const p = pic.src
      ? resolve(W, pic.src)
      : pic.prompt
        ? genPath(W, pic.prompt, style, pic.kind)
        : null
    if (p && existsSync(p)) spec[pic.key] = dataUrl(p)
    else {
      const msg = `[${s.id}, line ${s.line}]: ${pic.src ? 'image not found: ' + pic.src : 'picture not generated yet: run scripts/gen-images.mjs'}`
      if (onlySlides) console.warn('warning ' + msg + ' (placeholder for now)')
      else {
        console.error('PROBLEM ' + msg)
        failed = true
      }
    }
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
  const hard = PACE >= 3 && s.dur > P.max * 1.3
  const msg = `[${s.id}, script line ${s.line}, ${s.layout}] ${s.dur.toFixed(1)}s on screen; pace ${PACE} wants ≤ ${P.max}s: split it (another cue, or reveal on points)`
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
  writeFileSync(
    sheetHtml,
    `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#ddd;font:14px monospace;display:grid;grid-template-columns:repeat(6,320px);gap:14px;width:max-content}figure{margin:0}img{width:320px;height:180px;display:block;border-radius:6px}figcaption{margin-top:4px;color:#333}</style>${cells}`
  )
  const p2 = await browser.newPage({ viewport: { width: 2100, height: 600 } })
  await p2.goto(pathToFileURL(sheetHtml).href)
  await p2.waitForLoadState('load')
  await p2.screenshot({ path: join(vdir, 'sheet.png'), fullPage: true })
  rmSync(sheetHtml, { force: true })
  console.log(`wrote ${join(vdir, 'sheet.png')}`)
}
await browser.close()
if (failed) stop('fix the slide problems above and re-run.', 2)

console.log(
  `${onlySlides ? 'estimated' : 'total'} length ${fmt(total)} (${all.length} slides, pace ${PACE}: ≤ ${P.max}s a slide${P.fade ? `, ${P.fade}s crossfades` : ', cuts'}${P.push.length ? ', push-ins' : ''})`
)
{
  // `minutes` (8–20) from style.json is the target: warn when the render lands over a minute off it
  const T = Number(style.minutes)
  const [lo, hi] = Number.isFinite(T) ? [Math.max(8, T - 1), Math.min(20, T + 1)] : [12, 18]
  // the length before the end slide, when there is one (its hold is for YouTube's end screen)
  const last = all[all.length - 1]
  const body = last && last.layout === 'end' ? total - last.dur : total
  if (!preview.size && (body < lo * 60 || body > hi * 60))
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
  s.takes.forEach((k, j) => {
    if (j) aList.push(silence(BEAT))
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

console.log('muxing voice…')
ff(
  [
    '-i',
    silent,
    '-i',
    join(tmp, 'voice.wav'),
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
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
const srt = []
for (const s of all.filter((x) => x.say.length)) {
  let c = s.astart
  for (const k of s.takes) {
    const sentences = k.text.match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g) || []
    const chars = sentences.reduce((a, x) => a + x.trim().length, 0) || 1
    const len = takeLen(k)
    for (const x of sentences) {
      const d = (x.trim().length / chars) * len
      srt.push(`${srt.length + 1}\n${ts(c)} --> ${ts(c + d)}\n${x.trim()}\n`)
      c += d
    }
    c += BEAT
  }
}
writeFileSync(join(dirname(outFile), 'video.srt'), srt.join('\n'))
const chapters = [{ at: 0, title: 'Intro' }]
for (const s of all) {
  if (s.auto) chapters.push({ at: s.start, title: s.sec.title })
  if (s.sec.tag === 'SUMMARY' && !chapters.some((c) => c.title === 'Summary'))
    chapters.push({ at: s.start, title: 'Summary' })
}
writeFileSync(
  join(dirname(outFile), 'chapters.txt'),
  chapters.map((c) => `${fmt(c.at)} ${c.title}`).join('\n') + '\n'
)
const endSlide = all[all.length - 1]
const mb = (statSync(outFile).size / 1048576).toFixed(1)
console.log(
  `wrote ${outFile}  (1920×1080, ${fmt(total)}, ${mb} MB, MP4 · H.264 + AAC, pace ${PACE}, voice ${VOICE})`
)
console.log(`wrote ${join(dirname(outFile), 'video.srt')} and chapters.txt (real times)`)
if (endSlide.layout === 'end')
  console.log(
    `end slide from ${fmt(endSlide.start)} to ${fmt(total)}: add the end screen there in Studio`
  )
