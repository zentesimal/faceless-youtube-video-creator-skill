#!/usr/bin/env node
// Generates the pictures a script asks for, with the OpenAI Image API (model: config models.image):
// every `illustration` cue with a "prompt" (or each prompt in its "layers": the first one an opaque
// backdrop, the others cut-outs on a transparent background, for the camera's parallax), and every `scene`
// cue whose "bg" is {"prompt": …}.
//
//   node gen-images.mjs <$W> [--dry-run] [--quality low|medium|high] [--jobs 4] [--force] [--only <hash>]
//                            [--full]
//
// Each picture is saved as $W/assets/gen/<hash>.png, where the hash covers the prompt and the look's image
// style (style.mjs › imageStyle), so the renderer finds it by itself and an edited prompt makes a new one.
// Existing files are skipped (--force regenerates). --dry-run lists what would be generated, with the full
// prompts (the first 3 and one line each for the rest past 20 pictures; --full prints them all), and spends nothing.
// Every real call is billed to the OpenAI account: run --dry-run first.
// --jobs = pictures generated at once (default 4): a story-teller video (style.json "mode": "storyteller", one
// picture per sentence) asks for 100–200, so they run in parallel. --quality defaults to style.json
// "imageQuality", else medium in story-teller mode (a picture is up for a few seconds) and high otherwise.
// A prompt's {Name} takes its description from style.json "characters" (storyteller.mjs); an unknown name stops.
// Key: OPENAI_API_KEY in the environment, else in the project's .env. Model: config models.image. Needs api.openai.com.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { env, openaiHint } from './env.mjs'
import { isStoryteller, unknownCharacters } from './storyteller.mjs'
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
const style = loadStyle(W)
const STORY = isStoryteller(style)
const quality = flag('--quality', style.imageQuality || (STORY ? 'medium' : 'high'))
const JOBS = Math.max(1, Math.min(8, Math.round(Number(flag('--jobs', '4'))) || 4))
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
// a {Name} the style.json "characters" don't describe would be drawn as a random stranger in every picture
const unknown = [...new Set(jobs.flatMap((j) => unknownCharacters(j.prompt, style.characters)))]
if (unknown.length) {
  console.error(
    `script.md names ${unknown.map((n) => `{${n}}`).join(', ')} but style.json "characters" doesn't describe ${unknown.length === 1 ? 'it' : 'them'}: add ${unknown.length === 1 ? 'a description' : 'descriptions'} (look, age, hair, clothes, colours) or drop the braces`
  )
  process.exit(1)
}
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
  `${jobs.length} picture cue${jobs.length === 1 ? '' : 's'} in script.md, ${seen.size} distinct, ${todo.length} to generate (${model}, ${quality}, 1536x864${todo.length > 1 ? `, ${Math.min(JOBS, todo.length)} at a time` : ''})${STORY ? ' · story teller: one picture per sentence' : ''}`
)
// many pictures (a story-teller video): the full prompt for the first few, one line for the rest
const full = args.includes('--full') || todo.length <= 20
todo.forEach((j, k) => {
  const where = `script line ${j.line} (${j.kind}) → ${j.out.replace(W + '/', '')}`
  if (full || k < 3) console.log(`\n· ${where}\n${j.full}`)
  else console.log(`· ${where}: ${j.prompt.length > 90 ? j.prompt.slice(0, 89) + '…' : j.prompt}`)
})
if (!full) console.log('\n(--full prints every full prompt)')
if (dry || !todo.length) process.exit(0)

const key = env('OPENAI_API_KEY', W)
if (!key) {
  console.error(
    '\nNo OPENAI_API_KEY (environment or the project .env): add it, or skip generated pictures. `providers.mjs --check` tests it.'
  )
  process.exit(1)
}

mkdirSync(join(W, 'assets', 'gen'), { recursive: true })
const run = promisify(execFile)
let failed = 0
let fatal = false
let done = 0
let saved = 0
// one picture: a curl call (it goes through the environment's proxy), saved as soon as it's back
const generate = async (j, k) => {
  const tmp = join(tmpdir(), `yt-gen-${process.pid}-${k}.json`)
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
  const tag = `[${++done}/${todo.length}] line ${j.line}`
  let json
  try {
    const { stdout } = await run(
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
    json = JSON.parse(stdout)
  } catch (e) {
    // curl's own message (never the command line: it carries the key)
    const why = String(e.stderr || '').trim() || (e.code ? `curl exit ${e.code}` : 'no response')
    console.error(`${tag}: request failed: ${why.split(key).join('***')}`)
    failed++
    // the network or the host is blocked: every picture would fail the same way
    if (!saved && failed >= 3) fatal = true
    return
  } finally {
    rmSync(tmp, { force: true })
  }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    console.error(
      `${tag}: no image: ` +
        (json.error ? openaiHint(0, json.error) : JSON.stringify(json).slice(0, 400))
    )
    failed++
    // a key, access or credit problem fails every picture the same way: start no more
    if (
      json.error &&
      /invalid_api_key|model_not_found|insufficient_quota|verif/i.test(JSON.stringify(json.error))
    )
      fatal = true
    return
  }
  writeFileSync(j.out, Buffer.from(b64, 'base64'))
  saved++
  console.log(`${tag} → ${j.out}`)
}
// a small pool: JOBS pictures in flight, the next one starting as soon as one is back
let next = 0
await Promise.all(
  Array.from({ length: Math.min(JOBS, todo.length) }, async () => {
    while (!fatal && next < todo.length) {
      const k = next++
      await generate(todo[k], k)
    }
  })
)
const skipped = todo.filter((j) => !existsSync(j.out)).length - failed
if (fatal && skipped > 0)
  console.error(
    `\nstopped: ${skipped} more not started (fix the problem above, then re-run: done ones are kept)`
  )
if (failed) {
  console.error(`\n${failed} picture${failed === 1 ? '' : 's'} failed`)
  process.exit(1)
}
console.log(
  STORY
    ? '\nCheck the pictures before rendering: `render-video.mjs <$W> --slides` puts every one on video/sheet.png (right subject, the same characters, no text, no fake screens, fits the look); Read the ones that look off.'
    : '\nRead each picture before rendering: right subject, no text, no fake screens, fits the look.'
)
