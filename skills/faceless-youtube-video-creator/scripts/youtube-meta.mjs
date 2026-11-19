#!/usr/bin/env node
// Checks $W/youtube.json (the video's metadata, ready to paste into YouTube Studio) against YouTube's limits.
// Local only: no network, nothing is uploaded.
//
//   node youtube-meta.mjs <$W>     prints the metadata summary; exit 2 on a problem
//
// $W/youtube.json (written in the skill's packaging step):
//   title (≤ 100, ≤ 60 recommended) · titleOptions · description (≤ 5,000 bytes, chapters from out/chapters.txt) ·
//   tags (≤ 500 characters together) · categoryId ("28" Science & Technology, "27" Education) · language ("en",
//   "es") · madeForKids (false) · containsSyntheticMedia (YouTube's altered or synthetic content disclosure) ·
//   thumbnails (["thumbs/thumb-A.png", "thumbs/thumb-B.png"]) · captions ("out/video.srt") · pinnedComment
//
// A Short ($W/style.json "format": "short", or --short) is checked as one: title ≤ 70 recommended, no chapters
// or thumbnails (YouTube shows a frame), captions "out/short.srt", the description links the long video
// (`longVideo`: its URL, also set as the Short's Related video in Studio), `#Shorts` in the title or description.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const W = args[0] && resolve(args[0])
if (!W || !existsSync(join(W, 'youtube.json'))) {
  console.error('usage: youtube-meta.mjs <video folder with youtube.json>')
  process.exit(1)
}
let m
try {
  m = JSON.parse(readFileSync(join(W, 'youtube.json'), 'utf8'))
} catch (e) {
  console.error('youtube-meta: youtube.json is not valid JSON: ' + e.message)
  process.exit(1)
}
let styleJson = {}
try {
  if (existsSync(join(W, 'style.json')))
    styleJson = JSON.parse(readFileSync(join(W, 'style.json'), 'utf8'))
} catch {}
const SHORT = args.includes('--short') || styleJson.format === 'short'
const d = {
  categoryId: '28',
  language: 'en',
  madeForKids: false,
  containsSyntheticMedia: false,
  thumbnails: SHORT ? [] : ['thumbs/thumb-A.png', 'thumbs/thumb-B.png'],
  captions: SHORT ? 'out/short.srt' : 'out/video.srt',
  ...m
}

const problems = []
const warnings = []
const len = (s) => [...s].length
const title = String(d.title || '').trim()
if (!title) problems.push('no title')
if (len(title) > 100) problems.push(`title is ${len(title)} characters (max 100)`)
else if (len(title) > (SHORT ? 70 : 60))
  warnings.push(
    `title is ${len(title)} characters; over ${SHORT ? '70 gets cut on the Shorts player' : '60 gets cut in search'}`
  )
for (const t of d.titleOptions || [])
  if (len(t) > 100) problems.push(`title option "${t.slice(0, 30)}…" is over 100 characters`)
const desc = String(d.description || '')
if (!desc.trim()) problems.push('no description')
if (Buffer.byteLength(desc) > 5000)
  problems.push(`description is ${Buffer.byteLength(desc)} bytes (max 5,000)`)
for (const [k, v] of [
  ['title', title],
  ['description', desc]
])
  if (/[<>]/.test(v)) problems.push(`${k} contains < or >, which YouTube rejects`)
const tags = (d.tags || []).map((t) => String(t).trim()).filter(Boolean)
const tagChars =
  tags.reduce((a, t) => a + t.length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1)
if (tagChars > 500) problems.push(`tags take ${tagChars} characters (max 500)`)
// chapters: first at 0:00, at least 3, ascending, each ≥ 10 s
const toSec = (s) => s.split(':').reduce((a, x) => a * 60 + Number(x), 0)
const chapters = [...desc.matchAll(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s+\S/gm)].map((x) => toSec(x[1]))
if (SHORT) {
  if (chapters.length)
    problems.push('a Short has no chapters: take the timestamps out of the description')
  const url = String(d.longVideo || '').trim()
  if (!url) problems.push('no longVideo: the URL of the long video this Short comes from')
  else if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url))
    problems.push(`longVideo is not a YouTube URL: ${url}`)
  else if (!desc.includes(url))
    problems.push('the description does not link the long video (longVideo)')
  if (!/#shorts\b/i.test(title + ' ' + desc))
    warnings.push('no #Shorts in the title or description')
  warnings.push(
    'set "Related video" to the long video in Studio (Shorts › Related video): no API for it'
  )
} else if (chapters.length) {
  if (chapters[0] !== 0) problems.push('the first chapter must be at 0:00')
  if (chapters.length < 3) problems.push('YouTube needs at least 3 chapters')
  chapters.forEach((c, i) => {
    if (i && c - chapters[i - 1] < 10)
      problems.push(`chapters at ${chapters[i - 1]} s and ${c} s are less than 10 s apart`)
  })
  const real = existsSync(join(W, 'out/chapters.txt'))
    ? readFileSync(join(W, 'out/chapters.txt'), 'utf8')
        .split('\n')
        .filter((l) => /^\d/.test(l))
        .map((l) => toSec(l.split(' ')[0]))
    : []
  if (real.length && real.join() !== chapters.join())
    warnings.push("the description's chapters differ from out/chapters.txt (the real render times)")
} else warnings.push('no chapters in the description (paste out/chapters.txt)')
if (typeof d.madeForKids !== 'boolean') problems.push('madeForKids must be true or false')
if (typeof d.containsSyntheticMedia !== 'boolean')
  problems.push('containsSyntheticMedia must be true or false')
for (const t of d.thumbnails) {
  const p = join(W, t)
  if (!existsSync(p)) warnings.push(`no thumbnail at ${t} yet (§7 renders them)`)
  else if (statSync(p).size > 2 * 1048576) problems.push(`${t} is over 2 MB (YouTube's limit)`)
}
if (SHORT && d.thumbnails.length)
  warnings.push(
    "Shorts don't take an uploaded thumbnail in most cases: pick a frame in the app instead"
  )
if (d.captions && !existsSync(join(W, d.captions))) warnings.push(`no subtitles at ${d.captions}`)
if (!d.pinnedComment) warnings.push('no pinnedComment')

console.log(`title       ${title}`)
console.log(`description ${Buffer.byteLength(desc)} bytes · ${chapters.length} chapters`)
console.log(`tags        ${tags.length} (${tagChars} characters)`)
console.log(`thumbnails  ${d.thumbnails.join(', ') || '— (a frame of the Short)'}`)
if (SHORT) console.log(`long video  ${d.longVideo || '—'}`)
console.log(`subtitles   ${d.captions || '—'} (${d.language})`)
console.log(
  `category ${d.categoryId} · made for kids: ${d.madeForKids} · altered/synthetic content: ${d.containsSyntheticMedia}`
)
warnings.forEach((w) => console.warn('warning: ' + w))
if (problems.length) {
  problems.forEach((p) => console.error('PROBLEM: ' + p))
  process.exit(2)
}
console.log(`\nyoutube.json passes YouTube's limits${SHORT ? ' for a Short' : ''}.`)
