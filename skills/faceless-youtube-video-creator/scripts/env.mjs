// The skill's environment: every variable a script reads (API keys, CHROMIUM_PATH, …) comes through env(name),
// always in the same order, so a value is found the same way by every script:
//
//   1. the real environment (set in the shell, CI or the agent's settings): it always wins
//   2. <project>/.env, where <project> is the folder holding faceless-youtube.config.json (found by walking up
//      from the video folder, then from the cwd), else the cwd
//
// .env syntax: one NAME=value per line; `export NAME=value` works; blank lines and lines starting with # are
// skipped; a value may be wrapped in "double" or 'single' quotes ("…" understands \n); an unquoted value ends at
// " #" (a comment). If a name appears twice, the last one wins. Nothing here prints a value.
//
// A new service needs no code here: its script calls env('NEW_SERVICE_KEY'), and the variable goes in .env and in
// ../references/env.example (the documented list). No dependencies.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const CONFIG_FILE = 'faceless-youtube.config.json'

/** The variables the skill reads, with what each unlocks (documented in ../references/env.example). */
export const KNOWN = {
  OPENAI_API_KEY: 'OpenAI voices (openai:<voice>) and generated illustrations',
  ELEVENLABS_API_KEY:
    'ElevenLabs voices from your library (elevenlabs:<voice id>, model eleven_v4) that act the script tones',
  CHROMIUM_PATH: 'a Chrome or Chromium to render with, when Playwright finds none'
}

/** Parses .env text into {NAME: value}. */
export function parseEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2]
    const q = v[0]
    if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) {
      v = v.slice(1, v.indexOf(q, 1))
      if (q === '"') v = v.replace(/\\n/g, '\n').replace(/\\"/g, '"')
    } else v = v.replace(/\s+#.*$/, '').trim()
    out[m[1]] = v
  }
  return out
}

/** The project folder: the one holding faceless-youtube.config.json above `start` (or the cwd), else the cwd. */
export function projectDir(start) {
  for (const from of [start, process.cwd()].filter(Boolean)) {
    let d = resolve(from)
    for (;;) {
      if (existsSync(join(d, CONFIG_FILE))) return d
      const up = dirname(d)
      if (up === d) break
      d = up
    }
  }
  return process.cwd()
}

const cache = new Map()
/** {path, vars} of the project's .env (vars empty when there is no file). */
export function envFile(start) {
  const path = join(projectDir(start), '.env')
  if (!cache.has(path))
    cache.set(path, existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {})
  return { path, vars: cache.get(path) }
}

/** The value of `name`: the environment first, then the project's .env; undefined when neither has it. */
export function env(name, start) {
  if (process.env[name]) return process.env[name]
  const v = envFile(start).vars[name]
  return v ? v : undefined
}

/** Where `name` comes from: 'environment', the .env path, or null. */
export function envSource(name, start) {
  if (process.env[name]) return 'environment'
  const f = envFile(start)
  return f.vars[name] ? f.path : null
}

/** What an OpenAI error status means for the user, and what to do about it. */
export function openaiHint(status, err = {}) {
  const text = `${err.code || ''} ${err.type || ''} ${err.message || ''}`
  // without a status (e.g. an error body read from curl), infer it from the error code
  if (!status)
    status = /invalid_api_key|incorrect api key/i.test(text)
      ? 401
      : /model_not_found|does not exist/i.test(text)
        ? 404
        : /insufficient_quota|billing/i.test(text)
          ? 429
          : /verif/i.test(text)
            ? 403
            : 0
  if (status === 401)
    return 'the key was rejected (wrong, revoked or from another organisation): create a new one at platform.openai.com/api-keys and replace OPENAI_API_KEY'
  if (status === 403)
    return /verif/i.test(text)
      ? 'the organisation must be verified to use this model: OpenAI dashboard › Settings › Organization › General › Verify'
      : "this key's project isn't allowed to use the model: check the project's model permissions in the OpenAI dashboard (image models may also need a verified organisation)"
  if (status === 404)
    return 'the model isn\'t available to this key: the name may be wrong or retired, or the account has no access yet; fix the name in the config\'s "models", or pick the free option'
  if (status === 429)
    return /quota|billing/i.test(text)
      ? 'the account has no credit left: add credit in the OpenAI dashboard › Settings › Billing'
      : 'rate-limited: wait a minute and try again'
  if (status >= 500) return 'OpenAI is having trouble right now: try again in a few minutes'
  return err.message || (status ? `HTTP ${status}` : 'unknown error')
}
