#!/usr/bin/env node
// Renders the A/B YouTube thumbnails from a spec.json, locally, with headless Chrome (Playwright).
//
//   node render-thumbnails.mjs <spec.json> [--only A] [--out <dir>] [--vertical] [--pick A]
//
//   → <out>/thumb-<V>.png   1280×720 per variant (JPEG fallback thumb-<V>.jpg if the PNG is over 2 MB)
//   → <out>/compare.png     every variant at 640, 360 and 168 px wide, with the title under it
//
// A Short's cover (spec "format": "short", the Short's style.json "format": "short", or --vertical):
//   → <out>/cover-<V>.png   1080×1920 per variant
//   → <out>/compare.png     every variant on the Shorts shelf (360 px), in a profile grid's 3:4 crop and small
//   --pick A                copies cover-A.png to cover.png (the one that ships) and records "picked" in the spec
//
// <out> defaults to the spec's folder. Spec fields: ../references/thumbnail-playbook.md.
// Exit code 2 = a variant overflows or breaks a rule (shorten the copy and re-run).
import { copyFileSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { channel, dataUrl, families, fontsCss, launchBrowser, loadStyle, skill } from './style.mjs'

const args = process.argv.slice(2)
const stop = (m, code = 1) => {
  console.error('render-thumbnails: ' + m)
  process.exit(code)
}
const flag = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? null : (args[i + 1] ?? '')
}
const specPath = args[0] && resolve(args[0])
if (!specPath || !existsSync(specPath))
  stop('usage: render-thumbnails.mjs <spec.json> [--only A] [--out <dir>] [--vertical] [--pick A]')
const specDir = dirname(specPath)
const out = resolve(flag('--out') || specDir)
const only = flag('--only')
const pick = flag('--pick')

let spec
try {
  spec = JSON.parse(readFileSync(specPath, 'utf8'))
} catch (e) {
  stop('spec is not valid JSON: ' + e.message)
}
// --pick: the approved cover becomes cover.png (no render)
if (pick) {
  const from = ['png', 'jpg'].map((e) => join(out, `cover-${pick}.${e}`)).find((f) => existsSync(f))
  if (!from) stop(`--pick ${pick}: no cover-${pick}.png in ${out} (render first)`)
  const to = join(out, 'cover' + extname(from))
  copyFileSync(from, to)
  spec.picked = pick
  writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n')
  console.log(`wrote ${to}  (variant ${pick}; "picked" saved in the spec)`)
  process.exit(0)
}
const variants = Object.entries(spec.variants || {}).filter(([k]) => !only || k === only)
if (!variants.length) stop('spec has no variants' + (only ? ' named ' + only : ''))
if (!only && variants.length < 2) console.warn('render-thumbnails: an A/B test needs 2 variants')

// the video's look: $W/style.json next to thumbs/ (story = no logo, no mascot, the moodboard's colours and fonts)
const style = loadStyle(dirname(specDir))
// a Short's cover: 1080×1920 (spec in $W/shorts/<n>-<slug>/cover/, next to the Short's style.json)
const VERT = args.includes('--vertical') || spec.format === 'short' || style.format === 'short'
const [TW, TH] = VERT ? [1080, 1920] : [1280, 720]
const prefix = VERT ? 'cover' : 'thumb'
// the channel name under the title on the compare sheet: always the configured channel for the video's
// language (config / channel.md), never a name typed into the spec
const channelName = channel(style).name
if (spec.channel && spec.channel !== channelName)
  console.warn(
    `render-thumbnails: spec "channel" (${spec.channel}) ignored: using the configured channel, ${channelName || '(none configured)'}`
  )
const fonts = fontsCss(style)
const themeCss = (() => {
  const t = style.theme
  const f = families(style)
  return `<style>#stage{--ground:${t.ground};--main:${t.main};--second:${t.second};--accent:${t.accent};${t.marker ? `--marker:${t.marker};` : ''}font-family:${f.body}}#stage .headline{font-family:${f.display}}</style>`
})()
const imgUrl = (p) => {
  if (!/\.(png|jpe?g|webp)$/i.test(p)) stop('photo must be .png, .jpg or .webp: ' + p)
  return dataUrl(p)
}
const logo = style.logo ? dataUrl(style.logo) : ''
const template = readFileSync(join(skill, 'assets/thumbnail.html'), 'utf8').replace(
  '<html>',
  VERT ? '<html class="vertical">' : '<html>'
)
const doodlesJs = readFileSync(join(skill, 'assets/doodles.js'), 'utf8')
const scenesJs = readFileSync(join(skill, 'assets/scenes.js'), 'utf8')
// condensed display faces for the feed layouts (question, title, mood), bundled under the OFL
const feedFonts = ['Anton', 'Oswald']
  .map((f) => {
    const file = join(skill, 'assets/fonts', f + '.woff2')
    if (!existsSync(file)) return ''
    const src = 'data:font/woff2;base64,' + readFileSync(file).toString('base64')
    return `@font-face{font-family:'${f}';src:url(${src}) format('woff2');font-weight:${f === 'Oswald' ? '200 700' : '400'};font-display:block}`
  })
  .join('')

// ---------- browser ----------
let browser
try {
  browser = await launchBrowser([
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--disable-lcd-text'
  ])
} catch (e) {
  stop(e.message)
}

const page = await browser.newPage({ viewport: { width: TW, height: TH }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const kb = (p) => Math.round(statSync(p).size / 1024)
const rendered = []
let failed = false

for (const [name, v] of variants) {
  if (v.photo && !existsSync(resolve(specDir, v.photo)))
    stop(`variant ${name}: photo not found: ${v.photo}`)
  const photo = v.photo ? imgUrl(resolve(specDir, v.photo)) : ''
  const paint = style.story && style.theme.texture === 'paint'
  const variant = style.story ? { logo: false, mascot: 'none', paint, ...v } : v
  const html = template
    .replace('/*FONTS*/', () => fonts + feedFonts)
    .replace('</head>', () => themeCss + '</head>')
    .replace('/*DOODLES*/', () => doodlesJs)
    .replace('/*SCENES*/', () => scenesJs)
    .replace('/*VARIANT*/ null', () => JSON.stringify(variant).replace(/</g, '\\u003c'))
    .replace('__LOGO__', () => logo)
    .replace('__PHOTO__', () => photo)
  const pagePath = join(out, `.${prefix}-${name}.html`)
  writeFileSync(pagePath, html)
  errors.length = 0
  await page.goto(pathToFileURL(pagePath).href)
  await page.evaluate(() => document.fonts.ready)
  // re-run the fit once the fonts are in (the first pass may have measured a fallback font)
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  rmSync(pagePath, { force: true })
  if (errors.length) stop(`variant ${name}: template error: ${errors.join(' | ')}`, 2)
  const { issues, warnings, textSize, words } = await page.evaluate(() => window.check())
  let file = join(out, `${prefix}-${name}.png`)
  await page.screenshot({ path: file })
  if (statSync(file).size > 2 * 1024 * 1024) {
    rmSync(file)
    file = join(out, `${prefix}-${name}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 })
  }
  console.log(
    `wrote ${file}  (${TW}×${TH}, ${kb(file)} KB, ${v.layout || 'bold'}, headline ${words} words` +
      (textSize ? ` at ${textSize}px` : '') +
      ')'
  )
  for (const w of warnings) console.warn(`  warning [${name}]: ${w}`)
  for (const i of issues) console.error(`  PROBLEM [${name}]: ${i}`)
  if (issues.length) failed = true
  rendered.push({ name, file, hypothesis: v.hypothesis })
}

// ---------- compare sheet: how each variant reads in a feed ----------
if (rendered.length) {
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    )
  const sizes = VERT ? [360, 220, 120] : [640, 360, 168]
  const caption = `<figcaption><b>${esc(spec.title || '')}</b><span>${esc(channelName)}</span></figcaption>`
  const cell = (r, w) =>
    `<figure style="width:${w}px"><img src="${dataUrl(r.file)}" style="width:${w}px;height:${Math.round((w * TH) / TW)}px">` +
    (w >= 300 ? caption : '') +
    `</figure>`
  // a cover: the Shorts shelf (title over the bottom), a profile grid's 3:4 centre crop, and small
  const vcells = (r) => {
    const img = dataUrl(r.file)
    return (
      `<figure style="width:360px"><div class="shelf"><img src="${img}" style="width:360px;height:640px">` +
      `<div class="over"><b>${esc(spec.title || '')}</b></div></div><figcaption><span>Shorts shelf</span></figcaption></figure>` +
      `<figure style="width:220px"><img src="${img}" style="width:220px;height:293px;object-fit:cover">` +
      `<figcaption><span>Profile grid (3:4 crop)</span></figcaption></figure>` +
      `<figure style="width:120px"><img src="${img}" style="width:120px;height:213px"></figure>`
    )
  }
  const rows = rendered
    .map(
      (r) =>
        `<section><h2>Variant ${esc(r.name)}</h2><div class="row">${VERT ? vcells(r) : sizes.map((w) => cell(r, w)).join('')}</div></section>`
    )
    .join('')
  const sheet = `<!doctype html><meta charset="utf-8"><style>${fonts}
    body{margin:0;padding:36px 40px;background:#f2f2f2;font-family:Inter,system-ui,sans-serif;color:#0f0f0f;width:max-content}
    h1{font-size:22px;margin:0 0 6px}p{margin:0 0 24px;color:#555;font-size:16px}
    h2{font:700 15px JetBrainsMono,monospace;letter-spacing:.1em;text-transform:uppercase;color:#555;margin:0 0 10px}
    section{margin-bottom:30px}.row{display:flex;gap:28px;align-items:flex-start}
    figure{margin:0}img{display:block;border-radius:12px}
    figcaption{display:flex;flex-direction:column;gap:4px;margin-top:10px;font-size:15px;line-height:1.3}
    figcaption span{color:#606060;font-size:13px}
    .shelf{position:relative}.shelf .over{position:absolute;left:0;right:0;bottom:0;padding:40px 14px 14px;
    border-radius:0 0 12px 12px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;font-size:15px;line-height:1.3}</style>
    <h1>${esc(spec.title || 'Thumbnail test')}</h1><p>${esc(spec.hypothesis || '')}</p>${rows}`
  const sheetPath = join(out, '.compare.html')
  writeFileSync(sheetPath, sheet)
  const p2 = await browser.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 1 })
  await p2.goto(pathToFileURL(sheetPath).href)
  await p2.evaluate(() => document.fonts.ready)
  const compare = join(out, 'compare.png')
  await p2.screenshot({ path: compare, fullPage: true })
  rmSync(sheetPath, { force: true })
  console.log(
    `wrote ${compare}  (` +
      (VERT
        ? 'each cover on the Shorts shelf, in a 3:4 grid crop and small'
        : `each variant at ${sizes.join(', ')} px wide`) +
      ')'
  )
  if (VERT && !only && !failed && rendered.length > 1)
    console.log(`once one is approved: render-thumbnails.mjs ${args[0]} --pick <A|B>  → cover.png`)
}

await browser.close()
if (failed) {
  console.error('render-thumbnails: fix the problems above and re-run.')
  process.exit(2)
}
