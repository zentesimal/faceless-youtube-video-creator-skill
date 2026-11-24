// Product screens on disk: what scripts/capture-screens.mjs writes and render-video.mjs reads.
//
//   $W/screens/shots.json             the shot list (written from the brief)
//   $W/assets/screens/<id>-<state>.png the pictures, one per state
//   $W/assets/screens/<id>.json        {id, url, source, captured, w, h, states: [{name, file, boxes}]}
//                                      boxes: {target: [x, y, w, h]} in the picture's pixels
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataUrl } from './style.mjs'

export const screensDir = (W) => join(W, 'assets', 'screens')
export const shotMetaPath = (W, id) => join(screensDir(W), id + '.json')

/** Width and height of a PNG, JPEG, GIF or WebP from its header, or null. */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47)
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF')
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) }
  if (
    buf.length > 30 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const kind = buf.toString('ascii', 12, 16)
    if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
    if (kind === 'VP8 ')
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21)
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }
    }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return null
      const m = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      i += 2 + len
    }
  }
  return null
}

const host = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
// the URL as the browser bar shows it: host + path, no query or hash
export const barUrl = (u) => {
  try {
    const x = new URL(u)
    return (x.host.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname)).slice(0, 90)
  } catch {
    return ''
  }
}
export const monthYear = (iso, lang = 'en') =>
  new Date(iso).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    month: 'short',
    year: 'numeric'
  })
export const sourceLine = (url, iso, lang) =>
  [host(url), iso ? monthYear(iso, lang) : ''].filter(Boolean).join(', ')

/**
 * What a `screen` cue shows, ready for slide.html (`spec._scr`): {w, h, url, source, states: [{name, src
 * (data URL), boxes}]}. A cue names a captured `shot`, or a picture with `src` (+ `boxes` by hand).
 * Returns {scr} or {error}.
 */
export function loadScreen(W, cue, lang = 'en') {
  if (cue.shot) {
    const p = shotMetaPath(W, cue.shot)
    if (!existsSync(p))
      return { error: `screen "${cue.shot}" not captured yet: run scripts/capture-screens.mjs` }
    const m = JSON.parse(readFileSync(p, 'utf8'))
    const states = []
    for (const s of m.states || []) {
      const f = join(screensDir(W), s.file)
      if (!existsSync(f)) return { error: `screen "${cue.shot}": picture missing: ${s.file}` }
      states.push({
        name: s.name,
        src: dataUrl(f),
        boxes: { ...(s.boxes || {}), ...(cue.boxes || {}) }
      })
    }
    if (!states.length) return { error: `screen "${cue.shot}" has no states` }
    return {
      scr: {
        w: m.w,
        h: m.h,
        url: m.url ? barUrl(m.url) : '',
        source: m.source || (m.url ? sourceLine(m.url, m.captured, lang) : ''),
        states
      }
    }
  }
  if (cue.src) {
    // one picture, or {"before": "assets/a.png", "after": "assets/b.png"} for states; `boxes` by hand
    // ({target: [x, y, w, h]}, or {state: {target: [x, y, w, h]}} per state)
    const files = typeof cue.src === 'string' ? { main: cue.src } : cue.src
    const states = []
    let size = null
    for (const [name, rel] of Object.entries(files)) {
      const f = resolve(W, rel)
      if (!existsSync(f)) return { error: `image not found: ${rel}` }
      const sz = imageSize(readFileSync(f))
      if (!sz) return { error: `can't read the size of ${rel} (use PNG, JPEG, GIF or WebP)` }
      if (size && (sz.w !== size.w || sz.h !== size.h))
        return { error: `the states' pictures must be the same size (${rel} is ${sz.w}×${sz.h})` }
      size = sz
      const b = cue.boxes || {}
      const perState = b[name] && !Array.isArray(b[name]) ? b[name] : null
      const shared = Object.fromEntries(Object.entries(b).filter(([, v]) => Array.isArray(v)))
      states.push({ name, src: dataUrl(f), boxes: { ...shared, ...(perState || {}) } })
    }
    return { scr: { ...size, url: cue.url || '', source: cue.source || '', states } }
  }
  return { error: 'a screen cue needs `shot` (captured) or `src` (a picture in $W)' }
}
