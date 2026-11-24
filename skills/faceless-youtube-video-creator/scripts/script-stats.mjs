#!/usr/bin/env node
// Checks a long-form script against the structure in ../references/script-playbook.md and estimates its length.
//
//   node script-stats.mjs <script.md> [--wpm 185] [--minutes 15] [--min 12] [--max 18] [--beat 0.6] [--level 2]
//
//   level    the viewer level (0–5) from style.json, or --level: counts the technical terms the voice says and
//            warns when there are too many for a level 0–2 viewer, too few for 4–5, or the length doesn't fit.
//            "audience": "developer" (a solo / indie developer): software words (API, JSON, endpoint, SDK, regex,
//            webhook) count as known, and a video with no `doc` slide (real code, a terminal, a config) warns
//
//
//   beats    each `> BEAT` cue and every section's last line but the outro's add a beat (style.json `beat`,
//            else 3 × `maxPause`, ≈ 0.6 s), as the renderer does
//
//   tones    `> TONE <name>` before a spoken line (tones.mjs: intrigue, suspense, surprise, excited, serious,
//            warm, playful) sets its delivery; the estimate adds each tone's pause and speed. It warns when the
//            hook, an idea or the mid hook has no emotional turn, a suspense line never pays off, or the tones
//            are too few (a flat read) or too many (over-acting). style.json "expressive": 0 skips these checks.
//
//   slides   the same slide checks the renderer runs, before any render: every `> SLIDE {…}` is valid JSON on one
//            line, no spoken line is a broken piece of a cue, every section opens with a SLIDE before its first
//            spoken line, a `points` / `flow` with `reveal` has one spoken line per item, and no slide stays up
//            longer than the pace allows (style.json "pace": ≤ 20 / 15 / 10 / 7 / 5 s; PROBLEM past 1.3× from pace 3)
//
//   story    with style.json "mode": "storyteller" (storyteller.mjs): one sentence per spoken line, one picture per
//            sentence (an `illustration` cue before every line; other layouts only for real proof), ≤ 12 s each,
//            "illustrations": true unless every picture has a `src`, and every {Name} in a prompt described in
//            style.json "characters"; prints how many pictures the video needs
//
//   setup    the answers asked before the script (SKILL.md §1a–1b) must be in style.json: level, language,
//            minutes, the look (preset or style), pace, voice and illustrations (the free-or-OpenAI answer);
//            only the first three for "format": "presenter"
//
//   length   the target is `minutes` (8–20) from style.json next to script.md, or --minutes; the script
//            must land within a minute of it. Without a target the old 12–18 window applies.
//            --min / --max override the window.
//
//   short    with style.json "format": "short" (or --short): a Short's checks instead ([HOOK] [PAYOFF] [LOOP],
//            30–55 s, a quick first line, no chapters or reminders; ../references/shorts-playbook.md)
//
//   prints   a table: section, spoken words, demo seconds, start time, length
//   writes   teleprompter.txt (spoken text only) and chapters.txt (YouTube chapters), next to script.md
//   exit 2   when a hard rule fails (missing/out-of-order section, missing reminder, length outside min–max)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  STORY_MAX,
  cuePrompts,
  isStoryteller,
  storyChecks,
  unknownCharacters
} from './storyteller.mjs'
import { TONE_NAMES, delivery, parseTone } from './tones.mjs'
import { voiceWpm } from './voices.mjs'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : Number(args[i + 1])
}
const file = args[0] && resolve(args[0])
if (!file) {
  console.error(
    'usage: script-stats.mjs <script.md> [--wpm 150] [--minutes 15] [--min 12] [--max 18]'
  )
  process.exit(1)
}
let styleJson = {}
try {
  const sj = join(dirname(file), 'style.json')
  if (existsSync(sj)) styleJson = JSON.parse(readFileSync(sj, 'utf8'))
} catch {}
// ---------- a Short ($W/style.json "format": "short", or --short): its own, smaller checks ----------
// [HOOK] [PAYOFF] [LOOP] in that order, a SLIDE before each section's first line, no chapter/subscribe/end slides
// or channel reminders, 30–55 s spoken (20–58 warns, over 180 s fails: YouTube's cap), a hook whose first line
// lands in ≈ 4 s, and a last line that leads back into the first or to the long video. Writes teleprompter.txt.
if (args.includes('--short') || styleJson.format === 'short') {
  const wpm = flag('--wpm', voiceWpm(styleJson.voice, styleJson.speed))
  const problems = []
  const warnings = []
  const secs = []
  let cur = null
  let slideSeen = false
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((raw, ln) => {
      const line = raw.trim()
      const h = line.match(/^##\s*\[([A-Z ]+?)(?:\s+\d+)?\]/)
      if (h) {
        cur = { tag: h[1].trim(), lines: [] }
        secs.push(cur)
        slideSeen = false
        return
      }
      if (!cur || !line || line.startsWith('#') || line.startsWith('<!--')) return
      if (line.startsWith('>')) {
        const m = line.match(/^>\s*SLIDE\s+(\{.*\})\s*$/)
        if (m) {
          try {
            const c = JSON.parse(m[1])
            if (['chapter', 'subscribe', 'end'].includes(c.layout))
              problems.push(`line ${ln + 1}: no "${c.layout}" slide in a Short`)
            if (['table', 'doc', 'fields', 'flow'].includes(c.layout))
              warnings.push(`line ${ln + 1}: a "${c.layout}" slide is hard to read on a phone`)
          } catch (e) {
            problems.push(`line ${ln + 1}: SLIDE cue is not valid JSON (${e.message})`)
          }
          slideSeen = true
        } else if (/^>\s*(CHANNEL|SUBSCRIBE)\b/i.test(line))
          problems.push(`line ${ln + 1}: no channel reminder or subscribe ask in a Short`)
        else if (/^>\s*SLIDE\b/i.test(line))
          problems.push(`line ${ln + 1}: SLIDE cue must be {…} JSON on one line`)
        return
      }
      if (!slideSeen)
        problems.push(`line ${ln + 1}: spoken text in [${cur.tag}] before any SLIDE cue`)
      cur.lines.push(line)
    })
  const order = secs.map((x) => x.tag).join(' ')
  if (order !== 'HOOK PAYOFF LOOP')
    problems.push(`sections are [${order}]; a Short has [HOOK] [PAYOFF] [LOOP], in that order`)
  const count = (t) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
  const rows = secs.map((x) => {
    const words = x.lines.reduce((a, l) => a + count(l), 0)
    return { tag: x.tag, words, secs: (words / wpm) * 60 }
  })
  const total = rows.reduce((a, r) => a + r.secs, 0)
  const hook = secs.find((x) => x.tag === 'HOOK')
  const first = hook?.lines[0] ? count(hook.lines[0]) : 0
  if (!first) problems.push('the [HOOK] has no spoken line')
  else if (first > 14)
    warnings.push(
      `the hook's first line is ${first} words (≈ ${((first / wpm) * 60).toFixed(1)} s): the scroll decides in 2–3 s, cut it to ≤ 12`
    )
  if (total > 180) problems.push(`≈ ${Math.round(total)} s spoken: YouTube Shorts end at 3 min`)
  else if (total < 20 || total > 58)
    warnings.push(
      `≈ ${Math.round(total)} s spoken: aim for 30–55 s (past 60 s a Short stops looping)`
    )
  console.log('section   words   seconds')
  for (const r of rows)
    console.log(
      `${r.tag.padEnd(9)} ${String(r.words).padStart(5)}   ${r.secs.toFixed(1).padStart(7)}`
    )
  console.log(
    `total     ${String(rows.reduce((a, r) => a + r.words, 0)).padStart(5)}   ${total.toFixed(1).padStart(7)}  (at ${wpm} wpm)`
  )
  writeFileSync(
    join(dirname(file), 'teleprompter.txt'),
    secs.map((x) => `[${x.tag}]\n` + x.lines.join('\n')).join('\n\n') + '\n'
  )
  warnings.forEach((w) => console.warn('warning: ' + w))
  if (problems.length) {
    problems.forEach((p) => console.error('PROBLEM: ' + p))
    process.exit(2)
  }
  console.log('\nThe Short passes the structure checks (shorts-playbook.md).')
  process.exit(0)
}

// words per minute: --wpm, else the rate of the voice in style.json at its speed (voices.mjs: Kokoro ≈ 185 at
// 0.92, OpenAI ≈ 170 at 1.1), else a presenter's 150
const PRESENTER = styleJson.format === 'presenter' || !styleJson.voice
const WPM = flag('--wpm', PRESENTER ? 150 : voiceWpm(styleJson.voice, styleJson.speed))
const BEAT = flag('--beat', styleJson.beat ?? Math.round((styleJson.maxPause ?? 0.2) * 300) / 100)
// the target length: --minutes, else `minutes` in the video's style.json (asked at setup), else none
let TARGET = flag('--minutes', NaN)
if (!Number.isFinite(TARGET)) {
  const sj = join(dirname(file), 'style.json')
  try {
    if (existsSync(sj)) TARGET = Number(JSON.parse(readFileSync(sj, 'utf8')).minutes)
  } catch {}
}
if (Number.isFinite(TARGET) && (TARGET < 8 || TARGET > 20)) {
  console.error(`script-stats: target length ${TARGET} min is outside 8–20`)
  process.exit(1)
}
const HAS_TARGET = Number.isFinite(TARGET)
const MIN = flag('--min', HAS_TARGET ? Math.max(8, TARGET - 1) : 12)
const MAX = flag('--max', HAS_TARGET ? Math.min(20, TARGET + 1) : 18)
// ideas the length can hold (script playbook › Length budget)
const IDEAS_MIN = MAX <= 10 ? 2 : 3
const IDEAS_MAX = MAX <= 10 ? 3 : MAX <= 14 ? 4 : 5

const EXPRESSIVE = Math.max(0, Number(styleJson.expressive ?? 1))
const STORY = isStoryteller(styleJson)
const sections = []
const problems = []
const warnings = []
let cur = null
let pendingTone = null
// slides, as the renderer builds them: a cue and the spoken lines under it (until the next cue or section)
const slides = []
let slide = null
readFileSync(file, 'utf8')
  .split('\n')
  .forEach((raw, ln) => {
    const line = raw.trim()
    const h = line.match(/^##\s*\[([A-Z ]+?)(?:\s+(\d+))?\]\s*(.*)$/)
    if (h) {
      if (pendingTone)
        problems.push(`line ${pendingTone.ln}: TONE must come right before a spoken line`)
      pendingTone = null
      cur = {
        tag: h[1].trim(),
        n: h[2] ? Number(h[2]) : null,
        title: h[3].trim(),
        spoken: [],
        tones: [],
        cues: []
      }
      sections.push(cur)
      slide = null
      return
    }
    if (!cur || !line || line.startsWith('#') || line.startsWith('<!--')) return
    if (line.startsWith('>')) {
      const tn = parseTone(line)
      if (tn === '')
        problems.push(`line ${ln + 1}: unknown TONE; use one of ${TONE_NAMES.join(', ')}`)
      else if (tn) {
        if (pendingTone)
          problems.push(`line ${pendingTone.ln}: TONE must come right before a spoken line`)
        pendingTone = { name: tn, ln: ln + 1 }
      }
      const sm = line.match(/^>\s*SLIDE\b\s*(.*)$/)
      if (sm) {
        let spec = null
        try {
          spec = JSON.parse(sm[1])
        } catch (e) {
          problems.push(
            `line ${ln + 1}: SLIDE cue is not valid JSON on one line (${e.message.split('\n')[0]}); a line break inside it splits the cue: write \\n inside the text instead`
          )
        }
        slide = { spec: spec || {}, line: ln + 1, sec: cur, say: [] }
        slides.push(slide)
      }
      cur.cues.push(line.replace(/^>\s*/, ''))
    } else {
      // a JSON key in a spoken line is almost always the tail of a SLIDE cue broken by a line break
      if (/"[A-Za-z]+"\s*:\s*["[{\d]/.test(line))
        problems.push(
          `line ${ln + 1}: this spoken line looks like the rest of a SLIDE cue (a line break inside the cue?): the voice would read it`
        )
      if (slide) slide.say.push({ text: line, tone: pendingTone?.name || null })
      else cur.orphan ??= ln + 1
      cur.tones.push(pendingTone?.name || null)
      cur.spoken.push(line)
      pendingTone = null
    }
  })
if (pendingTone) problems.push(`line ${pendingTone.ln}: TONE must come right before a spoken line`)

const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const MAX_PAUSE = styleJson.maxPause ?? 0.2
for (const s of sections) {
  s.label = s.tag + (s.n ? ' ' + s.n : '')
  s.words = s.spoken.reduce((a, l) => a + words(l), 0)
  // a toned line runs at its own speed and gets its pause before it (tones.mjs)
  s.toneSecs = s.spoken.reduce((a, l, i) => {
    const d = s.tones[i] && delivery(s.tones[i], { scale: EXPRESSIVE, maxPause: MAX_PAUSE })
    return d ? a + d.before + (words(l) / WPM) * 60 * (1 / d.speedFactor - 1) : a
  }, 0)
  s.demo = s.cues.reduce((a, c) => {
    const m = c.match(/^(?:DEMO|PAUSE|SCREEN|B-ROLL)\s*\((\d+)\s*s\)/i)
    return a + (m ? Number(m[1]) : 0)
  }, 0)
  s.beats =
    s.cues.filter((c) => /^BEAT$/i.test(c.trim())).length + (s.tag !== 'OUTRO' && s.words ? 1 : 0)
  s.secs = (s.words / WPM) * 60 + s.demo + s.beats * BEAT + s.toneSecs
  s.has = (marker) => s.cues.some((c) => c.toUpperCase().split(/[\s:]/)[0] === marker)
}

// ---------- slides (the renderer's checks, before any render) ----------
if (slides.length) {
  for (const s of sections)
    if (s.orphan)
      problems.push(
        `line ${s.orphan}: spoken text in [${s.label}] before its first SLIDE cue: every section opens with a SLIDE`
      )
  const PACE = Math.min(5, Math.max(1, Math.round(Number(styleJson.pace ?? 2))))
  // story teller: a picture holds for its sentence, ≤ STORY_MAX s at any pace
  const MAX = STORY ? STORY_MAX : { 1: 20, 2: 15, 3: 10, 4: 7, 5: 5 }[PACE]
  const HARD = PACE >= 3 || STORY
  // the voice's own rate (as the renderer estimates it); a slide also keeps a breath after its voice
  const SLIDE_WPM = WPM
  // the renderer's own estimate: words at the voice's rate, plus a tone's held pause before every line but the first
  // (a toned line at its own speed; its held pause counts on every line but the slide's first)
  const lineSecs = (l, i) => {
    const d = l.tone && delivery(l.tone, { scale: EXPRESSIVE, maxPause: MAX_PAUSE })
    return (
      ((words(l.text) / SLIDE_WPM) * 60) / (d ? d.speedFactor : 1) + (d && i > 0 ? d.before : 0)
    )
  }
  const long = []
  for (const sl of slides) {
    const sp = sl.spec
    const items = sp.layout === 'flow' ? sp.nodes : sp.layout === 'points' ? sp.points : null
    // `reveal` turns one cue into one slide per item, each with its own line
    const parts = items && sp.reveal ? sl.say.map((l) => [l]) : [sl.say]
    if (items && sp.reveal && sl.say.length !== items.length)
      problems.push(
        `line ${sl.line}: reveal needs one spoken line per ${sp.layout === 'flow' ? 'node' : 'point'} (${items.length} ${sp.layout === 'flow' ? 'nodes' : 'points'}, ${sl.say.length} lines); put each one's voiceover on its own line`
      )
    if (['end', 'subscribe'].includes(sp.layout)) continue
    for (const part of parts) {
      if (!part.length) continue
      let secs = part.reduce((a, l, i) => a + lineSecs(l, i), 0) + 0.1
      // an idea's first slide: its chapter card covers the opening of the voice (render-video.mjs, CHAPTER)
      if (sl.sec.tag === 'IDEA' && sl === slides.find((x) => x.sec === sl.sec) && part === parts[0])
        secs -= Math.min(1.8, Math.max(0.8, secs * 0.45))
      if (secs > MAX)
        long.push({
          line: sl.line,
          layout: sp.layout || '?',
          secs,
          hard: HARD && secs > MAX * 1.3
        })
    }
  }
  for (const l of long.filter((x) => x.hard))
    problems.push(
      STORY
        ? `line ${l.line} (${l.layout}): about ${l.secs.toFixed(1)} s on one picture; story teller wants ≤ ${MAX} s: split the sentence in two, each with its own picture`
        : `line ${l.line} (${l.layout}): about ${l.secs.toFixed(1)} s on screen; pace ${PACE} wants ≤ ${MAX} s: add a SLIDE cue before its next line, split a long sentence, or reveal a list`
    )
  const soft = long.filter((x) => !x.hard)
  if (soft.length)
    warnings.push(
      `${soft.length} slide${soft.length === 1 ? '' : 's'} a little over ${STORY ? 'story teller' : `pace ${PACE}`}'s ${MAX} s (lines ${soft.map((x) => x.line).join(', ')}): fine once in a while; split the ones that drag`
    )
}

// ---------- story teller: a picture per sentence (storyteller.mjs) ----------
let storyLine = ''
if (STORY && slides.length) {
  // as the renderer builds them: a `reveal` list or flow is one slide per line
  const built = slides.flatMap((sl) => {
    const sp = sl.spec
    const items = sp.layout === 'flow' ? sp.nodes : sp.layout === 'points' ? sp.points : null
    return items && sp.reveal
      ? sl.say.map((l) => ({ layout: sp.layout, say: [l], line: sl.line }))
      : [{ layout: sp.layout, say: sl.say, line: sl.line }]
  })
  const sc = storyChecks(built, (l) => l.text)
  problems.push(...sc.problems)
  warnings.push(...sc.warnings)
  const prompts = slides.flatMap((sl) => cuePrompts(sl.spec))
  const unknown = [...new Set(prompts.flatMap((p) => unknownCharacters(p, styleJson.characters)))]
  if (unknown.length)
    problems.push(
      `story teller: the prompts name ${unknown.map((n) => `{${n}}`).join(', ')}, but style.json "characters" doesn't describe ${unknown.length === 1 ? 'it' : 'them'}: add one description each (look, age, hair, clothes, colours), so they look the same in every picture`
    )
  if (prompts.length && styleJson.illustrations !== true)
    problems.push(
      `story teller draws a picture per sentence: style.json needs "illustrations": true (generated with OpenAI), or give every illustration a "src" from $W/assets/`
    )
  const pics = new Set(prompts).size
  storyLine = `story teller: ${sc.sentences} sentences, ${pics} distinct picture prompt${pics === 1 ? '' : 's'} to generate; gen-images.mjs --dry-run gives the exact count before anything is billed`
}

// ---------- order ----------
const ideas = sections.filter((s) => s.tag === 'IDEA')
const order = sections.map((s) => s.tag)
const expectFirst = ['HOOK', 'INTRO']
expectFirst.forEach((t, i) => {
  if (order[i] !== t)
    problems.push(
      `section ${i + 1} should be [${t}], found ${order[i] ? '[' + order[i] + ']' : 'nothing'}`
    )
})
const tail = order.slice(-2)
if (tail[0] !== 'SUMMARY' || tail[1] !== 'OUTRO')
  problems.push('the script must end with [SUMMARY] then [OUTRO]')
const midIdx = order.indexOf('MID HOOK')
if (midIdx < 0) problems.push('no [MID HOOK] section')
else if (order.indexOf('MID HOOK', midIdx + 1) >= 0) problems.push('more than one [MID HOOK]')
const unknown = sections.filter(
  (s) => !['HOOK', 'INTRO', 'IDEA', 'MID HOOK', 'SUMMARY', 'OUTRO'].includes(s.tag)
)
for (const s of unknown) problems.push(`unknown section [${s.label}]`)
if (ideas.length < IDEAS_MIN)
  problems.push(
    `${ideas.length} ideas; a ${MIN}–${MAX} min video needs ${IDEAS_MIN} to ${IDEAS_MAX}`
  )
if (ideas.length > IDEAS_MAX)
  warnings.push(
    `${ideas.length} ideas for ${MIN}–${MAX} min; more than ${IDEAS_MAX} usually means each one is too thin`
  )
ideas.forEach((s, i) => {
  if (s.n !== i + 1)
    problems.push(`ideas are not numbered 1..${ideas.length} in order (found IDEA ${s.n ?? '?'})`)
  if (!s.title) problems.push(`[IDEA ${s.n}] has no chapter title after the tag`)
  if (BEAT > 0 && !s.cues.some((c) => /^BEAT$/i.test(c.trim())))
    warnings.push(
      `[IDEA ${s.n}] has no "> BEAT": mark its wow line (the reveal, the number, the payoff)`
    )
  else if (s.title.length > 40) warnings.push(`[IDEA ${s.n}] chapter title is over 40 characters`)
  if (
    !s.cues.some(
      (c) =>
        /^(DEMO|SCREEN)/i.test(c) ||
        /^SLIDE\s*\{.*"layout"\s*:\s*"(image|screen|doc|table|fields|chat)"/.test(c)
    )
  )
    warnings.push(
      s.cues.some((c) => /^SLIDE\s*\{.*"layout"\s*:\s*"mock"/.test(c))
        ? `[IDEA ${s.n}] shows the product only as a \`mock\` (recreated UI, not proof): add a real \`screen\`, or a doc, table, fields or chat with the real artifact`
        : `[IDEA ${s.n}] has no DEMO/SCREEN cue or SLIDE showing a real artifact (image, screen, doc, table, fields, chat): every idea needs proof on screen`
    )
})
if (midIdx >= 0) {
  const before = sections.slice(0, midIdx).filter((s) => s.tag === 'IDEA').length
  const need = ideas.length <= 2 ? 1 : 2
  if (before < need)
    problems.push(`[MID HOOK] must come after at least ${need} idea${need > 1 ? 's' : ''}`)
  if (before >= ideas.length) problems.push('[MID HOOK] must come before the last idea')
}

// ---------- reminders ----------
const get = (tag) => sections.find((s) => s.tag === tag)
const need = [
  ['INTRO', 'CHANNEL'],
  ['MID HOOK', 'SUBSCRIBE'],
  ['OUTRO', 'CHANNEL'],
  ['OUTRO', 'SUBSCRIBE']
]
for (const [tag, m] of need)
  if (get(tag) && !get(tag).has(m)) problems.push(`[${tag}] needs a "> ${m}" reminder`)
for (const tag of ['HOOK', 'INTRO'])
  if (get(tag)?.has('SUBSCRIBE'))
    problems.push(`no subscribe ask in [${tag}]: ask after the viewer got value`)

// ---------- timing ----------
let t = 0
for (const s of sections) {
  s.start = t
  t += s.secs
}
const total = t
const fmt = (sec) => {
  sec = Math.round(sec)
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
}
const range = (tag, lo, hi) => {
  for (const s of sections.filter((x) => x.tag === tag))
    if (s.secs < lo || s.secs > hi)
      warnings.push(`[${s.label}] runs ${Math.round(s.secs)} s; aim for ${lo}–${hi} s`)
}
range('HOOK', 15, 40)
range('INTRO', 30, 80)
range('IDEA', MAX <= 10 ? 80 : 100, 270)
range('MID HOOK', 15, 60)
range('SUMMARY', 40, 130)
range('OUTRO', 10, 45)
if (midIdx >= 0) {
  const at = sections[midIdx].start / total
  if (at < 0.35 || at > 0.65)
    warnings.push(`[MID HOOK] starts at ${Math.round(at * 100)}% of the video; aim for 40–60%`)
}
if (total < MIN * 60 || total > MAX * 60)
  problems.push(
    `estimated length ${fmt(total)} is outside ${MIN}–${MAX} min (at ${WPM} wpm${HAS_TARGET ? `; target ${TARGET} min` : ''})`
  )

// ---------- viewer level (script playbook › Viewer level) ----------
// The technical terms the voice says out loud, counted once each. A level 0–2 script with more than the level
// allows gets a warning listing them (each needs a definition and a comparison, or should go); a level 4–5
// script with almost none probably talks down. The length is checked against the level's range.
const LEVEL = flag('--level', Number(styleJson.level))
let levelLine = ''
const LEVELS = {
  0: { min: 8, max: 9, terms: 2, name: 'newcomer' },
  1: { min: 8, max: 10, terms: 4, name: 'casual user' },
  2: { min: 10, max: 12, terms: 8, name: 'everyday user' },
  3: { min: 13, max: 16, terms: Infinity, name: 'power user' },
  4: { min: 14, max: 18, terms: Infinity, floor: 4, name: 'builder' },
  5: { min: 17, max: 20, terms: Infinity, floor: 6, name: 'expert' }
}
const TERMS = [
  ['token', /\btokens?\b|\btokeni[sz]/],
  ['context window', /context window|ventana de contexto/],
  ['embedding', /\bembeddings?\b|incrustaci/],
  ['vector', /\bvectors?\b|\bvectores?\b|\bvectorial/],
  ['temperature', /\btemperature\b|\btemperatura\b/],
  ['top-p', /\btop[- ]p\b/],
  ['system prompt', /system prompt|prompt de sistema/],
  ['fine-tuning', /fine[- ]?tun|ajuste fino/],
  ['RAG', /\brag\b|retrieval/],
  ['inference', /\binference\b|\binferencia\b/],
  ['parameters', /\bparameters?\b|\bpar[aá]metros?\b/],
  ['weights', /\bweights\b|\bpesos\b/],
  ['API', /\bapis?\b/],
  ['endpoint', /\bendpoints?\b/],
  ['JSON', /\bjson\b/],
  ['schema', /\bschemas?\b|\besquemas?\b/],
  ['latency', /\blatency\b|\blatencia\b/],
  ['hallucination', /hallucinat|alucinaci/],
  ['prompt injection', /prompt injection|inyecci[oó]n de prompt/],
  ['benchmark', /\bbenchmarks?\b/],
  ['transformer', /\btransformers?\b/],
  ['attention', /\battention\b|mecanismo de atenci/],
  ['quantization', /quantiz|cuantiz/],
  ['LoRA', /\blora\b/],
  ['MCP', /\bmcp\b/],
  ['SDK', /\bsdks?\b/],
  ['regex', /\bregex\b|regular expression|expresi[oó]n regular/],
  ['webhook', /\bwebhooks?\b/],
  ['few-shot', /few[- ]shot|zero[- ]shot/],
  ['chain of thought', /chain[- ]of[- ]thought|cadena de pensamiento/],
  ['evals', /\bevals?\b|\bevaluations? set/],
  ['function calling', /function calling|tool use|tool calling|llamada a funciones/],
  ['GPU', /\bgpus?\b/],
  ['throughput', /\bthroughput\b/],
  ['LLM', /\bllms?\b|large language model/],
  ['open weights', /open[- ]weights?|pesos abiertos/]
]
// a video's own field terms (style.json "terms": ["mulch", "pH"]): the built-in list is about AI
for (const term of Array.isArray(styleJson.terms) ? styleJson.terms : [])
  TERMS.push([
    term,
    new RegExp('\\b' + term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
  ])
// a developer audience (script playbook › Audience: developer): fluent in code, maybe new to AI. Software words
// aren't jargon to them; the AI terms still follow the level.
const AUDIENCE = styleJson.audience ?? null
const DEV = AUDIENCE === 'developer'
if (AUDIENCE != null && !DEV)
  warnings.push(
    `style.json "audience" is "${AUDIENCE}"; the only audience is "developer" (or leave it out)`
  )
const DEV_KNOWN = new Set([
  'API',
  'endpoint',
  'JSON',
  'schema',
  'SDK',
  'regex',
  'webhook',
  'latency',
  'throughput'
])
if (DEV && !slides.some((sl) => sl.spec.layout === 'doc'))
  warnings.push(
    'audience developer: no `doc` slide. Developers trust what they can read: show the real code, the terminal output or the config at least once per idea'
  )
if (Number.isFinite(LEVEL)) {
  const L = LEVELS[Math.round(LEVEL)]
  if (!L) problems.push(`level ${LEVEL} is outside 0–5 (style.json "level")`)
  else {
    const said = sections
      .flatMap((s) => s.spoken)
      .join('\n')
      .toLowerCase()
    const all = TERMS.filter(([, re]) => re.test(said)).map(([t]) => t)
    // the ceiling (too many for the level) skips what a developer already knows; the floor counts everything
    const used = DEV ? all.filter((t) => !DEV_KNOWN.has(t)) : all
    levelLine = `viewer level ${LEVEL} (${L.name}${DEV ? ', developer audience' : ''}): ${used.length} technical term${used.length === 1 ? '' : 's'} said${used.length ? ': ' + used.join(', ') : ''}`
    if (used.length > L.terms)
      warnings.push(
        `level ${LEVEL} allows about ${L.terms} technical terms; the script says ${used.length} (${used.join(', ')}). ` +
          "Cut the ones the viewer won't meet again; give each one you keep a one-sentence definition and an everyday comparison the first time it's said"
      )
    if (L.floor && all.length < L.floor)
      warnings.push(
        `level ${LEVEL} viewers expect the technical vocabulary, but the script says only ${all.length} technical term${all.length === 1 ? '' : 's'}: is it too basic for them?`
      )
    if (HAS_TARGET && (TARGET < L.min - 2 || TARGET > L.max + 2))
      warnings.push(
        `a ${TARGET}-minute video is far from the ${L.min}–${L.max} min that suits level ${LEVEL}: ${TARGET > L.max ? 'shorten it (fewer ideas, each with one clear win), or raise the level' : 'a level this technical usually needs the room'}`
      )
  }
}

// ---------- emotion (script playbook › Emotion and delivery) ----------
// The voice reads every line the same way unless the script asks otherwise: the hook needs a pull (intrigue,
// suspense or a surprise), every idea a turn the viewer feels (the reveal, the win, the catch), the mid hook a
// re-hook, and suspense must pay off. Too few tones = a flat read; too many = over-acting.
let toneLine = ''
if (EXPRESSIVE > 0) {
  const allTones = sections.flatMap((s) => s.tones)
  const used = allTones.filter(Boolean)
  const kinds = [...new Set(used)]
  const lines = allTones.length || 1
  toneLine = `tones: ${used.length} of ${allTones.length} spoken lines (${Math.round((used.length / lines) * 100)}%)${kinds.length ? ': ' + kinds.map((k) => `${k} ${used.filter((x) => x === k).length}`).join(', ') : ''}`
  const has = (s, list) => s.tones.some((t) => list.includes(t))
  if (!used.length)
    warnings.push(
      "no `> TONE` cues: the voice reads all of it in one flat tone. Mark the hook (intrigue or suspense), each idea's reveal (surprise), its catch (serious) and the mid hook's tease (intrigue or suspense)"
    )
  else {
    const hook = get('HOOK')
    if (hook && !has(hook, ['intrigue', 'suspense', 'surprise']))
      warnings.push(
        '[HOOK] has no intrigue, suspense or surprise tone: open on a question or a reveal the viewer feels'
      )
    for (const s of ideas)
      if (!has(s, ['surprise', 'excited']))
        warnings.push(
          `[IDEA ${s.n}] has no surprise or excited line: give its wow line (the reveal, the number, the payoff) a \`> TONE surprise\``
        )
    const mid = get('MID HOOK')
    if (mid && !has(mid, ['intrigue', 'suspense']))
      warnings.push(
        '[MID HOOK] has no intrigue or suspense tone: the tease for the second half should pull'
      )
    // suspense pays off: a surprise or excited line later in the same section or the next one
    sections.forEach((s, i) => {
      const at = s.tones.lastIndexOf('suspense')
      if (at < 0) return
      const after = [...s.tones.slice(at + 1), ...(sections[i + 1]?.tones || [])]
      if (!after.some((t) => t === 'surprise' || t === 'excited'))
        warnings.push(
          `[${s.label}] builds suspense that never pays off: follow it with the reveal (\`> TONE surprise\`)`
        )
    })
    if (kinds.length < 3)
      warnings.push(
        `only ${kinds.length} kind${kinds.length === 1 ? '' : 's'} of tone (${kinds.join(', ')}): vary the delivery (at least 3: e.g. intrigue, surprise, serious)`
      )
    if (used.length / lines > 0.4)
      warnings.push(
        `${Math.round((used.length / lines) * 100)}% of the lines carry a tone: that reads as over-acting; keep tones for the moments that turn (about 10–30%)`
      )
    else if (used.length / lines < 0.06 && lines >= 30)
      warnings.push(
        `only ${Math.round((used.length / lines) * 100)}% of the lines carry a tone: the read will sound flat; aim for about 10–30%`
      )
  }
}

// ---------- setup answers (SKILL.md §1a–1b) ----------
// The questions come before the script: a style.json without the answers means they were skipped.
{
  const presenter = styleJson.format === 'presenter'
  const missing = [
    ['level', Number.isFinite(Number(styleJson.level)) && styleJson.level !== null],
    ['language', !!styleJson.language],
    ['minutes', Number.isFinite(Number(styleJson.minutes)) && styleJson.minutes !== null],
    ...(presenter
      ? []
      : [
          ['look (preset or style)', !!(styleJson.preset || styleJson.style)],
          ['pace', Number.isFinite(Number(styleJson.pace)) && styleJson.pace !== null],
          ['voice', !!styleJson.voice],
          [
            'illustrations (true or false: free vector scenes or generated pictures)',
            typeof styleJson.illustrations === 'boolean'
          ]
        ])
  ]
    .filter(([, ok]) => !ok)
    .map(([k]) => k)
  if (missing.length)
    problems.push(
      `setup not finished: ${existsSync(join(dirname(file), 'style.json')) ? 'style.json' : 'no style.json next to the script, so'} has no ${missing.join(', ')}. Ask the setup questions (SKILL.md §1a–1b: viewer level, topic, length, language, research; free or OpenAI; look from styles/, pace, voice, animations) and save the answers before writing the script`
    )
}

// ---------- report ----------
const pad = (s, n) => String(s).padEnd(n)
console.log(pad('section', 44) + pad('words', 7) + pad('demo', 6) + pad('start', 7) + 'length')
for (const s of sections)
  console.log(
    pad(s.label + (s.title ? ' · ' + s.title : ''), 44).slice(0, 44) +
      pad(s.words, 7) +
      pad(s.demo ? s.demo + 's' : '', 6) +
      pad(fmt(s.start), 7) +
      fmt(s.secs)
  )
const spoken = sections.reduce((a, s) => a + s.words, 0)
console.log(
  `\ntotal ≈ ${fmt(total)}  (${spoken} spoken words at ${WPM} wpm${PRESENTER || args.includes('--wpm') ? '' : `, ${styleJson.voice}`} + ${sections.reduce((a, s) => a + s.demo, 0)} s of demos)` +
    (HAS_TARGET ? `  ·  target ${TARGET} min (${MIN}–${MAX})` : '')
)
if (levelLine) console.log(levelLine)
if (toneLine) console.log(toneLine)
if (storyLine) console.log(storyLine)

// ---------- outputs ----------
const dir = dirname(file)
writeFileSync(
  join(dir, 'teleprompter.txt'),
  sections
    .map((s) => `[${s.label}${s.title ? ' · ' + s.title : ''}]\n\n${s.spoken.join('\n\n')}`)
    .join('\n\n\n') + '\n'
)
// chapters: hook+intro → "Intro" at 0:00, each idea (mid hook stays in the idea before it), summary+outro → "Summary"
const chapters = [{ at: 0, title: 'Intro' }]
for (const s of sections) {
  if (s.tag === 'IDEA') chapters.push({ at: s.start, title: s.title || `Idea ${s.n}` })
  if (s.tag === 'SUMMARY') chapters.push({ at: s.start, title: 'Summary' })
}
writeFileSync(
  join(dir, 'chapters.txt'),
  chapters.map((c) => `${fmt(c.at)} ${c.title}`).join('\n') + '\n'
)
console.log(
  `wrote ${join(dir, 'teleprompter.txt')} and chapters.txt (estimates: re-time from the final edit)`
)

for (const w of warnings) console.warn('warning: ' + w)
for (const p of problems) console.error('PROBLEM: ' + p)
if (problems.length) process.exit(2)
