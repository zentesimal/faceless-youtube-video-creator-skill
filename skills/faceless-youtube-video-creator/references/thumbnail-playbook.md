# Thumbnail playbook (two variants for A/B testing)

Every video ships with **two thumbnails, A and B**, for YouTube Studio's _Test & compare_ (it splits impressions between up to three thumbnails and picks the one with the most watch time). Rendered locally by `scripts/render-thumbnails.mjs` from `thumbs/spec.json`.

## What makes the two variants a real test

A and B must test **one hypothesis**, not two colour schemes. Write it in the spec's `hypothesis` field as "A bets on X, B bets on Y". Pairs that work for this channel:

| A                                                   | B                                                               | Question it answers                       |
| --------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| `bold`: the claim in 2–4 huge words + face or ghost | `chat`: the actual prompt/answer that fails or works            | Does the promise or the proof get clicks? |
| `bold` with a face showing a reaction               | `bold`, same words, no face (mascot instead)                    | Does the presenter's face help?           |
| `versus`: before ✕ / after ✓                        | `bold`: only the outcome                                        | Contrast or curiosity?                    |
| `bold` with a positive frame ("10× better prompts") | `bold` with a negative frame ("Stop writing prompts like this") | Gain or loss framing?                     |
| `question`: "AI MADE THIS?" over the scene          | `mood`: "NO MEMORY?", the problem, over a darker scene          | The result or the problem?                |
| `card`: the viewer's question ("What's a …?")       | `title`: a statement ("ONE TEXT FILE" + tag)                    | Question or answer?                       |

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
  "channel": "My Channel",
  "hypothesis": "A bets on the claim, B bets on showing the failure",
  "variants": {
    "A": {
      "layout": "bold",
      "text": "IT CAN'T\nCOUNT",
      "highlight": "COUNT",
      "sticker": "4 fixes",
      "mascot": "shrug",
      "theme": "dark"
    },
    "B": {
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

| Field            | Layouts        | Notes                                                                                                                                                                           |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------- |
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
