// Direct-claim check for thumbnail and cover headlines (thumbnail playbook › Say the claim). Used by
// render-thumbnails.mjs before it renders each variant. No dependencies.
//
// A thumbnail headline should state the video's claim, flat and specific ("IT CAN'T COUNT", "3 PROMPTS = 2× ANSWERS",
// "CHATGPT FORGETS AT 20 MESSAGES"), not label the topic ("HOW LLMS WORK"), tease it ("THIS CHANGES EVERYTHING")
// or ask it ("NO MEMORY?"). Every variant also carries a `claim`: the one sentence its headline asserts, in full,
// and where the video proves it, so the headline can be blunt without over-promising.

// a headline that opens like a topic label or a question, not a statement (English and Spanish)
const LABEL = /^(how|why|what|which|when|is|are|can|does|do|the truth|everything|all about|guide|tutorial|intro|c[oó]mo|por qu[eé]|qu[eé]|cu[aá]l|cu[aá]ndo|todo sobre|gu[ií]a|la verdad)(?![\w'’])/i
// hype that claims nothing: the viewer can't tell what the video proves
const VAGUE =
  /\b(this|these|that|everything|game[- ]?changer|insane|crazy|secret|secrets|shocking|unbelievable|mind[- ]?blowing|you won'?t believe|must[- ]?know|watch|wow|esto|esta|estos|todo|incre[ií]ble|brutal|secreto|secretos|alucinante|impactante|nadie te cuenta)\b/i
// something a viewer can check: a number, a comparison, a negation, a named result
const SPECIFIC = /[\d×%=→<>]|\b(no|not|never|can'?t|won'?t|don'?t|doesn'?t|isn'?t|stop|beats?|vs|nunca|deja|gana|sin)\b/i

/**
 * Warnings for one variant's headline (`v.text`) and its `claim`. `angle` softens the question rule: a `curiosity`
 * variant may ask, but only a question the claim answers. Returns an array of strings (empty = a direct claim).
 */
export function claimWarnings(v = {}) {
  const text = String(v.text || '')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  const out = []
  if (!text) return out
  if (!v.claim)
    out.push(
      'no "claim": write the one sentence this headline asserts and where the video proves it ("ChatGPT miscounts letters because it reads tokens; shown in IDEA 1")'
    )
  const question = /[?¿]/.test(text)
  if (question && v.angle !== 'curiosity')
    out.push(
      `"${text}" is a question: state the answer instead ("NO MEMORY?" → "IT FORGETS YOU"); only a curiosity variant asks`
    )
  else if (question && !v.claim)
    out.push('a curiosity question needs the "claim" it opens, so the video can close it')
  if (LABEL.test(text) && !question)
    out.push(
      `"${text}" reads as a topic label: say what is true about it ("HOW LLMS WORK" → "IT ONLY PREDICTS WORDS")`
    )
  const vague = text.match(VAGUE)
  if (vague)
    out.push(
      `"${vague[0]}" is hype, not a claim: name the result, the number or the mistake it stands for`
    )
  if (!question && !vague && v.angle !== 'proof' && !SPECIFIC.test(text) && text.split(/\s+/).length <= 2)
    out.push(
      `"${text}" names a thing without saying anything about it: add the verb, the number or the result (playbook › Say the claim)`
    )
  return out
}
