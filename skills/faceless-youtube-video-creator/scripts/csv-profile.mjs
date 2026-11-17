#!/usr/bin/env node
// Profiles a CSV of search queries or ICPs so topics can be brainstormed from it without reading every row.
//
//   node csv-profile.mjs <file.csv> [--top 40] [--col <column>]
//
// Prints: row count, columns (with fill rate and a sample), a guess at the kind (queries | icp | other),
// the top rows by the first demand-like numeric column (volume, impressions, clicks…), and the most
// frequent words and two-word phrases in the main text column. No network, no dependencies.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : args[i + 1]
}
const file = args[0] && resolve(args[0])
if (!file) {
  console.error('usage: csv-profile.mjs <file.csv> [--top 40] [--col <column>]')
  process.exit(1)
}
const TOP = Number(flag('--top', 40))

// ---------- parse (RFC 4180: quotes, escaped quotes, newlines in quotes; , ; or tab) ----------
const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
const firstLine = text.split(/\r?\n/, 1)[0]
const delim = [',', ';', '\t'].sort(
  (a, b) => firstLine.split(b).length - firstLine.split(a).length
)[0]
const rows = []
let row = []
let field = ''
let q = false
for (let i = 0; i < text.length; i++) {
  const c = text[i]
  if (q) {
    if (c === '"' && text[i + 1] === '"') ((field += '"'), i++)
    else if (c === '"') q = false
    else field += c
  } else if (c === '"') q = true
  else if (c === delim) (row.push(field), (field = ''))
  else if (c === '\n' || c === '\r') {
    if (c === '\r' && text[i + 1] === '\n') i++
    ;(row.push(field), (field = ''))
    if (row.some((x) => x.trim())) rows.push(row)
    row = []
  } else field += c
}
row.push(field)
if (row.some((x) => x.trim())) rows.push(row)
if (rows.length < 2) {
  console.error('csv-profile: need a header row and at least one data row')
  process.exit(1)
}
const header = rows[0].map((h) => h.trim())
const data = rows
  .slice(1)
  .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))

// ---------- columns ----------
const num = (v) => {
  const s = String(v)
    .replace(/[\s%]/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(',', '.')
  return s !== '' && !Number.isNaN(Number(s)) ? Number(s) : null
}
const cols = header.map((h) => {
  const vals = data.map((d) => d[h]).filter(Boolean)
  const nums = vals.map(num).filter((x) => x !== null)
  return {
    name: h,
    fill: vals.length / data.length,
    numeric: vals.length > 0 && nums.length / vals.length > 0.9,
    avgLen: vals.reduce((a, v) => a + v.length, 0) / Math.max(1, vals.length),
    distinct: new Set(vals.map((v) => v.toLowerCase())).size,
    sample: vals.slice(0, 3)
  }
})
const lc = (s) => s.toLowerCase()
const QUERY =
  /^(query|queries|keyword|keywords|search ?term|search ?query|term|question|prompt|topic)s?$/i
const DEMAND = /(volume|impressions|searches|clicks|count|frequency|views|demand|traffic|score)/i
const ICP =
  /(role|title|job|persona|industry|segment|pain|goal|challenge|company ?size|seniority|tools?|use ?case)/i
const textCols = cols.filter((c) => !c.numeric && c.fill > 0.5)
const icpHits = cols.filter((c) => ICP.test(c.name)).length
const queryCol = textCols.find((c) => QUERY.test(c.name))
const kind = queryCol ? 'queries' : icpHits >= 2 ? 'icp' : 'other'
const mainCol =
  cols.find((c) => c.name === flag('--col', '')) ||
  queryCol ||
  (kind === 'icp' && textCols.find((c) => /pain|challenge|problem|need/i.test(c.name))) ||
  [...textCols].sort((a, b) => (kind === 'icp' ? b.avgLen - a.avgLen : b.distinct - a.distinct))[0]
const demandCol = cols.find((c) => c.numeric && DEMAND.test(c.name)) || cols.find((c) => c.numeric)

console.log(
  `file: ${file}\nrows: ${data.length}   delimiter: ${JSON.stringify(delim)}   kind (guess): ${kind}`
)
console.log(
  `main text column: ${mainCol?.name ?? '—'}   demand column: ${demandCol?.name ?? '— (none: rank by frequency)'}\n`
)
console.log('columns:')
for (const c of cols)
  console.log(
    `  - ${c.name}  [${c.numeric ? 'number' : 'text'}, ${Math.round(c.fill * 100)}% filled, ${c.distinct} distinct]  e.g. ${c.sample
      .map((s) => JSON.stringify(s.length > 60 ? s.slice(0, 57) + '…' : s))
      .join(', ')}`
  )

// ---------- top rows ----------
if (mainCol) {
  const seen = new Map()
  for (const d of data) {
    const key = lc(d[mainCol.name])
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!key) continue
    const v = demandCol ? (num(d[demandCol.name]) ?? 0) : 1
    const prev = seen.get(key)
    seen.set(key, {
      text: prev?.text ?? d[mainCol.name],
      v: (prev?.v ?? 0) + v,
      n: (prev?.n ?? 0) + 1
    })
  }
  const top = [...seen.values()].sort((a, b) => b.v - a.v).slice(0, TOP)
  console.log(
    `\ntop ${top.length} by ${demandCol ? demandCol.name : 'frequency'} (${seen.size} distinct after de-duplication):`
  )
  for (const r of top) console.log(`  ${String(demandCol ? r.v : r.n).padStart(8)}  ${r.text}`)

  // ---------- frequent words and phrases (seed for clustering) ----------
  const STOP = new Set(
    'a an and are as at be best but by can do does for from free get how i if in into is it its me my not of on or that the this to vs what when where which who why will with you your 2024 2025 2026 de la el en y que para con los las un una por como es del se'.split(
      ' '
    )
  )
  const uni = new Map()
  const bi = new Map()
  for (const d of data) {
    const w = lc(d[mainCol.name])
      .replace(/['’]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter((x) => x && !STOP.has(x))
    const weight = demandCol ? Math.max(1, num(d[demandCol.name]) ?? 1) : 1
    w.forEach((x, i) => {
      uni.set(x, (uni.get(x) ?? 0) + weight)
      if (w[i + 1]) bi.set(x + ' ' + w[i + 1], (bi.get(x + ' ' + w[i + 1]) ?? 0) + weight)
    })
  }
  const show = (m, n) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} (${Math.round(v)})`)
      .join(', ')
  console.log(
    `\nfrequent words${demandCol ? ' (weighted by ' + demandCol.name + ')' : ''}: ${show(uni, 30)}`
  )
  console.log(`frequent phrases: ${show(bi, 20)}`)
}
if (kind === 'icp') {
  console.log('\nICP rows (first 10):')
  for (const d of data.slice(0, 10))
    console.log(
      '  - ' +
        header
          .filter((h) => d[h])
          .map((h) => `${h}: ${d[h].length > 200 ? d[h].slice(0, 197) + '…' : d[h]}`)
          .join(' | ')
    )
}
