// Shared by every script: the project config, the video's look ($W/style.json), fonts, channel identity, browser.
//
// The project config, faceless-youtube.config.json, lives in the user's project (found by walking up from the
// video folder, then from the cwd); the documented example is ../references/faceless-youtube.config.example.json. Defaults
// below fill anything it leaves out. Per video, $W/style.json (written by the skill's setup step) picks the look:
//   { "preset": "<folder in ../styles/>", "pace": 1-5, "voice": "af_heart", "animate": "auto" | "off",
//     "illustrations": false, "style": "brand" | "story", "inspiration": "/abs/folder",
//     "theme": { "ground", "main", "second", "accent": "#hex", "display", "body", "fontFiles": {…},
//                "texture": "dots" | "grain" | "paint" | "none", "paper": "#hex" }, "imageStyle": "…", "gap", "sectionGap", "maxPause",
//     "camera": "auto" | "off" | a move name (camera with parallax on scene and illustration slides; render-video.mjs) }
//   theme "outline": px (the characters' line width; 0 = flat) and theme "texture": "soft" (clean vignette).
// Merge order: defaults ← preset ← config "video" ← $W/style.json ← CLI flags.
// `brand` = the channel's own palette, fonts, logo and wordmark (from the config). `story` = no branding.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const skill = resolve(here, '..')
export const CONFIG_FILE = 'faceless-youtube.config.json'

export const DEFAULTS = {
  identity: {
    name: 'My Channel',
    handle: '',
    avatar: null,
    company: null,
    promise: '',
    audience: '',
    pillars: [],
    language: 'en'
  },
  look: {
    preset: 'clean',
    colors: { ground: '#f4f4f6', main: '#2457d6', second: '#14171f', accent: '#f5a524' },
    fonts: { display: 'Fraunces', body: 'Inter' },
    fontFiles: {},
    texture: 'dots',
    logo: null,
    mascot: 'ghost',
    imageStyle: null
  },
  video: { minutes: 15, pace: 3, voice: 'af_heart', animate: 'auto', illustrations: false },
  paths: {
    workspace: './videos',
    topics: './youtube-topics.csv',
    kit: './channel',
    channel: './channel/channel.md'
  },
  models: { image: 'gpt-image-2.5-sunburst', speech: 'gpt-4o-mini-tts' },
  credit: true,
  integrations: { zentesimal: false }
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}
export const dataUrl = (p) =>
  `data:${MIME[extname(p).toLowerCase()] || 'application/octet-stream'};base64,` +
  readFileSync(p).toString('base64')

const FORMAT = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' }
const fontFace = (family, p, weight = '100 900') =>
  existsSync(p)
    ? `@font-face{font-family:'${family}';src:url(${dataUrl(p)}) format('${FORMAT[extname(p).toLowerCase()] || 'woff2'}');font-weight:${weight};font-display:block}`
    : ''

const readJson = (p, label) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error(`${label} is not valid JSON: ${e.message}`)
  }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const merge = (a, b) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b || {}))
    out[k] = isObj(v) && isObj(a?.[k]) ? merge(a[k], v) : v
  return out
}

/** Finds faceless-youtube.config.json walking up from `start` (a video folder), then from the cwd. */
export function findConfig(start) {
  for (const from of [start, process.cwd()].filter(Boolean)) {
    let d = resolve(from)
    for (;;) {
      if (existsSync(join(d, CONFIG_FILE))) return join(d, CONFIG_FILE)
      const up = dirname(d)
      if (up === d) break
      d = up
    }
  }
  return null
}

/** The first of `names` that exists in `dir`, or null. */
const firstIn = (dir, names) =>
  (dir ? names.map((n) => join(dir, n)).find((p) => existsSync(p)) : null) || null

/**
 * The merged project config, plus `file` (path or null), `project` (its folder), `at(path)`, `workspace`, `ttsDir`,
 * and the channel kit: `kit` (the folder, default ./channel/), `channelMd` (the brief; an older project's
 * ./channel.md still works), `kitLogo` and `kitAvatar` (logo.* / avatar.* in the kit, used when the config names none).
 */
export function loadConfig(start) {
  const file = findConfig(start)
  const cfg = merge(DEFAULTS, file ? readJson(file, CONFIG_FILE) : {})
  const project = file ? dirname(file) : process.cwd()
  const at = (p) => (p ? (isAbsolute(p) ? p : resolve(project, p)) : null)
  const workspace = at(cfg.paths.workspace)
  const kit = at(cfg.paths.kit)
  let channelMd = at(cfg.paths.channel)
  if (!(channelMd && existsSync(channelMd)) && existsSync(join(project, 'channel.md')))
    channelMd = join(project, 'channel.md')
  const kitLogo = firstIn(kit, ['logo.png', 'logo.svg', 'logo.jpg', 'logo.webp'])
  const kitAvatar = firstIn(kit, ['avatar.png', 'avatar.jpg', 'avatar.webp'])
  return {
    ...cfg,
    file,
    project,
    at,
    workspace,
    ttsDir: join(workspace, '.tts'),
    kit,
    channelMd,
    kitLogo,
    kitAvatar
  }
}

/** The style presets: one folder per look in ../styles/ (each with a style.json). */
export function listPresets() {
  const dir = join(skill, 'styles')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'style.json')))
    .map((d) => d.name)
}

/** The video's look: $W/style.json on top of the project config and its preset (see the header). */
export function loadStyle(W) {
  const config = loadConfig(W)
  const p = W && join(W, 'style.json')
  const local = p && existsSync(p) ? readJson(p, 'style.json') : {}
  const presetName = local.preset || config.look.preset
  let base = {}
  let presetDir = null
  if (presetName) {
    presetDir = join(skill, 'styles', presetName)
    const pp = join(presetDir, 'style.json')
    if (!existsSync(pp))
      throw new Error(
        `style preset "${presetName}" not found in ${join(skill, 'styles')} (have: ${listPresets().join(', ') || 'none'})`
      )
    base = readJson(pp, `styles/${presetName}/style.json`)
  }
  const s = {
    inspiration: presetDir && join(presetDir, 'images'),
    ...base,
    ...config.video,
    ...local,
    preset: presetName,
    theme: { ...(base.theme || {}), ...(local.theme || {}) },
    presetDir
  }
  const story = s.style === 'story'
  const L = config.look
  const brandTheme = {
    ...L.colors,
    display: L.fonts.display,
    body: L.fonts.body,
    fontFiles: L.fontFiles || {},
    texture: L.texture || 'dots'
  }
  const theme = story
    ? { ...brandTheme, fontFiles: {}, texture: 'grain', ...s.theme }
    : { ...brandTheme, ...s.theme }
  const logoPath = config.at(L.logo) || config.kitLogo
  const logo = !story && logoPath && existsSync(logoPath) ? logoPath : null
  if (!story && logoPath && !logo) console.warn(`config: look.logo not found: ${logoPath}`)
  return {
    ...s,
    imageStyle: s.imageStyle || L.imageStyle || null,
    style: story ? 'story' : 'brand',
    story,
    brand: !story,
    theme,
    logo,
    mascot: L.mascot || 'ghost',
    config
  }
}

// ---------- generated pictures (scripts/gen-images.mjs) ----------
// The house style sent with every prompt, so illustrations match the look. The config (look.imageStyle), a
// preset or $W/style.json can set their own. Pictures never carry text (the slide adds it) and never show a
// real product screen.
const NO_TEXT =
  'No text, letters, numbers, logos, watermarks or user-interface screenshots anywhere in the image.'
export const IMAGE_STYLES = {
  paint:
    'Crude MS Paint-style drawing on a white canvas: thick wobbly black outlines, flat bright Paint colours (red #ED1C24, yellow #FFF200, blue #00A2E8, green #22B14C, indigo #3F48CC), ' +
    'no shading, no gradients, childlike but clear and funny composition, like a quick mouse drawing.'
}
const MASCOT = {
  ghost:
    'a friendly rounded white ghost with a wavy bottom edge, two dark oval eyes, a small smile and rosy cheeks, thin dark outline',
  robot:
    'a friendly boxy robot with a screen face and round eyes, an antenna with a small ball on top',
  person: 'a friendly simple cartoon person with a round head and plain clothes'
}
export function imageStyle(style) {
  if (style.imageStyle) return style.imageStyle
  if (style.theme.texture === 'paint') return IMAGE_STYLES.paint
  const t = style.theme
  return style.brand
    ? `Flat hand-drawn illustration with soft shapes and thin ${t.second} outlines on a light ${t.ground} ground. ` +
        `Palette built from ${t.main} (main), ${t.second} (outlines, dark areas) and ${t.accent} (accents), with soft pastel tints of them. ` +
        `When a character fits, use the channel's mascot: ${MASCOT[style.mascot] || MASCOT.ghost}. ` +
        'Lots of space, soft shadows, no photorealism, no 3D, no heavy gradients.'
    : `Flat editorial illustration in a calm documentary style. Background ${t.ground}, main colour ${t.main}, ` +
        `outlines and shadows ${t.second}, one accent ${t.accent}. Simple shapes, generous space, subtle paper grain, no photorealism, no 3D.`
}
/** The full prompt for one picture: house style + what to draw (+ room for characters on a background). */
const FRAMING = {
  background:
    'This is a background for a video slide: no people, no characters, no mascot. Keep the lower middle third calm and uncluttered (characters are drawn on top later), with a clear horizon or floor about 85% down.',
  illustration:
    'Wide 16:9 composition for a video slide; keep the subject inside the middle 80% (the edges may be cropped) and leave calm space at the bottom for a line of text.',
  // layered illustrations (`layers`): the camera moves each layer at its own speed, so they must stack cleanly
  backdrop:
    'This is the far background plate of a layered 16:9 shot for an animated video: sky, distant scenery and the ground plane, softer and lighter with distance. No characters. Nothing important near the edges: the camera drifts and crops them. Other layers are placed on top of it later.',
  layer:
    'This is one cut-out layer of a layered 16:9 shot for an animated video: draw ONLY the described element(s), fully isolated on a transparent background (no sky, no backdrop, no ground plane beyond what the element stands on, no frame, no vignette, no drop-shadow box). Keep the element at the size and position it has in the final 16:9 frame (e.g. a foreground rock in the lower-left corner), with clean edges.'
}
export function imagePrompt(prompt, style, kind = 'illustration') {
  return [
    imageStyle(style),
    'Scene: ' + prompt.trim(),
    FRAMING[kind] || FRAMING.illustration,
    NO_TEXT
  ].join('\n\n')
}
/** Where a generated picture lives: $W/assets/gen/<hash of prompt + style>.png (changing either makes a new one). */
export const genPath = (W, prompt, style, kind) =>
  join(
    W,
    'assets',
    'gen',
    createHash('sha1')
      .update(imagePrompt(prompt, style, kind || 'illustration'))
      .digest('hex')
      .slice(0, 12) + '.png'
  )

/** @font-face CSS for the bundled fonts, YouTube's Roboto, and the theme's own font files. */
export function fontsCss(style) {
  const bundled = join(skill, 'assets/fonts')
  const yt = join(skill, 'assets/youtube')
  const css = [
    fontFace('Fraunces', join(bundled, 'Fraunces.woff2')),
    fontFace('Inter', join(bundled, 'Inter.woff2')),
    fontFace('JetBrainsMono', join(bundled, 'JetBrainsMono.woff2'), '100 800'),
    fontFace('Roboto', join(yt, 'Roboto-400.woff2'), '400'),
    fontFace('Roboto', join(yt, 'Roboto-500.woff2'), '500 700')
  ]
  // story font files are relative to the preset (or inspiration folder); the brand's to the project
  const base = style.story ? style.presetDir || style.inspiration || '.' : style.config.project
  for (const [role, file] of Object.entries(style.theme.fontFiles || {})) {
    const p = isAbsolute(file) ? file : resolve(base, file)
    if (!existsSync(p)) console.warn(`style: ${role} font not found: ${p} (falling back)`)
    else css.push(fontFace(role === 'display' ? 'StoryDisplay' : 'StoryBody', p))
  }
  return css.filter(Boolean).join('\n')
}

/** CSS font-family stacks for the theme (font files win over named families). */
export function families(style) {
  const t = style.theme
  const files = t.fontFiles || {}
  const display = files.display
    ? `'StoryDisplay', '${t.display}', Georgia, serif`
    : `'${t.display}', Georgia, serif`
  const body = files.body
    ? `'StoryBody', '${t.body}', system-ui, sans-serif`
    : `'${t.body}', system-ui, sans-serif`
  return { display, body }
}

// WCAG contrast between two hex colours
const lum = (hex) => {
  const h = hex.replace('#', '')
  const v = (h.length === 3 ? h.replace(/./g, '$&$&') : h)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
  const [r, g, b] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Warnings for a theme: missing colours, low contrast. */
export function themeWarnings(style) {
  const t = style.theme
  const out = []
  for (const k of ['ground', 'main', 'second', 'accent'])
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(t[k] || ''))
      out.push(`theme.${k} must be a #hex colour`)
  if (out.length) return out
  const c = contrast(t.ground, t.second)
  if (c < 4.5)
    out.push(
      `ground ${t.ground} vs second ${t.second} contrast is ${c.toFixed(1)}:1 (< 4.5): text will be hard to read`
    )
  const m = contrast(t.ground, t.main)
  if (m < 3)
    out.push(
      `ground ${t.ground} vs main ${t.main} contrast is ${m.toFixed(1)}:1 (< 3): bold words and numbers will fade`
    )
  const a = contrast(t.ground, t.accent)
  if (a < 1.5)
    out.push(
      `ground ${t.ground} vs accent ${t.accent} contrast is ${a.toFixed(1)}:1 (< 1.5): highlights will barely show; pick a stronger accent`
    )
  return out
}

/** Channel identity: the config's identity, else the kit's channel.md table, else the kit's avatar.*: name, handle, avatar. */
export function channel(style) {
  const config = style.config
  const mdPath = config.channelMd
  const md = readFileSync(
    mdPath && existsSync(mdPath) ? mdPath : join(skill, 'references/channel.example.md'),
    'utf8'
  )
  const row = (name) => {
    const m = md.match(new RegExp(`^\\|\\s*${name}\\s*\\|\\s*(.*?)\\s*\\|`, 'mi'))
    // the value's first token (backticks off); notes in parentheses after it are ignored
    const v = m ? m[1].replace(/`/g, '').trim().split(/\s+\(/)[0].trim() : ''
    return v && !/^<.*>$/.test(v) && v !== '-' ? v : ''
  }
  const id = config.identity
  const name = (config.file && id.name) || row('Channel name') || id.name
  const handle = id.handle || row('Handle')
  const avatarPath = id.avatar || row('Avatar') || config.kitAvatar
  let avatar = ''
  if (avatarPath) {
    const p = config.at(avatarPath)
    if (existsSync(p)) avatar = dataUrl(p)
    else console.warn(`channel: avatar not found: ${p}`)
  }
  if (!avatar && style.brand && style.logo) avatar = dataUrl(style.logo)
  return { name, handle: handle ? '@' + handle.replace(/^@/, '') : '', avatar }
}

/** Playwright: the skill's own install (`npm install` in the skill folder), the project's, or the global one. */
export async function loadPlaywright() {
  const { execFileSync } = await import('node:child_process')
  const { createRequire } = await import('node:module')
  for (const [from, name] of [
    [join(skill, 'package.json'), 'playwright'],
    [join(process.cwd(), 'package.json'), 'playwright'],
    [join(process.cwd(), 'package.json'), '@playwright/test']
  ]) {
    try {
      return createRequire(from)(name)
    } catch {}
  }
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    return createRequire(join(root, 'noop.js'))('playwright')
  } catch {}
  throw new Error(
    `cannot load Playwright: run \`npm install\` in ${skill} (or install playwright in your project)`
  )
}

/** Headless Chrome (Playwright's Chromium, or Google Chrome, or CHROMIUM_PATH). */
export async function launchBrowser(
  args = ['--font-render-hinting=none', '--force-color-profile=srgb']
) {
  const pw = await loadPlaywright()
  const chromium = env('CHROMIUM_PATH')
  for (const o of chromium
    ? [{ executablePath: chromium }]
    : [{}, { channel: 'chrome' }, { executablePath: '/opt/pw-browsers/chromium' }]) {
    try {
      return await pw.chromium.launch({ ...o, args })
    } catch {}
  }
  throw new Error(
    'cannot start Chrome: run `npx playwright install chromium`, install Google Chrome, or set CHROMIUM_PATH'
  )
}
