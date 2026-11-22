// Delivery tones for the voiceover: how a line marked `> TONE <name>` in script.md is spoken. Shared by
// render-video.mjs (what the voice does) and script-stats.mjs (the estimate and the emotion checks). No dependencies.
//
// Every voice gets the timing part: a pause before the line (the held breath before a reveal), a speed change
// (slower for suspense, quicker for excitement) and how long the pauses inside it may stay (an ellipsis in a
// suspense line keeps its silence). Kokoro, the free voice, can't act, so for it the timing and the words carry
// the emotion. Paid voices act it too: OpenAI gets `instructions` for the line (gpt-4o-mini-tts follows them),
// ElevenLabs gets more expressive voice settings and, on eleven_v3 and eleven_v4 (the default), an audio tag in front
// of the line (v4's tags are free text: any short delivery direction in brackets works).
//
// `expressive` in style.json scales the timing (0 = tones off, 1 = default, 1.5 = more dramatic).

export const TONES = {
  intrigue: {
    use: 'a question or a mystery the viewer wants answered (the hook, a bridge, the mid hook)',
    speed: 0.95,
    before: 0.25,
    maxPause: 0.3,
    say: 'Curious and intriguing, leaning in as if sharing a puzzle; a slight lift at the end of the line.',
    tag: '[curious]'
  },
  suspense: {
    use: 'the build-up right before a reveal; "and that is not even the strange part"',
    speed: 0.88,
    before: 0.35,
    maxPause: 0.5,
    say: 'Build suspense: slower, a little lower and quieter, with small deliberate pauses, as if about to reveal a secret.',
    tag: '[suspenseful]'
  },
  surprise: {
    use: 'the reveal itself: the wow line, the surprising number, the twist',
    speed: 1.0,
    before: 0.45,
    maxPause: 0.2,
    say: 'Genuine surprise, as if you can hardly believe it yourself: brighter, more energy, land the key word.',
    tag: '[surprised]'
  },
  excited: {
    use: 'a payoff that works, a win the viewer gets today',
    speed: 1.06,
    before: 0.1,
    maxPause: 0.15,
    say: 'Excited and energetic, a smile in the voice, quicker pace.',
    tag: '[excited]'
  },
  serious: {
    use: 'the catch, a warning, a cost, a mistake people make',
    speed: 0.93,
    before: 0.3,
    maxPause: 0.3,
    say: 'Serious and grounded: slower, steady, lower, no smile; this matters.',
    tag: '[seriously]'
  },
  warm: {
    use: 'reassurance, the channel reminder, the subscribe ask, the goodbye',
    speed: 0.97,
    before: 0.15,
    maxPause: 0.25,
    say: 'Warm and friendly, like talking to a friend, relaxed and sincere.',
    tag: '[warmly]'
  },
  playful: {
    use: 'a light joke, an absurd example, a wink',
    speed: 1.03,
    before: 0.15,
    maxPause: 0.2,
    say: 'Playful and amused, a hint of a laugh in the voice.',
    tag: '[playfully]'
  }
}

export const TONE_NAMES = Object.keys(TONES)

/** The default way a cloud voice that follows instructions (OpenAI) narrates, when style.json sets none. */
export const NARRATOR = {
  en: 'Engaging YouTube narrator: natural and conversational, varied pace and pitch, curious and warm; never flat or monotone, never over the top.',
  es: 'Narrador de YouTube cercano y natural, en español neutro: ritmo y entonación variados, curioso y cálido; nunca plano ni monótono, nunca exagerado.'
}

/** Parses a `> TONE <name>` cue; returns the name, '' for a cue with an unknown name, or null for another cue. */
export function parseTone(cue) {
  const m = cue.match(/^>?\s*TONE\b\s*:?\s*([\w-]*)\s*$/i)
  if (!m) return null
  const name = m[1].toLowerCase()
  return TONES[name] ? name : ''
}

/**
 * How one line in `tone` is spoken: `{speedFactor, before, maxPause, instructions, tag, settings}`.
 * `scale` = style.json `expressive` (0 turns the delivery off: plain timing, no acting).
 */
export function delivery(tone, { scale = 1, maxPause = 0.2 } = {}) {
  const t = TONES[tone]
  if (!t || scale <= 0) return null
  return {
    speedFactor: 1 + (t.speed - 1) * scale,
    before: Math.round(t.before * scale * 100) / 100,
    maxPause: Math.max(maxPause, maxPause + (t.maxPause - 0.2) * scale),
    instructions: t.say,
    tag: t.tag,
    // ElevenLabs: lower stability = more expressive; style exaggerates the voice's own delivery
    settings: { stability: 0.3, similarity_boost: 0.75, style: Math.min(1, 0.45 * scale) }
  }
}
