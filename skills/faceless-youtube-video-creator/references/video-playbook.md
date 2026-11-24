# Video playbook: slides + AI voiceover

The default format for the channel: a sequence of 1920×1080 slides that show the script's key line, and an AI voice reading the script. `scripts/render-video.mjs` builds it locally from `script.md`: Kokoro voice (`scripts/tts.py`), Playwright for the slides, ffmpeg for the MP4 (with slow push-ins and crossfades from pace 3). No footage, no presenter, no upload. The look, pace and voice come from `$W/style.json` (SKILL.md §1b).

A **Short** (SKILL.md §9) uses the same cues, rendered at 1080×1920 with `"format": "short"` in its `style.json`: see [shorts-playbook.md](shorts-playbook.md) for its sections, the safe zone, captions and how pictures are framed.

## How slides attach to the script

`script.md` is the single source. A `> SLIDE {json}` cue starts a slide; every spoken line after it, until the next cue, is that slide's voiceover. Spoken text before the first cue of a section is an error. A chapter card (silent, 2.2 s) is inserted automatically before each `## [IDEA n]`.

```markdown
## [IDEA 1] Plan the questions, not the pages

> SLIDE {"layout":"statement","text":"A help center is a list of\nquestions your users already ask.","highlight":"questions"}

A help center isn't pages. It's a list of questions your users already ask.
One article answers one question. That's the whole rule.

> SLIDE {"layout":"table","title":"Our planning sheet (real rows)","columns":["Title","Question","Status"],"rows":[["Invite teammates","How do I invite my team?","[published]"]]}

So before writing a single article, we built a sheet.
```

The JSON stays on one line. `script-stats.mjs` ignores the cues; `teleprompter.txt` stays clean.

**Reveal a list** (pace 3+): a `points` cue with `"reveal": "build"` (the list grows one point at a time, earlier ones ticked) or `"reveal": "one"` (each point gets its own full-screen `point` slide) is split by the renderer. It needs **exactly one spoken line per point**, in order; anything else exits 2.

```markdown
> SLIDE {"layout":"points","title":"Three rules","points":["One question per article","Real user words","Ship small"],"reveal":"one"}

First: one article answers one question.
Second: use the words your users actually type.
Third: ship small, and ship often.
```

## Layouts

| `layout`       | Use for                                                                      | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `statement`    | the line to remember; hooks, catches, turns                                  | `text` (`\n` for the break), `highlight` (exact substring), `sub`, `theme: "dark"` for punches, `size`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `points`       | lists, roadmaps, steps                                                       | `title`, `points` (≤ 5; `**bold**` ok), `current` (index to highlight, others dimmed), `done` (first n ticked)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `flow`         | a diagram: how things connect, a process, a loop, a concept and its parts    | `title`, `nodes` (≤ 7: a string or `{text, sub?, id?, tone?: "accent"\|"dark"}`), `links` (`[from, to, label?]` by id or index; default: a chain), `shape` (`auto` · `cycle` · `hub`), `direction` (`row` · `column`), `on` (ids to highlight), `arrows: false`, `dots: false`, `bg` (a scene background), `reveal: "build"`; see "Diagrams"                                                                                                                                                                                             |
| `number`       | one real number, or a before → after                                         | `value`, `from`, `label`, `title`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `table`        | real rows from a sheet, a checklist                                          | `title`, `columns`, `rows` (≤ 8; a cell `"[text]"` renders as a pill), `mark` / `cut` (row indexes), `note`, `textSize`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `doc`          | real text: a file, a prompt, instructions                                    | `title`, `file` (label in the window bar), `lines` (≤ 10), `on` (line indexes to highlight; others fade)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `fields`       | a real record: CMS fields, settings                                          | `title`, `fields: [{k, v, n?, bad?}]` (`n` = a note like "51 chars ✓")                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `chat`         | a prompt the viewer can copy                                                 | `title`, `bubbles: [{role: "user"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | "ai", text}]`, `note` |
| `image`        | a real screenshot or picture                                                 | `src` (path relative to `$W`, e.g. `assets/step-1.png`), `title`, `caption`, `alt`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `screen`       | a real product screen, animated like a demo (counts as proof)                | `shot` (captured by `capture-screens.mjs`) + `state`, or `src` (a file, or `{state: file}`) + `boxes`; `move` (`zoom` · `spot` · `cursor` + `click` · `then`; one step or a list), `frame` (`browser` · `window` · `phone` · `none`), `treat` (`tint` · `duotone` · `sketch`), `focus`, `title`, `caption`, `source`; see "Product screens"                                                                                                                                                                                              |
| `mock`         | a UI recreated in the look, labelled "Recreated from …" (never proof)        | `app`, `page` (`url`, `nav`, `active`, `crumbs`, `heading`, `tabs`, `tab`, `blocks`, `cols`, `dialog`, `toast`), `states` (`{name: partial page}`), `move`, `title`, `caption`; see "Product screens"                                                                                                                                                                                                                                                                                                                                    |
| `point`        | one point, full screen (what `reveal:"one"` makes)                           | `n`, `of`, `text`, `title`, `highlight`, `sub`, `size`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `word`         | 1–3 huge words: punches, turns (pace 4–5)                                    | `text`, `highlight`, `sub`, `theme: "dark"`, `size`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `quote`        | a line someone said or wrote (story look)                                    | `text`, `by`, `size`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `doodle`       | a hand-drawn MS Paint-style picture (paint look): analogies, scenes, objects | `draw` (one of `sheet` · `pages` · `brochure` · `robot` · `camera` · `checklist` · `magnifier` · `question` · `button` · `browser` · `person` · `trash` · `clock` · `warning` · `bulb` · `book` · `score` · `refresh` · `tag` · `inbox`), `text` + `highlight` beside it, `sub`, `caption` (under it, when there's no text)                                                                                                                                                                                                              |
| `scene`        | a picture with characters: situations, analogies, reactions, the catch       | `bg` (`plain` · `desk` · `office` · `city` · `night` · `hills` · `stage` · `space`, the layered worlds `aurora` · `sea` · `dawn`, or `{"prompt": "…", "dark"?: true}` for a generated one), `camera`, `fx`, `marks` (see "Illustrated worlds"), `cast` (≤ 3: `"ghost:wave"` or `{who, pose, say?, color?, skin?, hair?, size?}`), `props` (≤ 3: `laptop` · `plant` · `chart` · `books` · `bulb` · `trophy` · `boxes` · `papers` · `server`, or `{prop, at: "left"\|"right"\|"center"\|x}`), `text` + `highlight`, `sub`, `textAt: "top"` |
| `illustration` | a generated picture, full-bleed (only with generated illustrations on)       | `prompt` (what to draw; no text in it), or `src` (a picture you have in `$W/assets/`), or `layers` (backdrop + cut-outs), `cast`, `camera`, `fx`, `marks`, `text` + `highlight` on a plate, `at` (`bottom` · `top` · `left`), `sub`                                                                                                                                                                                                                                                                                                      |
| `subscribe`    | the mid-hook and outro ask                                                   | `text` (headline), `sub`, `button` ("Subscribe"), `done` ("Subscribed"); see below                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `end`          | the outro, leaves room for YouTube end-screen elements                       | `text` (top line only); held ≥ 20 s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `chapter`      | automatic before each idea; don't write it                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Pace (1–5)

Chosen in §1b, stored as `pace` in `style.json` (`--pace` overrides). It sets how densely you write cues, and how the renderer cuts and moves:

| Pace | Feel                   | Max s a slide | How to write cues                                                                                    | Transition                        | Motion                                                         |
| ---- | ---------------------- | ------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| 1    | lecture                | 20            | a cue per 1–3 spoken lines                                                                           | cut                               | none                                                           |
| 2    | calm (the first draft) | 15            | a cue per 1–2 lines; lists as one `points` slide stepping `current`                                  | cut                               | none                                                           |
| 3    | balanced               | 10            | lists as `reveal:"build"`; a `statement` for each turn                                               | 0.25 s crossfade                  | slow push-in on statement, chapter, quote, word, point, number |
| 4    | lively                 | 7             | a cue per line; lists as `reveal:"one"`; a dark `word` at each catch                                 | 0.2 s crossfade                   | slow push-in on every slide                                    |
| 5    | fast                   | 5             | a visual per sentence; a `word` or `number` pattern break every ~30 s; artifacts split across slides | 0.15 s crossfades, cuts on `word` | push-in, punch-in on `word`                                    |

In Story teller mode the sentence sets the cut instead (Story teller mode, below). A slide over the max is a warning; at pace 3+ over 1.3× the max exits 2 (split it). Higher pace never means more words: the script is the same length; it's cut into more pictures. The subscribe and end slides are exempt.

Example, one idea with three points, ~25 s of voice:

- **pace 2**: a `points` slide (current 0 → 1 → 2 as three cues), then a `doc`.
- **pace 4**: the chapter card, then three `point` slides, then a `doc` with the real artifact, then a dark `word` for the catch.

## Look

Every look is a preset folder in `../styles/` (`style.json` + `style.md` + local reference `images/`; see `styles/README.md`); `$W/style.json` names it with `"preset"` and can override any field. The two kinds of look underneath:

- **`brand`**: the channel's palette, fonts and logo from the project config (`look`), the logo and wordmark top-right, the progress bar, "Idea n of N" labels.
- **`story`** (no branding): the `theme` in `style.json` replaces the palette and fonts. There's no logo, wordmark or progress bar, the labels are quieter ("Chapter n"), and there's a grain + vignette texture. It suits narrative scripts: more `statement`, `word` and `quote`, fewer lists. The inspiration folder is a **style reference only**; its images never appear on screen. Proof slides (`doc`, `table`, `chat`, `image`) still use real artifacts, in the theme's colours.
- **`paint`** (`"texture": "paint"`, used by `documentary-explainer`): an MS Paint-style hand-drawn look. White canvas, hand lettering (Permanent Marker for headlines, Patrick Hand for text, bundled in the preset under OFL/Apache), thick wobbly ink borders on cards, a yellow marker highlight (`theme.marker`), and `doodle` slides drawn from `assets/doodles.js` (flat Paint colours, roughened by an SVG filter). Doodles are illustrations: a person, a button, a camera. Never a picture pretending to be a real screen. Add a doodle by adding a function to `DOODLES` in `assets/doodles.js`.
- **`soft`** (`"texture": "soft"`, used by `illustrated-explainer`): a clean vignette and no grain, for flat-vector pictures. `theme.outline` sets the characters' line width in px (`0` = no outlines; the preset uses 3 so a light mascot reads on light skies). Add a layered world by adding a function to `WORLD` in `assets/scenes.js` that returns `layers` (`[{depth, svg}]`, far to near) and `defs` for its gradients.

## Pictures

Two kinds, both **illustrations, never proof**: they show a situation or a metaphor, never a product screen, a real person, real data or an AI output. Proof slides stay real artifacts (Rules below).

**`scene`** (always available, free, no network): flat vector art from `assets/scenes.js` in the theme's colours, so it matches every look (roughened in the paint look).

- **Cast** (≤ 3): `ghost` (the default mascot; `look.mascot` in the config picks the default lead), `person` (`color` = shirt, `skin`, `hair`), `robot` (the AI). Poses: `neutral` · `wave` · `talk` · `point` · `shrug` (with a ?) · `shock` · `think` (hand to chin, thought dots) · `cheer` (sparkles) · `sad`. `point`, `talk` and `wave` turn toward the middle of the frame.
- **`say`**: a speech bubble over that figure, ≤ 8 words. The check fails if a bubble runs off the frame, covers the text or takes more than 3 lines.
- **Layout**: one figure + `text` = text on the left, figure on the right; two or three figures + `text` (or `textAt: "top"`) = text on top. On a busy background the text sits on a plate.
- **Backgrounds**: `plain` (just a floor), `desk` (room with window and shelf), `office` (windows and a whiteboard chart), `city`, `night` (dark), `hills`, `stage` (dark, spotlight), `space` (dark). Or a generated one: `"bg": {"prompt": "a quiet library at dusk"}` (characters are drawn on top; set `"dark": true` for a dark picture).
- Use: the hook's everyday moment ("you ask the AI to fix one thing…": a person `shrug`, the robot `think`), an analogy, the catch (`shock`, `sad`), a win (`cheer`), the subscribe lead-in (the ghost `wave`). About one slide in five; never two scenes in a row with the same background and cast.

```markdown
> SLIDE {"layout":"scene","bg":"office","cast":[{"who":"person","pose":"shrug","say":"Why did it do that?"},"robot:think"],"props":["server"]}
```

**`illustration`** (only when the user chose generated illustrations in §1b): `scripts/gen-images.mjs` sends the cue's `prompt` with the look's image style (`style.mjs` › `imageStyle`; the config's `look.imageStyle`, a preset or `$W/style.json` can set its own) to the OpenAI Image API (model = the config's `models.image`, 1536×864; key = `OPENAI_API_KEY`). Write the prompt as a scene ("the ghost mascot sorting a mountain of support tickets into three neat piles"), never with words to render: the slide adds the text. Until the picture exists, `--slides` shows a placeholder and the full render exits 2. Use it for the two or three moments that deserve a richer picture (the hook, the big turn), not as wallpaper; in Story teller mode, every sentence gets one (below).

## Product screens (`screen`, `mock`)

Show a product the way a demo does: the real screen in a frame, the camera pushing into the option the voice names, a spotlight on it, a cursor that clicks, and the real result fading in. Two layouts share the moves:

- **`screen`**: a real screenshot. Proof, like a `doc` or `table`. Captured by `scripts/capture-screens.mjs` (public pages, apps behind a login, images from a help center or docs, files you have), with a source credit under the frame ("Screenshot · docs.example.com, Nov 2026").
- **`mock`**: a UI recreated in the look's own colours and fonts from real labels, for when a real shot can't be had (no access, data that can't be shown) or the look needs the UI drawn in its style (the paint look draws it by hand). It always carries "✎ Recreated from <app> · illustrative UI" under the frame, and it is never an idea's proof.

### Capture (`$W/screens/shots.json`)

```json
{
  "redact": [{ "find": "Acme Corp", "replace": "Demo Account" }],
  "shots": [
    {
      "id": "settings",
      "url": "https://app.example.com/workflows/…/settings",
      "login": "myapp",
      "viewport": [1440, 900],
      "wait": "text=Settings",
      "hide": ["#intercom-container"],
      "targets": { "approval": "role=switch[name='Requires human approval']" },
      "states": [
        { "name": "before" },
        {
          "name": "after",
          "do": [{ "click": "approval" }, { "wait": 400 }],
          "targets": { "saved": "text=Saved" }
        }
      ]
    },
    { "id": "docs", "url": "https://platform.openai.com/docs/…", "crop": "main" },
    {
      "id": "help-1",
      "fetch": "https://docs.example.com/images/step-2.png",
      "page": "https://docs.example.com/guide/…"
    },
    {
      "id": "mine",
      "src": "assets/my-shot.png",
      "boxes": { "menu": [120, 80, 300, 60] },
      "own": true
    }
  ]
}
```

- `targets`: name → Playwright selector (`text=…`, `role=button[name='…']`, CSS). The script records each target's box in the picture's pixels, so the moves land exactly on it; a missing one stops the capture and lists what the page offers. The shot's targets must be on its first state; a state's own targets on that state.
- `states`: pictures of the same page in order; `do` steps run before each one (`click`, `hover`, `fill` `[target, text]`, `press`, `scroll`, `wait` (selector or ms), `goto`, `eval`). Capture the real result of the click: that's the `then` of the move.
- `viewport` (default 1440×900) at `scale` 2 (sharp when zoomed); `crop` (a selector) keeps one panel; `dark: true`, `locale`, `css` and `hide` adjust the page. None of it is saved to the app.
- `login: "<name>"`: a session saved once with `capture-screens.mjs --login <name> <sign-in url>` (a visible window; the user signs in and closes it). Stored in `.youtube-videos/.auth/` (gitignored).
- **Redaction** before every picture: the config's `screens.redact` rules (e.g. your app's account name → "Demo Account"; a rule with `host` only applies there), the file's and shot's `redact` (`{selector, text}`, `{selector, blur: true}`, `{find, replace}`), and every email and phone number blurred (`"pii": false` turns it off). Read every picture anyway.
- `fetch`: an image URL (a help-center or docs screenshot); `src`: a file you have (`own: true` = yours, no credit needed).

### Moves

```markdown
> SLIDE {"layout":"screen","shot":"settings","title":"Turn on approvals"}

Open the workflow's settings.

> SLIDE {"layout":"screen","move":{"zoom":"approval","spot":"approval"}}

This switch is the whole feature.

> SLIDE {"layout":"screen","move":{"cursor":"approval","click":true,"then":"after","keep":true}}

Flip it, and every refund waits for a person.
```

- One cue per spoken line that points at something, one `move` each: the picture moves when the voice names the thing. A cue without `shot` (or `src`, or `page` for a mock) **continues** the previous one: same frame and title, and the camera, state, spotlight and cursor start where it left them.
- A step's parts run in this order: `zoom` (a target, a box `[x, y, w, h]`, or `"out"`) → `spot` (a target; `false` removes it) → `cursor` (a target or `[x, y]`) → `click` → `then` (a state name). `move` can be a list of steps for one longer line.
- `then` fades in the next state and eases the camera back out to it (a new page); `"keep": true` stays zoomed (a menu or toggle changing in place).
- A cue with `"state": "after"` cuts straight to that state.
- `focus` (a target): where a portrait crop centres in a Short.
- Without animations, the slide shows the move's end (zoomed, spotlit, cursor on the target): still useful at pace 1–2.
- **Timing**: zoom 1.3 s, spotlight 0.5 s, cursor 0.9 s, click 0.4 s, the next state 0.5 s (plus the frame's entrance on the first cue). A short line plays them faster (≤ 60 % of the slide); give a long step a line of its own.

### Frames and looks

- `frame`: `browser` (the default for a captured page: the real address in the bar), `window` (no address), `phone` (a mobile screenshot: rounded bezel), `none`.
- The frame takes the look's colours; in the paint look it gets the wobbly ink border, and a `mock` is lettered by hand like the rest of the slide.
- `treat` (or `"screenTreat"` in `style.json` for every screen): `tint` (a wash of the main colour), `duotone` (the look's ink and ground), `sketch` (greyscale on paper). For looks where a raw screenshot clashes; the text must still read.

### Recreated UI (`mock`)

```markdown
> SLIDE {"layout":"mock","app":"Acme Desk","title":"Where you switch it on","page":{"url":"app.example.com/workflows/refunds/settings","app":"Acme Desk","nav":["Workflows","Inbox","Reports"],"active":"Workflows","crumbs":["Workflows","Refund requests","Settings"],"heading":"Refund requests","tabs":["Overview","Rules","Settings"],"tab":"Settings","blocks":[{"card":"Issue refund","chip":"Active","rows":[{"text":"Requires human approval","sub":"Sends it to a person before it runs","toggle":false,"id":"approval"}]}]},"states":{"on":{"blocks":[{"card":"Issue refund","chip":"Active","rows":[{"text":"Requires human approval","sub":"Sends it to a person before it runs","toggle":true,"id":"approval"}]}],"toast":"Saved"}},"move":{"zoom":"approval","cursor":"approval-toggle","click":true,"then":"on","keep":true}}
```

- A 1120×660 page: `nav` (sidebar) + `active`, `crumbs`, `heading`, `tabs` + `tab`, `blocks` (`cols: 2` for two columns), `dialog` (`{title, blocks, buttons}` over a dimmed page), `toast`.
- Blocks: `{card, chip?, sub?, button?, rows, buttons?}` (a row: `{text, sub?, chip?, toggle?, button?, id?}`), `{toggle, on, sub?}`, `{field, value | placeholder, area?}`, `{select, value}`, `{table: {columns, rows, mark?, ids?}}` (a cell `"[text]"` is a pill), `{stats: [{value, label}]}`, `{buttons: [text | {text, primary?, danger?, id?}]}`, `{chat: [{role, text}]}`, `{text}`.
- `id` on any element makes it a target; a row's controls are `<id>-toggle`, `<id>-chip`, `<id>-button`.
- `states`: each name is a partial page merged over `page` (give the whole `blocks` list again when it changes).
- Labels come from the real UI (the page itself, or the app's source code); names and numbers are illustrative. The renderer fails a page too tall for its frame.

## Story teller mode

`"mode": "storyteller"` in `style.json` (asked in SKILL.md §1b; any look): **a generated illustration for every sentence**, so the picture follows the voice like a picture book read aloud. It needs generated illustrations (`"illustrations": true`), or your own pictures as `src`. Not to be confused with the `story` look (no branding), which is about colours and chrome.

```markdown
## [HOOK]

> SLIDE {"layout":"illustration","prompt":"{Maya} at her kitchen table at 2 a.m., lit only by her laptop, a cold cup of coffee beside her"}

At two in the morning, Maya was still answering tickets.

> SLIDE {"layout":"illustration","prompt":"close-up of a tall stack of paper envelopes in the laptop's glow, each stamped with the same question mark"}

Forty-three of them, all asking the same question.

> BEAT
```

- **One sentence, one line, one picture.** Every spoken line is a single sentence, and every line has its own `illustration` cue right above it. `script-stats.mjs` and the renderer stop on a line with two sentences or a picture with two lines (`storyteller.mjs` splits sentences on `.` `?` `!` `…` before a capital, skipping abbreviations and initials). The subscribe and end slides are exempt.
- **The prompt draws the sentence**: what the voice says, as a concrete shot (who, doing what, where, the light, the mood). An abstract sentence gets its metaphor ("trust breaks quietly" → a glass bridge with one hairline crack). Never words in the picture: the voice says them. How to write for it: script playbook › Writing for Story teller.
- **Recurring characters.** Describe each recurring person, animal, place or object once in `style.json`, and name it in a prompt as `{Maya}` or `{the office}`:

  ```json
  "characters": {
    "Maya": "a support agent in her 30s with short red hair, round glasses and a green denim jacket",
    "the office": "a small open-plan office with tall windows, plants and yellow desk lamps"
  }
  ```

  Every prompt that names one gets its description, plus an instruction to draw it the same way each time; the look's `imageStyle` keeps the drawing style constant. An unknown `{Name}` stops the checker and the generator. Editing a description regenerates every picture that names it (the file name is a hash of the full prompt). The vector `cast` (mascot, person, robot) also works on an illustration: drawn by the renderer, identical in every shot.

- **Proof stays real.** A real number, table, doc or chat still goes on its own slide (`number`, `table`, `doc`, `chat`), one sentence under it like any other. Keep those to about one sentence in five (the checker warns past that).
- **Timing.** The sentence sets the cut, not the pace: a picture holds as long as its sentence, up to 12 s (the render stops past about 15 s: split the sentence, each half with its own picture). At any pace the pictures dissolve into each other (0.3 s) and still pictures push in slowly. With animations on, the camera is `auto` by default and each picture takes the next move in turn (push, pan right, drift, pan left, pull, rise); a cue's own `camera` wins, and `layers`, `cast`, `fx` and `marks` work as usual.
- **How many pictures.** About one per sentence: roughly 100 for an 8-minute video, 150 for 12 minutes, 250 for 20. `gen-images.mjs` generates 4 at a time (`--jobs`), at `medium` quality unless `"imageQuality"` (or `--quality`) says otherwise; `--dry-run` gives the exact count before anything is billed. Identical prompts are generated once, so returning to the same establishing shot costs nothing.

## Diagrams (`flow`)

A `flow` slide draws boxes and arrows from a short list, laid out by the renderer, in the look's colours (wobbly in the paint look). Use it where the voice explains **how things connect**: a process, a cause and effect, a loop, a concept and its parts. It replaces a `points` slide whenever the items lead into each other.

| `shape`          | Draws                                                                                                                                                      | Good for                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `auto` (default) | columns ranked along the arrows: a chain, or branches that split and merge; `direction: "column"` runs it top to bottom; a link back up the list arcs over | a process, a pipeline, inputs → result           |
| `cycle`          | the nodes on a loop, each arrow to the next and the last back to the first                                                                                 | a feedback loop, a habit, an iteration           |
| `hub`            | the first node in the middle (highlighted), the others around it, spokes from it (`arrows: false` for plain connectors)                                    | a concept and its parts, one cause, many effects |

```markdown
> SLIDE {"layout":"flow","title":"Picking a topic","nodes":["Your CSV","Search queries","Customer pains","Clusters",{"text":"Top 3","tone":"accent"}],"links":[["0","1"],["0","2"],["1","3"],["2","3"],["3","4","scored"]]}
```

- Nodes: 1–5 words each (the box fits its text from 52 px down to 30 px; the check fails on a box that still doesn't fit, overlapping boxes, or more than 7 nodes). A `sub` adds a small second line. `id`s are optional: links can use the index (`"0"`, `"1"`…).
- Links: `[from, to]` or `[from, to, "label"]` (a 1–2 word pill on the arrow; on a flat arrow it floats above it). `{"from","to","label","dashed":true}` for a maybe or a later step. Without `links`: a chain in list order (`cycle`: back to the start; `hub`: spokes).
- Highlight with `on: ["id"]` or `tone: "accent"`; `tone: "dark"` for the thing to avoid.
- **Build it step by step**: `"reveal": "build"` with exactly one spoken line per node adds one box per line (the newest highlighted, its arrows drawing in); the layout is fixed from the start, so nothing jumps.
- **Over a world**: `"bg": "aurora"` (any scene background) puts the diagram over the picture, with the title on a plate; with the camera on, the world drifts behind the still diagram.
- It's a drawing of an idea, not data: real numbers and real outputs still go on `number`, `table`, `doc` or `chat` slides.

## Illustrated worlds: depth, camera, particles, marks

The animated-explainer look (`illustrated-explainer` preset, but any look can use them): full-bleed pictures in depth layers, a slow camera that moves through them with parallax, floating particles, and pins or glowing paths drawn over the picture. They work on `scene` and `illustration` slides; `fx` works on any slide.

**Layered worlds (free).** `bg: "aurora"` (polar night, stars, glowing aurora; dark), `"sea"` (dusk sea, wave bands with bright crests, an ice floe to stand on) and `"dawn"` (golden-hour valley, misty ridges, a big low sun) are flat-vector backgrounds built in depth layers from the theme's colours. The cast stands on the nearest layer, so feet never slide while the camera moves.

**Layered illustrations (generated).** `layers` replaces `prompt`: the first is the backdrop (sky, distant scenery, ground plane; generated opaque), the others cut-outs on a transparent background (a foreground rock, a midground island), each with a `depth` from 0 (far) to 1 (near; default: spread evenly) and an optional `blur` in px for a foreground out of focus. **Cut-outs come back centred in their frame, whatever the prompt asks**: place each one with `x`, `y` (where its centre goes in the 1920×1080 frame) and `scale` (its size; 1 = as generated), e.g. `{"prompt": "…", "depth": 1, "x": 1300, "y": 600, "scale": 0.7}`, then put the ring on that spot and the cast on the empty side. Look at the slide (`--slides`) before trusting a ring. `gen-images.mjs` makes one picture per layer (each billed). `src` works per layer too. Put characters in with `cast` (as on a `scene`), not in a prompt: drawn by the renderer, the mascot is the same in every shot and acts out its pose.

```markdown
> SLIDE {"layout":"illustration","layers":[{"prompt":"a polar sea at dusk under a violet sky, distant icebergs","depth":0},{"prompt":"a tall snowy island in the middle distance","depth":0.5},{"prompt":"dark foreground rocks in the lower corners","depth":1,"blur":3}],"cast":["ghost:point"],"marks":[{"ring":[960,470],"r":150}],"camera":{"to":[960,470],"zoom":1.25},"fx":"snow"}
```

**`camera`** (needs animations): one slow move over the whole slide; near layers move more than far ones.

| Value                          | Move                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `drift`                        | a gentle push-in with a slight pan (what `auto` picks) |
| `push` · `pull`                | zoom in · out (10 %)                                   |
| `pan-left` · `pan-right`       | the camera travels sideways (follow a path, a journey) |
| `rise` · `sink`                | the camera tilts up · down                             |
| `{"to": [x, y], "zoom": 1.25}` | push into a point: the pin or ring the voice is on     |
| `none`                         | no move                                                |

`style.json` `"camera": "auto"` (the `illustrated-explainer` default) drifts every `illustration` and every scene on a layered world; a cue's own `camera` always wins; `--camera` overrides for one run. Other looks have no camera unless a cue asks.

**`fx`** (particles; a name or a list): `snow`, `dust` (warm motes rising), `bokeh` (big soft lights drifting), `stars` (twinkles), `sparkle` (four-point glints: a win, a reveal), `rain`, `embers`. One or two per slide, matched to the world: `snow` or `stars` at night, `dust` or `bokeh` by day.

**`marks`** (coordinates in the 1920×1080 frame; they sit on the picture's back layer and move with it; on a `scene` they go between the background and the cast):

| Mark                                             | Draws                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| `{"pin": [x, y], "label"?: "Base camp"}`         | a map pin that drops in, with an optional 1–3 word tag |
| `{"ring": [x, y], "r"?: 120}`                    | a glowing ring that opens and keeps pulsing            |
| `{"path": "M… C…"}`                              | a glowing line (SVG path) that draws itself            |
| `{"arrow": [[x1, y1], [x2, y2]], "bend"?: 0.22}` | a curved arrow that draws itself                       |
| `{"tag": [x, y], "text": "3,000 km"}`            | a small label                                          |

Each takes `color` (default: the accent; `"#fff"` glows best on dark pictures). They appear one after another (≈ 0.4 s apart), so order them as the voice mentions them. ≤ 5 per slide; keep them clear of the cast and the text. The check fails on a mark outside the frame. `marksDepth` (0–1) puts them on another layer.

Marks, particles and the camera are **drawings over an illustration**, not data: a pin on an illustrated map is fine; a chart of real numbers is still a `number` or `table` slide.

## Animation

`"animate": "auto"` in `style.json` (asked in §1b; `--anim auto|off` overrides) films each slide frame by frame in the browser instead of showing a still: the entrance plays over the start of the voice, then the slide holds (scenes keep an idle loop: bob, blink, waving, twinkling stars). The last frame is exactly the still slide, so `--slides` and the sheet still show what the viewer sees.

| Layout                                   | Entrance                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statement`, `point`, `chapter`, `quote` | the line rises in, the highlight sweeps across                                                                                                                      |
| `word`                                   | punches in from large                                                                                                                                               |
| `points`                                 | items slide in one by one; with `reveal`, only the new item (the previous one gets its tick)                                                                        |
| `number`                                 | `from` fades in, the arrow slides, the value counts up                                                                                                              |
| `table`, `fields`                        | the card rises, rows come in one by one                                                                                                                             |
| `doc`                                    | lines type in, top to bottom                                                                                                                                        |
| `chat`                                   | bubbles pop in, in order                                                                                                                                            |
| `image`                                  | a gentle zoom settle; the text plate rises                                                                                                                          |
| `screen`, `mock`                         | the frame rises in, then the `move`: camera push, spotlight, cursor on an arc, click ripple, the next state fading in (continued cues: only the move)               |
| `illustration`                           | a zoom settle (or the camera move), cut-out layers rise in, then the cast as on a `scene`                                                                           |
| `doodle`                                 | the drawing draws itself, stroke by stroke, then fills                                                                                                              |
| `scene`                                  | the background settles, props and characters pop in, each acts its pose (wave, shrug, hop, jump, droop), extras and bubbles pop                                     |
| `marks` (any)                            | pins drop, rings open and pulse, paths and arrows draw themselves, tags pop, in order                                                                               |
| `flow`                                   | boxes pop in in order, each arrow draws itself once both its ends are there, labels fade in, a dot keeps running along every arrow; with `reveal`, only the new box |
| `subscribe`, `end`                       | none (the subscribe click already has its own frames)                                                                                                               |

- Entrances take ≤ 1.6 s and never more than 60 % of the slide: a short slide plays them faster.
- **Camera and particles are filmed for the whole slide** (every frame, not an entrance plus a held frame), and the pace's push-in is skipped on those slides (the camera already moves). That costs about 1.5 s of render per second of slide (measured ≈ 45 ms a frame): a 15-minute video with half its slides illustrated adds roughly 10 minutes. Cached like every clip. On layered worlds the aurora sways and the sun glow breathes too.
- A slide that continues the previous one (same layout and title, e.g. `points` stepping `current`, a `doc` moving its `on` lines) only animates what changed.
- `"animate": false` on a cue keeps that slide still.
- `--preview s004,s012` renders just those slides as short MP4s (`$W/video/preview-<id>.mp4`) with estimated timing, to check motion in seconds.
- Animated clips are cached in `$W/video/clips/` by content; with the brand look's progress bar, a timing change upstream re-films the slides after it.

## Subscribe and end screen

- **`subscribe`** draws today's YouTube channel row in dark mode, from `channel.md`'s name, handle and avatar:
  - avatar, channel name, `@handle`, the white **Subscribe** pill and the like/dislike pill, in Roboto, with YouTube's icon in the corner;
  - the renderer clicks it over its voiceover in three frames: resting (40 %), cursor on the pill (15 %), then a grey **Subscribed** pill with a bell (45 %).

  Use it for the mid-hook ask (and the outro, if the outro isn't just the end slide).

- **`end`** is a clean background with two soft shapes where Studio's "1 video, 1 subscribe" end-screen template puts its elements. It has no labels, because YouTube doesn't fill them in: the user adds the elements in Studio, and anything misaligned would otherwise show a placeholder. The renderer holds it for at least 20 s (the end screen's maximum).

## Rules

- **Slide length follows the pace** (table above). The contact sheet (`video/sheet.png`) prints every frame's duration and flags slides too long for the pace with ⚠.
- **Show, don't transcribe.** The slide carries the key phrase, the number or the artifact, never the paragraph being read.
- **Pictures are illustrations.** `scene`, `illustration` and `doodle` slides show situations and metaphors; they never count as an idea's proof and never depict a real product screen, a real person, real data or an AI output.
- **Proof is a real artifact.** Every idea needs at least one `table`, `doc`, `fields`, `chat`, `image` or `screen` slide built from real material (your files, sheets, prompts, a real screenshot). A treated screenshot (`tint`, `duotone`, `sketch`) is still real. Never pass off a drawn product screen as real or invent an AI output: a recreated UI is a `mock`, labelled on screen, never the proof; if you need a screenshot you can't get, say so and use a `mock` or the artifact's text instead. Label anything illustrative as such (`"file":"draft format (illustration)"`).
- **Other people's products**: show their screens for commentary and teaching, with the source credit the capture adds; no logos or screens as the thumbnail's main picture without a reason, and never in a way that suggests they endorse the video.
- **No customer data**: no real customer names, emails or conversation text; use a demo account in screenshots and blur the rest.
- Mix layouts: no more than three of the same layout in a row. Dark `statement` slides mark catches and turns.
- **Real screenshots** are captured with `capture-screens.mjs` onto `screen` slides (a page behind a login: the user signs in once with `--login`), or go in `$W/assets/` on an `image` slide when they don't need to move. If a host is blocked, say so and ask the user to drop the PNG in `$W/assets/`.

## Voice

Kokoro (82M, Apache-2.0 weights; fine for a monetised channel), running offline. Set up once into `<workspace>/.tts/` (gitignored, about 120 MB) by `render-video.mjs` itself: a Python venv with `kokoro-onnx`, plus the two model files from the kokoro-onnx GitHub release. Needs PyPI and github.com.

| Flag            | Default                     | Notes                                                                                            |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `--voice`       | `style.json` → `af_heart`   | see the candidates below; any Kokoro voice works (`bm_george`, `bf_emma` for British)            |
| `--pace`        | `style.json` → `2`          | 1–5, table above                                                                                 |
| `--speed`       | `0.92` Kokoro · `1.1` cloud | `voices.mjs`: Kokoro reads ≈ 185 wpm at 0.92, OpenAI ≈ 170 at 1.1 (bought at 1.0, sped up after) |
| `--gap`         | `style.json` → `0.1`        | silence after each slide's voice (`gap`)                                                         |
| `--section-gap` | `style.json` → `0.3`        | extra silence at a section change (`sectionGap`)                                                 |
| `--max-pause`   | `style.json` → `0.2`        | longest pause kept inside one slide's voice (`maxPause`); Kokoro leaves ~0.4 s between sentences |
| `--beat`        | `style.json` → 3×`maxPause` | the pause after a `> BEAT` line and each section's last line (`beat`, ≈ 0.6 s); `0` = none       |
| `--expressive`  | `style.json` → `1`          | how strongly `> TONE` cues change the delivery (`expressive`); `0` = one flat tone               |

**The voice keeps going.** Nothing on screen makes the voice wait: a chapter card shows over the opening of its idea's first line (1.8 s), crossfades happen while the voice runs, and between slides there's only a breath (`gap`). `tts.py` keeps Kokoro's raw take (`<id>.raw.wav`) and cuts every pause inside it down to `maxPause`, so changing the setting re-cuts without re-speaking. The only longer silences are the **beats** and the end slide's 20 s for the end screen. Measured on the first example: 332 pauses over 0.3 s (194 s) before, 10 (4 s) after. Set `"gap": 0` for no breaks at all; write bridges ("Which brings us to…") instead of relying on silence to separate sections.

**Beats.** The one place silence is wanted: after a line that has to land (the hook's promise, a wow line, a conclusion), a pause of 3× the normal one (`beat`, ≈ 0.6 s) lets the viewer process that chunk before the next idea. The renderer puts one after the last line of every section but the outro, and after every spoken line followed by a `> BEAT` cue. A beat after a slide's last line lengthens the pause after the slide (it replaces `gap` + `sectionGap` when longer); a beat after a line in the middle of a slide splits that slide's voice into takes (`<id>-1.wav`, `<id>-2.wav`) joined by the beat, and the subtitles follow. `script-stats.mjs` counts beats in its estimate. `"beat": 0` turns them all off.

**Tones.** A `> TONE <name>` cue (script playbook › Emotion and delivery; the table lives in `scripts/tones.mjs`) gives the spoken line below it its own delivery: a pause before it (the held breath before a reveal), its own speed and its own pause cap (a suspense line keeps its ellipsis). A change of tone inside a slide splits its voice into takes, like a beat, and the subtitles follow. The pause before a slide's first line only adds what the pause after the previous slide doesn't already give, and the video never opens on silence. Paid voices act the tone too (OpenAI: the tone's instruction for that line, added to `voiceInstructions` or to a default "engaging narrator" one; ElevenLabs: expressive `voice_settings`, plus an audio tag on `eleven_v4` (the default) and `eleven_v3`). `"expressive"` in `style.json` (or `--expressive`) scales it: 0 = off, 1 = default, 1.5 = more dramatic. Only the toned lines are re-spoken when it changes. The render prints how many lines carry each tone and warns when there are none.

The voice candidates offered in §1b (samples from `scripts/voice-samples.mjs`, in `<workspace>/.tts/samples/`). The descriptions follow Kokoro's own quality grades:

| Voice        | Sounds like                                                                     |
| ------------ | ------------------------------------------------------------------------------- |
| `af_heart`   | warm, the most natural US female; the first draft used it                       |
| `af_bella`   | brighter and more energetic US female; suits pace 4–5                           |
| `am_michael` | calm, steady US male explainer; a little less natural than the female voices    |
| `ef_dora`    | Spanish female, clear and friendly                                              |
| `em_alex`    | Spanish male, neutral narrator (`em_santa` is a Santa Claus voice: don't offer) |

**Paid voices (optional).** A voice name with a provider prefix uses that API instead of Kokoro, through the same cache, pause trimming and beats:

| `voice` in `style.json` | Provider          | Key                  | Options in `style.json`                                                                                                            |
| ----------------------- | ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `openai:<voice>`        | OpenAI speech API | `OPENAI_API_KEY`     | `voiceModel` (default `gpt-4o-mini-tts`), `voiceInstructions` (tone, accent, pace in words; default: an engaging, varied narrator) |
| `elevenlabs:<voice id>` | ElevenLabs        | `ELEVENLABS_API_KEY` | `voiceModel` (default `eleven_v4`, which reads the tones' audio tags; `eleven_multilingual_v2` for the older read, no tags)        |

Keys come from the environment or the project's `.env`. Both are multilingual, so they speak the video's `language`. `speed` is applied afterwards with ffmpeg for them. Each line is billed once (cached by text, voice, model and instructions); changing any of those re-buys only the lines it touches. The provider's host must be reachable (`api.openai.com`, `api.elevenlabs.io`). Model names change: check the provider's docs and set `voiceModel` when a default is retired.

Only changed lines are re-spoken (cached per slide), so editing one paragraph and re-rendering takes seconds for the voice. Write numbers and symbols the way they should be said ("a hundred and twenty-eight", "Account, then Team"); the voice reads `→` and `/` badly.

## Render

```bash
node ${CLAUDE_SKILL_DIR}/scripts/render-video.mjs $W --slides   # slides + sheet only, ~10 s
node ${CLAUDE_SKILL_DIR}/scripts/render-video.mjs $W            # voice + MP4, ~6 min for 13 min at pace 1–2, longer at 3–5
```

Outputs: `$W/out/video.mp4` (1920×1080, 30 fps, H.264 + AAC, loudness-normalised to −16 LUFS, ≈ 2 MB a minute), `$W/out/video.srt` (subtitles from the voiceover), `$W/out/chapters.txt` (**real** chapter times: use these in the description, not the estimates). Exit code 2 = a slide overflows, an image is missing, or a spoken line has no slide.

Check before delivering:

- read `video/sheet.png` (layout, durations, ⚠);
- `ffprobe` the MP4: video and audio durations match;
- grab a frame one second after each chapter time: it should be that chapter's card;
- the last 20 s show the end slide.

At pace 3+, every slide is first rendered as a clip in `$W/video/clips/` (cached by content). The clips are then joined with crossfades that start exactly at each slide's timeline time, so the voice, subtitles and chapters stay in sync.
