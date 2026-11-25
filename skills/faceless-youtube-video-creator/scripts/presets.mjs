#!/usr/bin/env node
// The looks (themes) for the setup question (SKILL.md §1b), read from the styles/ folder, so the question always
// offers what is really there: every folder with a style.json, its name, one-line summary (the first paragraph
// of its style.md), branding, default pace, whether generated illustrations carry it, and its preview.png.
//
//   node presets.mjs          # a table to build the question from
//   node presets.mjs --json   # the same as JSON
//
// No dependencies.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../styles')
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

const presets = readdirSync(styles, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(styles, d.name, 'style.json')))
  .map((d) => {
    const dir = join(styles, d.name)
    let json = {}
    try {
      json = JSON.parse(read(join(dir, 'style.json')))
    } catch {
      console.warn(`presets: styles/${d.name}/style.json is not valid JSON`)
    }
    const md = read(join(dir, 'style.md'))
    const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() || d.name
    // the first paragraph after the title
    const summary =
      md
        .replace(/^#\s+.+$/m, '')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .find((p) => p && !p.startsWith('#') && !p.startsWith('|')) || ''
    const illustrated =
      /generated illustrations carry this look|best with generated illustrations/i.test(md)
    const preview = join(dir, 'preview.png')
    return {
      name: d.name,
      title,
      summary: summary.replace(/\s+/g, ' '),
      branding: json.style === 'story' ? 'none' : 'channel brand',
      pace: json.pace ?? null,
      animate: json.animate ?? null,
      dayVariant: Boolean(json.imageStyleDay),
      illustrations: illustrated
        ? 'carry the look (recommended)'
        : json.imageStyle
          ? 'optional, in its own image style'
          : json.style === 'story'
            ? 'optional, in a generic image style from its palette'
            : 'optional, in the brand image style',
      provisional: /provisional/i.test(md),
      preview: existsSync(preview) ? preview : null
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

if (process.argv.includes('--json')) console.log(JSON.stringify(presets, null, 2))
else {
  console.log(`${presets.length} looks in ${styles}\n`)
  for (const p of presets)
    console.log(
      `${p.name}  ·  ${p.title}${p.provisional ? ' (provisional)' : ''}\n` +
        `  ${p.summary}\n` +
        `  branding: ${p.branding} · default pace: ${p.pace ?? '—'} · generated illustrations: ${p.illustrations}${p.dayVariant ? ' (day variant for day pictures)' : ''}\n` +
        `  preview: ${p.preview || '(none: render one, styles/README.md)'}\n`
    )
}
