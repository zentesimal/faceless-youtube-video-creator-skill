#!/usr/bin/env node
// Captures the product screens a video shows, from $W/screens/shots.json, into $W/assets/screens/: one PNG
// per state, plus <id>.json with every target's box (picture pixels), the URL, the date and a source line.
// The `screen` layout (assets/screens.js) zooms, spotlights and clicks on those targets.
//
// usage:
//   capture-screens.mjs <video folder> [--only id,id] [--list]
//   capture-screens.mjs --login <name> <url> [--until <url part>]   sign in once in a visible window; the
//                         session is saved to <workspace>/.auth/<name>.json (keep it out of git) for shots with
//                         "login": "<name>". Close the window (or reach --until) when you're signed in.
//   capture-screens.mjs --logout <name>                             delete a saved session
//
// shots.json:
//   {"redact": [...], "shots": [
//     {"id": "play-settings", "url": "https://app.example.com/…", "login": "app", "viewport": [1440, 900],
//      "scale": 2, "wait": "text=Triggers", "hide": ["#intercom-frame"], "crop": "main",
//      "redact": [{"selector": "…", "text": "Video Account"}, {"selector": "…", "blur": true}],
//      "targets": {"triggers": "text=Triggers", "add": "role=button[name='Add trigger']"},
//      "states": [{"name": "before"},
//                 {"name": "after", "do": [{"click": "add"}, {"wait": "role=dialog"}], "targets": {"dialog": "role=dialog"}}]},
//     {"id": "docs", "url": "https://docs.example.com/…"},
//     {"id": "mine", "src": "assets/mine.png", "boxes": {"menu": [120, 80, 300, 60]}, "own": true},
//     {"id": "help-1", "fetch": "https://cdn.sanity.io/images/…/x.png", "page": "https://example.com/help/…"}
//   ]}
// `do` steps: click · hover · fill [target, text] · press "Enter" · scroll target · wait (selector or ms) ·
// goto url · eval "js". A step's target is a name from `targets` or a Playwright selector.
// Before every picture: the config's `screens.redact` rules (faceless-youtube.config.json; a rule with `host`
// only applies on that host), the file's and the shot's `redact`, then (unless
// "pii": false) emails and phone numbers in the visible text and inputs are blurred. Nothing is saved to the
// app: the edits live in the page only.
// Exit code 2 = a target or a step didn't resolve (the message lists what the page offers instead).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { imageSize, screensDir, shotMetaPath, sourceLine } from './screens.mjs'
import { launchBrowser, loadConfig } from './style.mjs'

const args = process.argv.slice(2)
const stop = (m, code = 1) => {
  console.error('capture-screens: ' + m)
  process.exit(code)
}
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : (args[i + 1] ?? d)
}
const firstArg = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : process.cwd()
const config = loadConfig(firstArg)
const authDir = join(config.workspace, '.auth')
const authPath = (name) => join(authDir, String(name).replace(/[^\w.-]/g, '_') + '.json')

// redactions from the project config, by host (e.g. your app's account name → "Demo Account"):
//   "screens": {"redact": [{"host": "app.example.com", "selector": ".account-name", "text": "Demo Account"}]}
const BUILTIN_REDACT = config.screens?.redact || []

// ---------- login / logout ----------
if (args.includes('--logout')) {
  const name = flag('--logout')
  if (!name || name.startsWith('--')) stop('usage: capture-screens.mjs --logout <name>')
  rmSync(authPath(name), { force: true })
  console.log(`deleted the saved session "${name}"`)
  process.exit(0)
}
if (args.includes('--login')) {
  const i = args.indexOf('--login')
  const name = args[i + 1]
  const url = args[i + 2]
  if (!name || !url || url.startsWith('--'))
    stop('usage: capture-screens.mjs --login <name> <url> [--until <url part>]')
  const until = flag('--until', null)
  const browser = await launchBrowser(undefined, { headless: false }).catch((e) => stop(e.message))
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(url).catch(() => {})
  console.log(
    `Sign in in the Chrome window${until ? ` (saved as soon as the address contains "${until}")` : ''}, then close the window. Waiting up to 10 minutes…`
  )
  let closed = false
  page.on('close', () => (closed = true))
  const t0 = Date.now()
  while (!closed && Date.now() - t0 < 600_000) {
    if (until && page.url().includes(until)) {
      await page.waitForTimeout(2500)
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  mkdirSync(authDir, { recursive: true })
  await ctx.storageState({ path: authPath(name) })
  await browser.close()
  console.log(
    `saved the session "${name}" to ${authPath(name)} (it holds your login: keep it out of git, never share it; --logout ${name} deletes it)`
  )
  process.exit(0)
}

// ---------- capture ----------
const W = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
if (!W) stop('usage: capture-screens.mjs <video folder> [--only id,id] [--list]')
const outDir = screensDir(W)
const listPath = join(W, 'screens', 'shots.json')

if (args.includes('--list')) {
  if (!existsSync(outDir)) stop('nothing captured yet in ' + outDir)
  const metas = readdirSync(outDir).filter((f) => f.endsWith('.json'))
  for (const f of metas) {
    const m = JSON.parse(readFileSync(join(outDir, f), 'utf8'))
    console.log(`${m.id}  ${m.w}×${m.h}  ${m.source || m.url || ''}`)
    for (const s of m.states) {
      const t = Object.entries(s.boxes || {})
        .map(([k, b]) => `${k} [${b.map((v) => Math.round(v)).join(', ')}]`)
        .join(' · ')
      console.log(`  ${s.name}: ${s.file}${t ? '  ·  ' + t : ''}`)
    }
  }
  process.exit(0)
}
if (!existsSync(listPath))
  stop(
    `no shot list: write ${listPath} (see the header of this script, or video-playbook.md › Product screens)`
  )
let list
try {
  list = JSON.parse(readFileSync(listPath, 'utf8'))
} catch (e) {
  stop(`${listPath} is not valid JSON: ${e.message}`)
}
const only = flag('--only', null)
  ?.split(',')
  .map((x) => x.trim())
const shots = (list.shots || []).filter((s) => !only || only.includes(s.id))
if (!shots.length) stop(only ? `no shot with id ${only.join(', ')}` : 'shots.json has no shots')
for (const s of shots)
  if (!s.id || !/^[\w-]+$/.test(s.id)) stop(`shot id "${s.id}" must be letters, digits, - or _`)
mkdirSync(outDir, { recursive: true })

const problems = []
const now = new Date().toISOString()
const writeMeta = (m) => writeFileSync(shotMetaPath(W, m.id), JSON.stringify(m, null, 2) + '\n')
let browser = null

for (const shot of shots) {
  try {
    if (shot.src || shot.fetch) await fileShot(shot)
    else if (shot.url) await pageShot(shot)
    else problems.push(`[${shot.id}] needs "url", "src" or "fetch"`)
  } catch (e) {
    problems.push(`[${shot.id}] ${e.message.split('\n')[0]}`)
  }
}
if (browser) await browser.close()
if (problems.length) {
  problems.forEach((p) => console.error('PROBLEM ' + p))
  process.exit(2)
}

// a picture you have (`src`) or one on the web (`fetch`, e.g. a help-center screenshot on cdn.sanity.io)
async function fileShot(shot) {
  let buf
  let ext
  if (shot.fetch) {
    const r = await fetch(shot.fetch)
    if (!r.ok)
      throw new Error(
        `fetch ${shot.fetch}: HTTP ${r.status} (if the host is blocked, download it by hand into $W/assets/ and use "src")`
      )
    buf = Buffer.from(await r.arrayBuffer())
    const type = r.headers.get('content-type') || ''
    ext = type.includes('jpeg')
      ? '.jpg'
      : type.includes('webp')
        ? '.webp'
        : type.includes('gif')
          ? '.gif'
          : '.png'
  } else {
    const p = resolve(W, shot.src)
    if (!existsSync(p)) throw new Error(`src not found: ${shot.src}`)
    buf = readFileSync(p)
    ext = extname(p).toLowerCase() || '.png'
  }
  const size = imageSize(buf)
  if (!size) throw new Error('not a PNG, JPEG, GIF or WebP picture')
  const file = `${shot.id}-main${ext}`
  writeFileSync(join(outDir, file), buf)
  const from = shot.page || shot.fetch
  writeMeta({
    id: shot.id,
    url: shot.page || '',
    source: shot.source || (shot.own ? '' : from ? sourceLine(from, now) : ''),
    captured: now,
    own: !!shot.own,
    ...size,
    states: [{ name: 'main', file, boxes: shot.boxes || {} }]
  })
  console.log(`${shot.id}: ${file} (${size.w}×${size.h})${shot.fetch ? ' from ' + shot.fetch : ''}`)
}

async function pageShot(shot) {
  if (!browser) browser = await launchBrowser()
  const [vw, vh] = shot.viewport || [1440, 900]
  const scale = shot.scale ?? 2
  let storageState
  if (shot.login) {
    const p = authPath(shot.login)
    if (!existsSync(p))
      throw new Error(
        `no saved session "${shot.login}": run capture-screens.mjs --login ${shot.login} <sign-in url> first`
      )
    storageState = p
  }
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: scale,
    storageState,
    colorScheme: shot.dark ? 'dark' : 'light',
    locale: shot.locale || (list.locale ?? 'en-US'),
    reducedMotion: 'reduce'
  })
  const page = await ctx.newPage()
  try {
    await page.goto(shot.url, { waitUntil: 'load', timeout: 45_000 })
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
    if (shot.wait) await waitFor(page, shot, shot.wait)
    const targetsAll = { ...(shot.targets || {}) }
    const states = shot.states?.length ? shot.states : [{ name: 'main' }]
    const metaStates = []
    let size0 = null
    for (const st of states) {
      if (!st.name || !/^[\w-]+$/.test(st.name))
        throw new Error(`state name "${st.name}" must be letters, digits, - or _`)
      Object.assign(targetsAll, st.targets || {})
      for (const step of st.do || []) await runStep(page, shot, targetsAll, step)
      await page.waitForTimeout(st.settle ?? 500)
      await page.evaluate(() => document.fonts.ready)
      const redacted = await prepare(page, shot)
      // the picture: the whole viewport, or one element (`crop`)
      let origin = { x: 0, y: 0 }
      let crop = null
      const cropSel = st.crop ?? shot.crop
      if (cropSel) {
        crop = page.locator(sel(targetsAll, cropSel)).first()
        await crop.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
        const b = await crop.boundingBox()
        if (!b) throw new Error(`crop "${cropSel}" not found on the page${await offer(page)}`)
        origin = b
      }
      const boxes = {}
      // the shot's targets must be on its first state (later states keep the ones still on screen); a
      // state's own targets must be on that state
      const required = new Set(
        Object.keys(
          st === states[0] ? { ...(shot.targets || {}), ...(st.targets || {}) } : st.targets || {}
        )
      )
      const names = Object.keys({ ...(shot.targets || {}), ...(st.targets || {}) })
      const imgW = Math.round((crop ? origin.width : vw) * scale)
      const imgH = Math.round((crop ? origin.height : vh) * scale)
      for (const name of names) {
        const loc = page.locator(sel(targetsAll, name)).first()
        const b = await loc.boundingBox({ timeout: 3000 }).catch(() => null)
        if (!b) {
          if (!required.has(name)) continue
          problems.push(
            `[${shot.id} · ${st.name}] target "${name}" (${targetsAll[name]}) not found${await offer(page)}`
          )
          continue
        }
        const box = [
          (b.x - origin.x) * scale,
          (b.y - origin.y) * scale,
          b.width * scale,
          b.height * scale
        ].map((v) => Math.round(v * 10) / 10)
        if (box[0] < 0 || box[1] < 0 || box[0] + box[2] > imgW + 1 || box[1] + box[3] > imgH + 1)
          console.warn(
            `warning: [${shot.id} · ${st.name}] target "${name}" is partly outside the picture: scroll to it (a "scroll" step) or crop to a part that holds it`
          )
        boxes[name] = box
      }
      const file = `${shot.id}-${st.name}.png`
      const path = join(outDir, file)
      if (crop) await crop.screenshot({ path, animations: 'disabled' })
      else await page.screenshot({ path, animations: 'disabled' })
      const size = imageSize(readFileSync(path))
      metaStates.push({ name: st.name, file, boxes })
      console.log(
        `${shot.id} · ${st.name}: ${file} (${size.w}×${size.h}), ${Object.keys(boxes).length} targets${redacted.length ? ', redacted: ' + redacted.join(', ') : ''}`
      )
      if (!size0) size0 = size
      else if (size.w !== size0.w || size.h !== size0.h)
        problems.push(
          `[${shot.id}] its states' pictures differ in size: crop them to the same element, or drop "crop"`
        )
    }
    writeMeta({
      id: shot.id,
      url: shot.url,
      source: shot.source || sourceLine(page.url() || shot.url, now),
      captured: now,
      viewport: [vw, vh],
      scale,
      w: size0.w,
      h: size0.h,
      states: metaStates
    })
  } finally {
    await ctx.close()
  }
}

// a target name from `targets`, or a Playwright selector as is
function sel(targets, ref) {
  return targets[ref] ?? ref
}
async function waitFor(page, shot, what) {
  if (typeof what === 'number') return page.waitForTimeout(what)
  try {
    await page.locator(what).first().waitFor({ timeout: 20_000 })
  } catch {
    const login =
      /log ?in|sign ?in|password|iniciar sesi/i.test(await page.title().catch(() => '')) ||
      /login|signin|auth/i.test(page.url())
    throw new Error(
      `"${what}" never appeared on ${page.url()}` +
        (login || shot.login
          ? `: the page looks signed out; run capture-screens.mjs --login ${shot.login || '<name>'} <sign-in url> (and set "login" on the shot)`
          : await offer(page))
    )
  }
}
async function runStep(page, shot, targets, step) {
  const [k] = Object.keys(step)
  const v = step[k]
  const loc = (ref) => page.locator(sel(targets, ref)).first()
  try {
    if (k === 'click') await loc(v).click({ timeout: 8000 })
    else if (k === 'hover') await loc(v).hover({ timeout: 8000 })
    else if (k === 'fill') await loc(v[0]).fill(String(v[1]), { timeout: 8000 })
    else if (k === 'press') await page.keyboard.press(v)
    else if (k === 'scroll') await loc(v).scrollIntoViewIfNeeded({ timeout: 8000 })
    else if (k === 'wait') await waitFor(page, shot, typeof v === 'number' ? v : sel(targets, v))
    else if (k === 'goto') {
      await page.goto(v, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
    } else if (k === 'eval') await page.evaluate(v)
    else
      throw new Error(`unknown step "${k}" (click, hover, fill, press, scroll, wait, goto, eval)`)
  } catch (e) {
    throw new Error(
      `step ${JSON.stringify(step)} failed: ${e.message.split('\n')[0]}${await offer(page)}`
    )
  }
}
// what the page offers to point at, when a selector misses: visible buttons, links, headings, labels
async function offer(page) {
  const seen = await page
    .evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll(
        'button, a, [role=button], [role=tab], h1, h2, h3, label'
      )) {
        const r = e.getBoundingClientRect()
        const t = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')
        if (t && t.length < 40 && r.width && r.height && r.bottom > 0 && r.top < innerHeight)
          out.push(t)
      }
      return [...new Set(out)].slice(0, 25)
    })
    .catch(() => [])
  return seen.length ? `. On screen: ${seen.map((t) => JSON.stringify(t)).join(', ')}` : ''
}

// before every picture: hide what shouldn't show, redact, blur personal data. Returns what it changed.
async function prepare(page, shot) {
  let host = ''
  try {
    host = new URL(page.url()).host
  } catch {}
  const rules = [
    ...BUILTIN_REDACT.filter((r) => !r.host || r.host === host),
    ...(list.redact || []),
    ...(shot.redact || [])
  ]
  return page.evaluate(
    ({ hide, css, rules, pii }) => {
      const done = []
      if (css || hide.length) {
        const st =
          document.getElementById('__cap_css') ||
          document.head.appendChild(document.createElement('style'))
        st.id = '__cap_css'
        st.textContent = (css || '') + hide.map((h) => `${h}{visibility:hidden!important}`).join('')
      }
      const blur = (e) => {
        e.style.filter = 'blur(7px)'
        e.style.userSelect = 'none'
      }
      for (const r of rules) {
        if (r.selector) {
          let els = []
          try {
            els = [...document.querySelectorAll(r.selector)]
          } catch {}
          if (r.first) els = els.slice(0, 1)
          for (const e of els) {
            if (r.blur) blur(e)
            else if (r.text != null) {
              if (e.textContent !== r.text) e.textContent = r.text
            }
          }
          if (els.length) done.push(r.label || (r.blur ? 'blurred ' : '') + r.selector.slice(0, 40))
        } else if (r.find != null) {
          // replace a literal text everywhere it shows (a customer's name, a company)
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          let n
          let hit = 0
          while ((n = w.nextNode()))
            if (n.nodeValue.includes(r.find)) {
              n.nodeValue = n.nodeValue.split(r.find).join(r.replace ?? '•••')
              hit++
            }
          if (hit) done.push(`"${r.find.slice(0, 20)}" ×${hit}`)
        }
      }
      if (pii) {
        const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
        const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/
        const isPhone = (t) => {
          const m = t.match(PHONE)
          return m && m[0].replace(/\D/g, '').length >= 9
        }
        let n = 0
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const hits = []
        let t
        while ((t = w.nextNode())) {
          const v = t.nodeValue
          if (
            v &&
            (EMAIL.test(v) || isPhone(v)) &&
            t.parentElement &&
            !t.parentElement.closest('script,style')
          )
            hits.push(t.parentElement)
        }
        for (const e of new Set(hits)) {
          blur(e)
          n++
        }
        for (const i of document.querySelectorAll('input, textarea'))
          if (EMAIL.test(i.value || '') || isPhone(i.value || '')) {
            blur(i)
            n++
          }
        if (n) done.push(`${n} emails/phones blurred`)
      }
      return done
    },
    {
      hide: [...(list.hide || []), ...(shot.hide || [])],
      css: shot.css || '',
      rules,
      pii: shot.pii ?? list.pii ?? true
    }
  )
}
