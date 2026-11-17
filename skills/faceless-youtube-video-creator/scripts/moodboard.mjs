#!/usr/bin/env node
// Moodboard for the story-telling (no branding) look: reads an inspiration folder and reports its palette.
//
//   node moodboard.mjs <folder> [--out $W] [--max 40]
//
// Prints each image's dominant colours (k-means on a downsampled copy, share of pixels) and the folder's overall
// palette, sorted dark → light, plus any font files (.woff2/.woff/.ttf/.otf) found. With --out, also writes
// <out>/moodboard-sheet.png (every image, small, to look at in one Read) and <out>/moodboard-palette.json.
// The folder is a style reference only: its images are never copied into the video.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { contrast, dataUrl, launchBrowser } from './style.mjs'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : (args[i + 1] ?? d)
}
const dir = args[0] && resolve(args[0])
if (!dir || !statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('usage: moodboard.mjs <inspiration folder> [--out <video folder>] [--max 40]')
  process.exit(1)
}
const out = flag('--out', '') && resolve(flag('--out', ''))
const max = Number(flag('--max', '40'))

const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'])
const FONT = new Set(['.woff2', '.woff', '.ttf', '.otf'])
const images = []
const fonts = []
const walk = (d, depth) => {
  for (const name of readdirSync(d).sort()) {
    if (name.startsWith('.')) continue
    const p = join(d, name)
    const st = statSync(p)
    if (st.isDirectory()) depth < 2 && walk(p, depth + 1)
    else if (IMG.has(extname(name).toLowerCase()) && st.size < 25 * 1048576) images.push(p)
    else if (FONT.has(extname(name).toLowerCase())) fonts.push(p)
  }
}
walk(dir, 0)
if (!images.length) {
  console.error(`moodboard: no images in ${dir}`)
  process.exit(1)
}
const used = images.slice(0, max)

const browser = await launchBrowser()
const page = await browser.newPage()
await page.setContent('<canvas id="c"></canvas>')

// pixels of every image, downsampled to ≤ 96 px on the long side
const pixelsOf = (src) =>
  page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const s = 96 / Math.max(img.naturalWidth, img.naturalHeight, 1)
    const w = Math.max(1, Math.round(img.naturalWidth * s))
    const h = Math.max(1, Math.round(img.naturalHeight * s))
    const c = document.getElementById('c')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    x.clearRect(0, 0, w, h)
    x.drawImage(img, 0, 0, w, h)
    const d = x.getImageData(0, 0, w, h).data
    const px = []
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]])
    return px
  }, src)

// k-means++ with a fixed seed, so re-runs give the same palette
const kmeans = (px, k) => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  const cs = [px[Math.floor(rnd() * px.length)]]
  while (cs.length < Math.min(k, px.length)) {
    const ds = px.map((p) => Math.min(...cs.map((c) => d2(p, c))))
    let r = rnd() * ds.reduce((a, b) => a + b, 0)
    let i = 0
    while (r > ds[i] && i < ds.length - 1) r -= ds[i++]
    cs.push(px[i])
  }
  let assign = []
  for (let it = 0; it < 12; it++) {
    assign = px.map((p) => cs.reduce((bi, c, i) => (d2(p, c) < d2(p, cs[bi]) ? i : bi), 0))
    for (let i = 0; i < cs.length; i++) {
      const m = px.filter((_, j) => assign[j] === i)
      if (m.length) cs[i] = [0, 1, 2].map((ch) => m.reduce((a, p) => a + p[ch], 0) / m.length)
    }
  }
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / 255
  return cs
    .map((c, i) => ({
      hex: hex(c),
      share: assign.filter((a) => a === i).length / px.length,
      light: Math.round((L(c) / 255) * 100),
      sat: Math.round(sat(c) * 100)
    }))
    .filter((c) => c.share > 0.01)
    .sort((a, b) => a.light - b.light)
}

const fmt = (cs) => cs.map((c) => `${c.hex} ${Math.round(c.share * 100)}%`).join('  ')
const all = []
const perImage = []
for (const p of used) {
  let px
  try {
    px = await pixelsOf(dataUrl(p))
  } catch {
    console.warn(`  skipped (cannot decode): ${relative(dir, p)}`)
    continue
  }
  if (!px.length) continue
  const cs = kmeans(px, 5)
  perImage.push({ file: relative(dir, p), colours: cs })
  console.log(`${relative(dir, p)}\n  ${fmt(cs)}`)
  for (let i = 0; i < px.length; i += 3) all.push(px[i])
}
const overall = kmeans(all, 8)
console.log(`\noverall palette (dark → light; light = 0–100, sat = saturation 0–100):`)
for (const c of overall)
  console.log(
    `  ${c.hex}  ${String(Math.round(c.share * 100)).padStart(2)}%  light ${c.light}  sat ${c.sat}`
  )
const darkest = overall[0].hex
const lightest = overall[overall.length - 1].hex
console.log(
  `\nhint: darkest ${darkest} vs lightest ${lightest} contrast ${contrast(darkest, lightest).toFixed(1)}:1` +
    ' (ground/second need ≥ 4.5; nudge them lighter/darker if not). Accent = the most saturated colour that is not the ground.'
)
if (fonts.length)
  console.log(
    `\nfont files (usable as theme.fontFiles):\n${fonts.map((f) => '  ' + relative(dir, f)).join('\n')}`
  )
if (images.length > used.length)
  console.log(`\n(${images.length - used.length} more images not analysed; raise --max)`)

if (out) {
  writeFileSync(
    join(out, 'moodboard-palette.json'),
    JSON.stringify({ folder: dir, overall, images: perImage, fonts }, null, 1)
  )
  const cells = used
    .map(
      (p) =>
        `<figure><img src="${dataUrl(p)}"><figcaption>${relative(dir, p)}</figcaption></figure>`
    )
    .join('')
  const swatches = overall
    .map((c) => `<div class="sw" style="background:${c.hex}"><span>${c.hex}</span></div>`)
    .join('')
  const p2 = await browser.newPage({ viewport: { width: 1640, height: 600 } })
  await p2.setContent(
    `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#ddd;font:13px monospace;width:1600px}
    .g{display:grid;grid-template-columns:repeat(6,250px);gap:14px}figure{margin:0}img{width:250px;height:180px;object-fit:cover;display:block;border-radius:6px}
    figcaption{margin-top:4px;color:#333;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.p{display:flex;gap:8px;margin:0 0 18px}
    .sw{width:180px;height:70px;border-radius:8px;display:flex;align-items:flex-end;padding:6px}.sw span{background:#fff;padding:1px 4px;border-radius:3px}</style>
    <div class="p">${swatches}</div><div class="g">${cells}</div>`
  )
  await p2.waitForLoadState('load')
  await p2.screenshot({ path: join(out, 'moodboard-sheet.png'), fullPage: true })
  console.log(`\nwrote ${join(out, 'moodboard-sheet.png')} and moodboard-palette.json`)
}
await browser.close()
