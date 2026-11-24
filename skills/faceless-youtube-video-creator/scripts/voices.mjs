// How fast each kind of voice reads, so every estimate (script-stats.mjs, render-video.mjs --slides, the length
// budget) follows the voice the user picked instead of assuming one. No dependencies.
//
// Words per minute at speed 1.0, as rendered (pauses inside a line capped at 0.2 s), measured on real videos:
//   kokoro      ≈ 201 (185 at the default 0.92; 2026-11 English and Spanish videos)
//   openai      ≈ 155 (gpt-4o-mini-tts, coral, Spanish: 143 at 0.92, 2026-11-17)
//   elevenlabs  ≈ 181 (measured 2026-11-23: eleven_v4, Spanish narrator, 199 wpm at speed 1.1)
// The render prints the real rate of every video ("voice: … wpm"); update a number here when it drifts.

export const RATES = { kokoro: 201, openai: 155, elevenlabs: 181 }

/** The speech model a cloud voice uses unless style.json `voiceModel` names one. ElevenLabs: eleven_v4 (Sept 2026),
 * the most expressive, reads the tones' audio tags; `"voiceModel": "eleven_multilingual_v2"` for the older, cheaper read. */
export const DEFAULT_MODEL = { elevenlabs: 'eleven_v4' }

/** Whether an ElevenLabs model reads inline audio tags (`[curious] …`): eleven_v3 and later. */
export const readsTags = (model = '') => /^eleven_v([3-9]|\d\d)/.test(model)

/** `kokoro`, `openai` or `elevenlabs`, from the voice name's prefix. */
export const providerOf = (voice = '') => (voice.includes(':') ? voice.split(':')[0] : 'kokoro')

/** The speed a voice reads at unless style.json sets one: Kokoro a little slower, cloud voices a little faster. */
export const defaultSpeed = (voice) => (providerOf(voice) === 'kokoro' ? 0.92 : 1.1)

/** Words per minute for `voice` at `speed` (default: that voice's default speed). */
export const voiceWpm = (voice = 'af_heart', speed) =>
  Math.round((RATES[providerOf(voice)] || RATES.kokoro) * (speed ?? defaultSpeed(voice)))
