#!/usr/bin/env node
// Which paid options this project can use, for the "free or OpenAI" setup question (SKILL.md §1b). Keys are read
// the way every script reads them (env.mjs: the environment, then the project's .env); values are never printed.
//
//   node providers.mjs [<video folder>]             # which keys are set, and where from
//   node providers.mjs --check [<video folder>]     # also asks each provider whether the key works and can use
//                                                   # the models the skill calls (free: no credits spent)
//   node providers.mjs --check --live               # plus one tiny speech request (a fraction of a cent), the
//                                                   # only way to know the account has credit before a render
//   --json                                          # the same as JSON
//
// Models checked: OpenAI speech = the config's models.speech (default gpt-4o-mini-tts) and image = models.image.
// Exit code 2 = a key is set but a check failed (the output says what to fix); 0 otherwise.
import { KNOWN, env, envFile, envSource, openaiHint } from './env.mjs'
import { loadConfig } from './style.mjs'

const args = process.argv.slice(2)
const start = args.find((a) => !a.startsWith('--'))
const CHECK = args.includes('--check') || args.includes('--live')
const LIVE = args.includes('--live')
const JSON_OUT = args.includes('--json')
const config = loadConfig(start)
const MODELS = {
  speech: config.models.speech,
  image: config.models.image
}

async function once(url, init) {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
    let body = {}
    try {
      body = await r.json()
    } catch {}
    return { status: r.status, ok: r.ok, body, err: body?.error || body?.detail || {} }
  } catch (e) {
    return { status: 0, ok: false, body: {}, err: { message: e.cause?.code || e.message } }
  }
}
/** One request, retried once after 2 s on a server error or a network blip (a one-off 5xx isn't a verdict). */
async function call(url, init = {}) {
  const r = await once(url, init)
  if (r.ok || (r.status && r.status < 500)) return r
  await new Promise((res) => setTimeout(res, 2000))
  return once(url, init)
}
/** A warning when the provider has scheduled the model's retirement within 60 days (or it has passed). */
function retiring(body) {
  const d = body?.shutdown_date
  if (!d) return ''
  const days = Math.round((Date.parse(d) - Date.now()) / 86400000)
  if (days > 60) return ''
  return days < 0
    ? `scheduled for retirement on ${d} (already passed): switch to a newer model in the config's "models"`
    : `retires on ${d} (in ${days} days): plan a switch in the config's "models"`
}
const unreachable = (host) =>
  `can't reach ${host} (offline, or blocked by a firewall or proxy): allow it, or pick the free option`

async function checkOpenAI(key) {
  const auth = { Authorization: `Bearer ${key}` }
  const out = {}
  for (const [use, model] of Object.entries(MODELS)) {
    const r = await call(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: auth
    })
    out[model] = {
      use: use === 'speech' ? 'OpenAI voices' : 'generated illustrations',
      ok: r.ok,
      status: r.status,
      hint: r.ok ? '' : r.status ? openaiHint(r.status, r.err) : unreachable('api.openai.com'),
      warning: r.ok ? retiring(r.body) : ''
    }
  }
  if (LIVE && out[MODELS.speech].ok) {
    const r = await call('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELS.speech,
        voice: 'coral',
        input: 'Test.',
        response_format: 'mp3'
      })
    })
    out['speech request'] = {
      use: 'one real request (credit and billing)',
      ok: r.ok,
      status: r.status,
      hint: r.ok ? '' : r.status ? openaiHint(r.status, r.err) : unreachable('api.openai.com')
    }
  }
  return out
}

async function checkElevenLabs(key) {
  const r = await call('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } })
  const hint = r.ok
    ? ''
    : r.status === 401
      ? 'the key was rejected: create a new one in ElevenLabs › Profile › API keys and replace ELEVENLABS_API_KEY'
      : r.status
        ? r.err?.message || `HTTP ${r.status}`
        : unreachable('api.elevenlabs.io')
  return { account: { use: 'ElevenLabs voices', ok: r.ok, status: r.status, hint } }
}

const PROVIDERS = {
  openai: { key: 'OPENAI_API_KEY', check: checkOpenAI },
  elevenlabs: { key: 'ELEVENLABS_API_KEY', check: checkElevenLabs }
}
const report = {
  envFile: envFile(start).path,
  envFileExists: Object.keys(envFile(start).vars).length > 0
}
let failed = false
for (const [p, { key, check }] of Object.entries(PROVIDERS)) {
  const value = env(key, start)
  const r = { variable: key, found: !!value, source: envSource(key, start), unlocks: KNOWN[key] }
  if (value && CHECK) {
    r.checks = await check(value)
    if (Object.values(r.checks).some((c) => !c.ok)) failed = true
  }
  report[p] = r
}

if (JSON_OUT) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`.env: ${report.envFile}${report.envFileExists ? '' : ' (not found or empty)'}`)
  for (const p of Object.keys(PROVIDERS)) {
    const r = report[p]
    console.log(
      `${p}: ${r.found ? `key found (${r.variable}, from ${r.source})` : `no key (${r.variable})`} → ${r.unlocks}`
    )
    for (const [name, c] of Object.entries(r.checks || {}))
      console.log(
        `  ${c.ok ? '✓' : '✗'} ${name} (${c.use})${c.ok ? (c.warning ? `: ${c.warning}` : '') : `: ${c.hint}`}`
      )
  }
  if (CHECK && !LIVE && report.openai.found && !failed)
    console.log(
      'The key can use the models. Credit is only confirmed by a real request: run with --live, or the first voice sample does it.'
    )
}
process.exit(failed ? 2 : 0)
