// Story teller mode ($W/style.json "mode": "storyteller"): one generated illustration per sentence.
// Shared by script-stats.mjs, render-video.mjs, gen-images.mjs and style.mjs; no dependencies.
//
// The script gives every sentence its own spoken line and its own `> SLIDE {"layout":"illustration",…}` cue, so
// the picture changes as the voice moves on (spec: ../references/video-playbook.md › Story teller mode).
// Recurring people, animals, places or objects are described once in style.json "characters"
// ({"Maya": "a woman in her 30s with short red hair and a green denim jacket"}) and named in a prompt as {Maya}:
// the description goes into every picture that names them, so they look the same from one picture to the next.

export const isStoryteller = (style) => String(style?.mode || '').toLowerCase() === 'storyteller'

// longest a sentence's picture should stay up (s): a sentence that runs longer is too long for the ear too
export const STORY_MAX = 12
// crossfade between two pictures (s), at any pace
export const STORY_FADE = 0.3
// with animations on and camera "auto", the pictures take these moves in turn, so cuts don't feel repeated
export const STORY_MOVES = ['push', 'pan-right', 'drift', 'pan-left', 'pull', 'rise']
// layouts that never need a picture: the subscribe click and the end screen
export const STORY_EXEMPT = ['subscribe', 'end']

// words before a full stop that don't end a sentence (English and Spanish); "U.S." and "e.g." (an inner dot) and
// single initials ("J. Smith") are caught by shape
const ABBR = new Set(
  'mr mrs ms dr prof sr jr st vs etc approx no fig vol sra srta ud uds aprox núm pág dra lic ing'.split(
    ' '
  )
)
const END = /[.!?…]+["'”’»)\]]*(?=\s+["'“‘«(¿¡]?[\p{Lu}\p{N}])/gu

/** The sentences in a spoken line (a full stop, ? ! or … followed by a capital starts a new one). */
export function sentences(text) {
  const t = String(text || '').trim()
  if (!t) return []
  const out = []
  let start = 0
  for (const m of t.matchAll(END)) {
    const word = (t.slice(start, m.index).match(/([\p{L}.]+)$/u)?.[1] || '').toLowerCase()
    if (/^\.+$/.test(m[0]) && (ABBR.has(word) || word.includes('.') || /^\p{L}$/u.test(word)))
      continue
    const end = m.index + m[0].length
    out.push(t.slice(start, end).trim())
    start = end
  }
  const rest = t.slice(start).trim()
  if (rest) out.push(rest)
  return out
}

// {Name} in a prompt: a recurring character, place or object from style.json "characters"
const REF = /\{([\p{L}][\p{L}\p{N} _'’-]{0,40})\}/gu
const find = (characters, name) => {
  if (!characters || typeof characters !== 'object') return null
  const k = Object.keys(characters).find((c) => c.toLowerCase() === name.trim().toLowerCase())
  return k ? { name: k, desc: String(characters[k]) } : null
}
/** Names a prompt refers to as {Name}. */
export const characterRefs = (prompt) =>
  [...String(prompt || '').matchAll(REF)].map((m) => m[1].trim())
/** Names a prompt refers to that style.json "characters" doesn't describe. */
export const unknownCharacters = (prompt, characters) =>
  characterRefs(prompt).filter((n) => !find(characters, n))
/** The prompt with each {Name} replaced by "Name (description)", and whether any was replaced. */
export function expandCharacters(prompt, characters) {
  let used = false
  const text = String(prompt || '').replace(REF, (all, name) => {
    const c = find(characters, name)
    if (!c) return all
    used = true
    return `${c.name} (${c.desc.trim()})`
  })
  return { text, used }
}
export const CONTINUITY =
  'Recurring characters: draw each named one exactly as described, with the same face, hair, clothes, colours and proportions as in every other picture of this story.'

/** Every picture prompt in one slide cue (illustration, its layers, a scene's generated background). */
export function cuePrompts(c) {
  const out = []
  if (!c || typeof c !== 'object') return out
  if (c.layout === 'illustration' && Array.isArray(c.layers))
    c.layers.forEach((l) => l?.prompt && !l.src && out.push(l.prompt))
  else if (c.layout === 'illustration' && c.prompt && !c.src) out.push(c.prompt)
  if (c.layout === 'scene' && c.bg && typeof c.bg === 'object' && c.bg.prompt && !c.bg.src)
    out.push(c.bg.prompt)
  return out
}

/**
 * The story-teller checks on slides built from the script ({layout, say: [lines], line}): one spoken line per
 * picture, one sentence per line, and (as a warning) most spoken slides are illustrations.
 * Returns { problems: [], warnings: [] }.
 */
export function storyChecks(slides, sayText = (l) => l) {
  const problems = []
  const warnings = []
  const spoken = []
  for (const s of slides) {
    if (STORY_EXEMPT.includes(s.layout)) continue
    if (!s.say.length) continue
    spoken.push(s)
    if (s.say.length > 1) {
      problems.push(
        `line ${s.line}: story teller gives every sentence its own picture, but this ${s.layout || '?'} slide has ${s.say.length} spoken lines: give each line its own SLIDE cue`
      )
      continue
    }
    const n = sentences(sayText(s.say[0]))
    if (n.length > 1)
      problems.push(
        `line ${s.line}: story teller: ${n.length} sentences under one picture ("${n[0].slice(0, 50)}${n[0].length > 50 ? '…' : ''}" …): put each sentence on its own line, under its own illustration cue`
      )
  }
  const other = spoken.filter((s) => s.layout !== 'illustration')
  if (spoken.length && other.length / spoken.length > 0.2) {
    const kinds = [...new Set(other.map((s) => s.layout || '?'))].join(', ')
    warnings.push(
      `story teller: ${other.length} of ${spoken.length} sentences are not on an illustration (${kinds}); keep other layouts for real proof (doc, table, chat, number) and let the pictures tell the rest`
    )
  }
  return { problems, warnings, sentences: spoken.length }
}
