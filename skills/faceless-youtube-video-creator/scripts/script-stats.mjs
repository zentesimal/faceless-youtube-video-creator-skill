#!/usr/bin/env node
// Checks a long-form script against the structure in ../references/script-playbook.md and estimates its length.
//
//   node script-stats.mjs <script.md> [--wpm 150] [--minutes 15] [--min 12] [--max 18] [--beat 0.6]
//
//   beats    each `> BEAT` cue and every section's last line but the outro's add a beat (style.json `beat`,
//            else 3 × `maxPause`, ≈ 0.6 s), as the renderer does
//
//   length   the target is `minutes` (8–20) from style.json next to script.md, or --minutes; the script
//            must land within a minute of it. Without a target the old 12–18 window applies.
//            --min / --max override the window.
//
//   prints   a table: section, spoken words, demo seconds, start time, length
//   writes   teleprompter.txt (spoken text only) and chapters.txt (YouTube chapters), next to script.md
//   exit 2   when a hard rule fails (missing/out-of-order section, missing reminder, length outside min–max)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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
const WPM = flag('--wpm', 150)
let styleJson = {}
try {
  const sj = join(dirname(file), 'style.json')
  if (existsSync(sj)) styleJson = JSON.parse(readFileSync(sj, 'utf8'))
} catch {}
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

const sections = []
let cur = null
for (const raw of readFileSync(file, 'utf8').split('\n')) {
  const line = raw.trim()
  const h = line.match(/^##\s*\[([A-Z ]+?)(?:\s+(\d+))?\]\s*(.*)$/)
  if (h) {
    cur = {
      tag: h[1].trim(),
      n: h[2] ? Number(h[2]) : null,
      title: h[3].trim(),
      spoken: [],
      cues: []
    }
    sections.push(cur)
    continue
  }
  if (!cur || !line || line.startsWith('#') || line.startsWith('<!--')) continue
  if (line.startsWith('>')) cur.cues.push(line.replace(/^>\s*/, ''))
  else cur.spoken.push(line)
}

const problems = []
const warnings = []
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
for (const s of sections) {
  s.label = s.tag + (s.n ? ' ' + s.n : '')
  s.words = s.spoken.reduce((a, l) => a + words(l), 0)
  s.demo = s.cues.reduce((a, c) => {
    const m = c.match(/^(?:DEMO|PAUSE|SCREEN|B-ROLL)\s*\((\d+)\s*s\)/i)
    return a + (m ? Number(m[1]) : 0)
  }, 0)
  s.beats =
    s.cues.filter((c) => /^BEAT$/i.test(c.trim())).length + (s.tag !== 'OUTRO' && s.words ? 1 : 0)
  s.secs = (s.words / WPM) * 60 + s.demo + s.beats * BEAT
  s.has = (marker) => s.cues.some((c) => c.toUpperCase().split(/[\s:]/)[0] === marker)
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
        /^SLIDE\s*\{.*"layout"\s*:\s*"(image|doc|table|fields|chat)"/.test(c)
    )
  )
    warnings.push(
      `[IDEA ${s.n}] has no DEMO/SCREEN cue or SLIDE showing a real artifact (image, doc, table, fields, chat): every idea needs proof on screen`
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
  `\ntotal ≈ ${fmt(total)}  (${spoken} spoken words at ${WPM} wpm + ${sections.reduce((a, s) => a + s.demo, 0)} s of demos)` +
    (HAS_TARGET ? `  ·  target ${TARGET} min (${MIN}–${MAX})` : '')
)

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
