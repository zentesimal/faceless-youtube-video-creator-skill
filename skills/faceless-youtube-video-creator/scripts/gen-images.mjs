#!/usr/bin/env node
// Generates the pictures a script asks for, with the OpenAI Image API (model: config models.image):
// every `illustration` cue with a "prompt" (or each prompt in its "layers": the first one an opaque
// backdrop, the others cut-outs on a transparent background, for the camera's parallax), and every `scene`
// cue whose "bg" is {"prompt": …}.
//
//   node gen-images.mjs <$W> [--dry-run] [--quality low|medium|high] [--force] [--only <hash>]
//
// Each picture is saved as $W/assets/gen/<hash>.png, where the hash covers the prompt and the look's image
// style (style.mjs › imageStyle), so the renderer finds it by itself and an edited prompt makes a new one.
// Existing files are skipped (--force regenerates). --dry-run lists what would be generated, with the full
// prompts, and spends nothing. Every real call is billed to the OpenAI account: run --dry-run first.
// Key: OPENAI_API_KEY in the environment, else in the project's .env. Model: config models.image. Needs api.openai.com.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { env, openaiHint } from './env.mjs'
import { genPath, imagePrompt, loadStyle } from './style.mjs'

const args = process.argv.slice(2)
const flag = (name, d) => {
  const i = args.indexOf(name)
  return i < 0 ? d : (args[i + 1] ?? d)
}
const W = args[0] && resolve(args[0])
if (!W || !existsSync(join(W, 'script.md'))) {
  console.error(
    'usage: gen-images.mjs <video folder with script.md> [--dry-run] [--quality high] [--force]'
  )
  process.exit(1)
}
const dry = args.includes('--dry-run')
const force = args.includes('--force')
const only = flag('--only', '')
const quality = flag('--quality', 'high')
const style = loadStyle(W)
const model = flag('--model', style.config.models.image)

// the pictures the script asks for
const jobs = []
readFileSync(join(W, 'script.md'), 'utf8')
  .split('\n')
  .forEach((raw, ln) => {
    const m = raw.trim().match(/^>\s*SLIDE\s+(\{.*\})\s*$/)
    if (!m) return
    let c
    try {
      c = JSON.parse(m[1])
    } catch {
      return
    }
    // a layered illustration: the first layer is the opaque backdrop, the rest are cut-outs on transparency
    if (c.layout === 'illustration' && Array.isArray(c.layers) && c.layers.length)
      c.layers.forEach((l, j) => {
        if (l && l.prompt && !l.src)
          jobs.push({ line: ln + 1, prompt: l.prompt, kind: j ? 'layer' : 'backdrop' })
      })
    else if (c.layout === 'illustration' && c.prompt && !c.src)
      jobs.push({ line: ln + 1, prompt: c.prompt, kind: 'illustration' })
    if (c.layout === 'scene' && c.bg && typeof c.bg === 'object' && c.bg.prompt && !c.bg.src)
      jobs.push({ line: ln + 1, prompt: c.bg.prompt, kind: 'background' })
  })
for (const j of jobs) {
  j.out = genPath(W, j.prompt, style, j.kind)
  j.full = imagePrompt(j.prompt, style, j.kind)
}
const seen = new Set()
const todo = jobs.filter((j) => {
  if (seen.has(j.out)) return false
  seen.add(j.out)
  if (only && !basename(j.out).startsWith(only)) return false
  return force || !existsSync(j.out)
})

console.log(
  `${jobs.length} picture cue${jobs.length === 1 ? '' : 's'} in script.md, ${seen.size} distinct, ${todo.length} to generate (${model}, ${quality}, 1536x864)`
)
for (const j of todo)
  console.log(`\n· script line ${j.line} (${j.kind}) → ${j.out.replace(W + '/', '')}\n${j.full}`)
if (dry || !todo.length) process.exit(0)

const key = env('OPENAI_API_KEY', W)
if (!key) {
  console.error(
    '\nNo OPENAI_API_KEY (environment or the project .env): add it, or skip generated pictures. `providers.mjs --check` tests it.'
  )
  process.exit(1)
}

mkdirSync(join(W, 'assets', 'gen'), { recursive: true })
const tmp = join(tmpdir(), `yt-gen-${process.pid}.json`)
let failed = 0
for (const j of todo) {
  writeFileSync(
    tmp,
    JSON.stringify({
      model,
      prompt: j.full,
      size: '1536x864',
      quality,
      output_format: 'png',
      background: j.kind === 'layer' ? 'transparent' : 'opaque',
      n: 1
    })
  )
  process.stdout.write(`\ngenerating line ${j.line}… `)
  let json
  try {
    const out = execFileSync(
      'curl',
      [
        '-sS',
        '--max-time',
        '300',
        'https://api.openai.com/v1/images/generations',
        '-H',
        `Authorization: Bearer ${key}`,
        '-H',
        'Content-Type: application/json',
        '-d',
        `@${tmp}`
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    )
    json = JSON.parse(out.toString('utf8'))
  } catch (e) {
    console.error('request failed: ' + (e.message || e))
    failed++
    continue
  }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    console.error(
      'no image: ' + (json.error ? openaiHint(0, json.error) : JSON.stringify(json).slice(0, 400))
    )
    failed++
    // a key, access or credit problem fails every picture the same way: stop at the first
    if (
      json.error &&
      /invalid_api_key|model_not_found|insufficient_quota|verif/i.test(JSON.stringify(json.error))
    )
      break
    continue
  }
  writeFileSync(j.out, Buffer.from(b64, 'base64'))
  console.log(j.out)
}
rmSync(tmp, { force: true })
if (failed) {
  console.error(`\n${failed} picture${failed === 1 ? '' : 's'} failed`)
  process.exit(1)
}
console.log(
  '\nRead each picture before rendering: right subject, no text, no fake screens, fits the look.'
)
