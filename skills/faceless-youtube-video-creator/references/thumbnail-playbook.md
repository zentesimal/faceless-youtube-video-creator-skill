# Thumbnail playbook (two variants for A/B testing)

Every video ships with **two thumbnails, A and B**, for YouTube Studio's _Test & compare_ (it splits impressions between up to three thumbnails and picks the one with the most watch time). Rendered locally by `scripts/render-thumbnails.mjs` from `thumbs/spec.json`.

## Review rounds (polishing with the user)

The user sees A and B before delivery and approves each one or gives feedback on it (SKILL.md › §7 › Review with the user). To turn feedback into spec edits:

| They say…                    | Try                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| "doesn't pop" / "too flat"   | `light` theme against the dark feed, highlight on a shorter word, a bigger character (fewer props)  |
| "too busy" / "too much"      | drop the `sticker`, cut props or cast to one, fewer headline words                                  |
| "I don't get it" / "unclear" | name the thing plainly (`explain` angle), or a picture that shows the topic literally               |
| "boring" / "generic"         | a sharper angle (`fear`, `contrarian`, `curiosity`) or the `proof` layout with the real artifact    |
| "too clickbait"              | `explain` or `proof`; the headline only promises what the video delivers                            |
| "the words are wrong"        | redraft 3 headlines from the same angle, pick the strongest; keep the highlight on the tension word |

- Change one thing per variant per round when you can, so it's clear what made it better.
- Leave an approved variant as it is. Change only the one under review, so A and B still test one hypothesis.
- Every round is kept in `thumbs/rounds/r<n>/`. Every round's feedback goes in `thumbs/feedback.md`. Read past videos' logs before a new spec.

## Pick the angles first (wording + image strategy)

Before choosing layouts, decide **why** someone would click. Each variant takes **one angle** from the list below, and A and B take **different angles**: that's the hypothesis. The angle sets both the words and the picture, so they say the same thing.

| `angle`      | The viewer thinks…                   | Wording formula                                                                  | Image                                                                                     | Layouts that fit             |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| `explain`    | "That's exactly what I want to know" | Name the thing plainly: the topic or the outcome in 2–4 words ("HOW LLMS THINK") | The object itself, clear and calm: the diagram, the tool, the screen; neutral face/mascot | `title`, `card`, `bold`      |
| `desire`     | "I want that result"                 | The positive outcome, concrete and soon ("10× BETTER ANSWERS", "WRITES FOR YOU") | The after state: a happy/relieved character, a ✓, bright `light` theme, warm scene        | `bold`, `versus` (after big) |
| `fear`       | "Am I making this mistake?"          | The loss or mistake to avoid ("STOP DOING THIS", "IT LIED TO YOU")               | The problem: a ✕, a wrong answer, a shocked character, darker `dark`/`mood` scene         | `mood`, `chat`, `bold`       |
| `curiosity`  | "Wait, why?"                         | An open loop that the title doesn't close ("NO MEMORY?", "WHY 2 R'S?")           | One odd detail that doesn't fit: a puzzled character, a strange object, lots of space     | `question`, `mood`, `card`   |
| `proof`      | "I can see it working (or failing)"  | Let the image talk; the words only frame it ("IT FAILED", "TESTED")              | The real artifact from the video: the chat, the before/after, the number on screen        | `chat`, `versus`             |
| `contrarian` | "That's not what I thought"          | Flip a common belief ("PROMPTS DON'T MATTER", "AI CAN'T READ")                   | Something crossed out or upside down; a confident character against the crowd             | `bold`, `question`           |
| `identity`   | "This is for people like me"         | Name the viewer or their situation ("FOR NON-CODERS", "SUPPORT TEAMS")           | Someone who looks like the viewer at their desk, or their tool/workplace                  | `card`, `bold`, `title`      |
| `news`       | "I need to know this now"            | What changed, plus when ("NEW IN 2026", "IT CHANGED")                            | The new thing, big, with a date/`sticker`; energetic scene                                | `bold`, `title`              |

How to use it:

- **Read the promise in `brief.md`** and write one headline per angle (8 lines, a minute's work), in the video's language and at the viewer level. Pick the two strongest, from **different** rows. Good default pairs: `explain` vs `desire` (clarity or payoff?), `desire` vs `fear` (gain or loss?), `curiosity` vs `proof` (question or evidence?). For low viewer levels (0–2) keep one variant `explain` unless the title already explains it; beginners click what they understand.
- **Words and image must pull the same way.** A `fear` headline over a smiling, bright scene sends mixed signals; a `desire` headline over a ✕ does too. The character's pose follows the angle (`desire` → `cheer` or `wave`, `fear` → `shock` or `sad`, `curiosity` → `think` or `shrug`, `explain` → `neutral` or `point`; the `mascot` field has `neutral` · `shrug` · `shock` · `wave`, a `scene` cast has all nine poses).
- **Don't over-promise.** `desire` and `fear` must be paid off in the video (the script delivers that outcome or names that mistake); `news` must be actually new; `proof` shows what really happens on screen.
- **Same title, different angle.** The title stays fixed in the test, so the thumbnail angle shouldn't repeat it: if the title is `explain`, an `explain` thumbnail wastes the space; prefer `desire`, `fear` or `curiosity` against it.
- Write the angle in each variant (`"angle": "fear"`, ignored by the renderer) and in the `hypothesis`: "A bets on desire (the better result), B bets on fear (the mistake to avoid)". When Test & compare picks a winner, record it with its angle in the topic sheet's `thumbnail_winner` (`A (desire)`), so the channel learns which angles work for its audience and starts the next test from the winner.
- A third variant (`"C"`) is a good place to try an angle the channel hasn't tested yet.

## What makes the two variants a real test

A and B must test **one hypothesis**, not two colour schemes. Write it in the spec's `hypothesis` field as "A bets on X, B bets on Y". The default test is **two angles** (above). Once the channel knows its winning angle, keep it on both and test the format instead:

| A                                                   | B                                                      | Question it answers                       |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `bold`: the claim in 2–4 huge words + face or ghost | `chat`: the actual prompt/answer that fails or works   | Does the promise or the proof get clicks? |
| `bold` with a face showing a reaction               | `bold`, same words, no face (mascot instead)           | Does the presenter's face help?           |
| `versus`: before ✕ / after ✓                        | `bold`: only the outcome                               | Contrast or curiosity?                    |
| `question`: "AI MADE THIS?" over the scene          | `mood`: "NO MEMORY?", the problem, over a darker scene | The result or the problem?                |
| `card`: the viewer's question ("What's a …?")       | `title`: a statement ("ONE TEXT FILE" + tag)           | Question or answer?                       |

Keep everything else equal when you can (theme, sticker, logo), so the result means something.

## Feed layouts (styles common on the home page)

Four layouts copy how popular explainer thumbnails are built, drawn over a full-bleed picture: a `scene` (the same backgrounds, characters and props as the scene slides, in the video's look) or the `photo`. They borrow a structure, never a channel's logo, art or face.

| `layout`   | Looks like                                                                             | Text                                                          |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `question` | one huge outlined question across the top, the picture under it (geography explainers) | ≤ 3 words, Anton; `highlight` turns the word yellow           |
| `title`    | a documentary title: stacked condensed words on the left, a small `tag` under them     | 2–3 words, one per line (`\n`), Oswald; `tag` ≤ 24 chars      |
| `mood`     | one short condensed question top-left over a moody picture (animated short films)      | ≤ 3 words, Oswald                                             |
| `card`     | a white question card next to the character (talking-head explainers)                  | a question in ≤ 5 words, `\n` per line; `highlight` = a block |

A lone character in the scene is drawn larger than on a slide (it's the subject). Without a `scene`, `question`, `title` and `mood` fall back to the robot (paint look) or the mascot at night, and `card` puts the photo, doodle or mascot on the right. The logo moves to a free corner. Anton and Oswald are bundled in `assets/fonts/` (SIL OFL 1.1).

```json
{
  "layout": "mood",
  "text": "No memory?",
  "highlight": "memory",
  "scene": { "bg": "space", "cast": ["robot:shrug"] }
}
```

## Rules (both variants)

- **Readable at 168×94** (the sidebar size). The renderer's `compare.png` shows both at 640, 360 and 168 px wide: read it and drop anything you can't read at the smallest.
- **≤ 4 words of headline** (5 hard max). The thumbnail doesn't repeat the title; it adds to it. Title "I tested 5 ways to stop ChatGPT making things up" → thumbnail "IT LIED. TWICE."
- One focal point. One highlight (amber block) on the word that carries the tension.
- High contrast: `dark` theme (navy) by default; `light` (lilac) for a variant that should stand out on a dark feed.
- **Keep the bottom-right corner empty**: YouTube puts the video length there. The renderer warns if text lands in it.
- Brand is light-touch: the logo tile sits in the top-left corner (`logo: false` to hide it). No URL on the thumbnail.
- Faces: a real photo of the presenter outperforms a drawing, but there's none until the user sends one. Use a background-removed PNG cutout (`photo`). Without it, the ghost mascot stands in (`mascot`), and say so when delivering.
- Nothing misleading: the chat bubbles in a `chat` thumbnail show text that happens in the video.
- No other company's logo or a real person's face other than the presenter.

## Spec

`thumbs/spec.json`:

```json
{
  "title": "Why ChatGPT can't count letters (and 4 fixes)",
  "hypothesis": "A bets on curiosity (an odd claim), B bets on proof (showing the failure)",
  "variants": {
    "A": {
      "angle": "curiosity",
      "layout": "bold",
      "text": "IT CAN'T\nCOUNT",
      "highlight": "COUNT",
      "sticker": "4 fixes",
      "mascot": "shrug",
      "theme": "dark"
    },
    "B": {
      "angle": "proof",
      "layout": "chat",
      "text": "WHY?",
      "chat": [
        { "role": "user", "text": "How many r's in strawberry?" },
        { "role": "ai", "text": "There are 2 r's.", "mark": "wrong" }
      ],
      "theme": "dark"
    }
  }
}
```

The compare sheet puts the channel's name under the title, as YouTube does: always the configured channel for the video's language (the config and `channel.md`), never one typed into the spec (a `"channel"` field is ignored with a warning).

| Field            | Layouts        | Notes                                                                                                                                                                           |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------- |
| `angle`          | all            | the messaging angle (`explain` · `desire` · `fear` · `curiosity` · `proof` · `contrarian` · `identity` · `news`); a note for the test, the renderer ignores it                  |
| `layout`         | all            | `bold` · `versus` · `chat` · `question` · `title` · `mood` · `card` (Feed layouts above)                                                                                        |
| `text`           | all            | the headline; `\n` picks the break. Auto-sized from 168 px down to 84 px, then it's an overflow                                                                                 |
| `highlight`      | all            | exact substring of `text` that gets the amber block                                                                                                                             |
| `sticker`        | all            | small rotated amber tag, ≤ 14 chars ("4 fixes", "TESTED", "2026")                                                                                                               |
| `theme`          | all            | `dark` (default) or `light`                                                                                                                                                     |
| `logo`           | all            | `false` hides the corner logo                                                                                                                                                   |
| `photo`          | `bold`, feed   | path (relative to the spec) to the presenter cutout PNG; takes the right side                                                                                                   |
| `mascot`         | `bold`, `chat` | `neutral` · `shrug` · `shock` · `wave` · `none` (default `neutral` when there's no photo)                                                                                       |
| `doodle`         | `bold`, `chat` | a Paint doodle instead of the ghost (any name from `assets/doodles.js`, e.g. `camera`, `button`); the paint look turns on by itself when the video's style has `texture: paint` |
| `scene`          | feed layouts   | `{ "bg": "night", "cast": ["robot:think"], "props": ["laptop"] }`, as on a `scene` slide (video playbook): backgrounds, `ghost` / `person` / `robot` in 9 poses, props          |
| `tag`            | `title`        | the small line under the title, ≤ 24 chars                                                                                                                                      |
| `left` / `right` | `versus`       | `{ "label": "Before", "lines": ["…"], "mark": "wrong" }` / same with `"right"`; ≤ 3 short lines                                                                                 |
| `chat`           | `chat`         | 1–3 bubbles `{ "role": "user"                                                                                                                                                   | "ai", "text": "…", "mark": "wrong" | "right"? }`, ≤ 70 chars each |

Exit code 2 = something overflows or the headline is over 5 words: shorten and re-run. Don't force a smaller font.
