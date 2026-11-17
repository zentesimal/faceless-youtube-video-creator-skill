#!/usr/bin/env node
// The topic sheet (the config's `paths.topics`), for the opening question (SKILL.md §1a): the best `to do`
// rows to offer, or one row in full.
//
//   node topics.mjs [--top 3] [--status "to do"] [--format long] [--file <csv>]
//   node topics.mjs --id yt-012
//
// Rows are ranked: real proof first, then US monthly search volume. Until the user has a sheet, the three
// example rows in ../references/youtube-topics.example.csv are listed instead. No dependencies.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadConfig, skill } from './style.mjs'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : args[i + 1]
}
const cfg = loadConfig()
const sheet = resolve(flag('--file', cfg.at(cfg.paths.topics)))
const example = join(skill, 'references/youtube-topics.example.csv')
// no sheet yet is not an error: list the shipped examples; the sheet is created on first use (SKILL.md §2)
const file = existsSync(sheet) ? sheet : example
if (file === example)
  console.log(
    `no topic sheet yet at ${sheet}: these are the example rows that ship with the skill\n`
  )

// RFC 4180: quoted fields may hold commas, quotes ("") and newlines
function parse(text) {
  const rows = []
  let row = [],
    field = '',
    q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') ((field += '"'), i++)
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') (row.push(field), (field = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      ;(row.push(field), rows.push(row), (row = []), (field = ''))
    } else field += c
  }
  if (field || row.length) (row.push(field), rows.push(row))
  return rows.filter((r) => r.some((x) => x !== ''))
}

const [head, ...body] = parse(readFileSync(file, 'utf8'))
const rows = body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
const num = (v) => Number(String(v).replace(/[^\d.]/g, '')) || 0
const hasProof = (r) => /^yes/i.test(r.real_proof || '')

const id = flag('--id', null)
if (id) {
  const r = rows.find((x) => x.id.toLowerCase() === id.toLowerCase())
  if (!r) {
    console.error(`topics: no row ${id}`)
    process.exit(1)
  }
  for (const [k, v] of Object.entries(r)) if (v) console.log(`${k}: ${v}`)
  process.exit(0)
}

const status = flag('--status', 'to do')
const format = flag('--format', 'long')
const top = Number(flag('--top', 3))
const pick = rows
  .filter((r) => r.status === status && (!r.format || r.format === format))
  .sort((a, b) => hasProof(b) - hasProof(a) || num(b.us_monthly_volume) - num(a.us_monthly_volume))
console.log(
  `${file}\n${pick.length} ${format} rows with status "${status}"; top ${Math.min(top, pick.length)}:\n`
)
for (const r of pick.slice(0, top))
  console.log(
    `${r.id} · ${r.title}\n  ${r.category} · "${r.main_keyword || '-'}" ` +
      (r.us_monthly_volume ? `${r.us_monthly_volume}/mo US` : 'no volume data') +
      ` · proof: ${hasProof(r) ? r.real_proof.replace(/^yes:?\s*/i, '') || 'yes' : 'none yet'}\n`
  )
