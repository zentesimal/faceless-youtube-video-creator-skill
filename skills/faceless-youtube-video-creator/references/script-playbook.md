# Long-form script playbook (8–20 min)

How a script for the channel reads, and the exact file format that `scripts/script-stats.mjs` checks. Read [channel.md](channel.md) first: it holds the reminders and subscribe lines.

## Length budget

The video is read by an AI voice at **its own rate**, which the checker reads from `style.json` (`scripts/voices.mjs`): about **185 words a minute** for Kokoro at its default speed 0.92, about **170** for an OpenAI voice at its default 1.1, pauses capped, and the voice never stops between slides, so sections are joined by spoken bridges, not silence. The exception is a **beat** (≈ 0.6 s, 3× the normal pause) after the lines that must land: the renderer adds one after every section's last line, and `> BEAT` after a spoken line asks for one (the hook's promise, each idea's wow line, the mid hook's tease; one or two per idea). The end slide adds 20 s. A presenter on camera speaks about 150 (`--wpm 150`), and screen demos add time without words: give each one a duration in its cue (`> DEMO (40s): …`).

The length is chosen at the start (8–20 min, saved as `minutes` in `$W/style.json`); the checker reads it and fails a script more than a minute off it. Budget about 185 spoken words per minute for a Kokoro voice, about 8 % fewer for an OpenAI voice (≈ 170), and 150 for a presenter:

| Target length | Spoken words (voice at 185 wpm · presenter at 150, before demos) | Ideas |
| ------------- | ---------------------------------------------------------------- | ----- |
| 8–9 min       | ≈ 1,500–1,650 (voice) · 1,200–1,350 (presenter)                  | 2–3   |
| 10–11 min     | ≈ 1,850–2,000 (voice) · 1,500–1,650 (presenter)                  | 3     |
| 12–13 min     | ≈ 2,200–2,400 (voice) · 1,800–1,950 (presenter)                  | 3–4   |
| 14–16 min     | ≈ 2,600–2,950 (voice) · 2,100–2,400 (presenter)                  | 4     |
| 17–18 min     | ≈ 3,150–3,300 (voice) · 2,550–2,700 (presenter)                  | 4–5   |
| 19–20 min     | ≈ 3,500–3,700 (voice) · 2,850–3,000 (presenter)                  | 5     |

Default: **15 min, 4 ideas.** Scale the ideas, not the hook or the intro. At 8–9 min, two ideas can carry it: the mid hook then sits after the first. Without a target (`minutes` unset), the checker keeps the old 12–18 min window. The viewer level (below) recommends the length.

## Viewer level (0–5)

Asked first, before anything else (SKILL.md §1a), and saved as `level` in `$W/style.json`: how technical the person this video is for is. The examples below come from an AI channel; the same scale works for any subject (gardening, finance, cooking). It's about the **viewer**, not the topic: "how a context window works" can be a level-1 video (a desk that only fits so many pages) or a level-5 one (attention cost and KV caches). Pick one level and hold it for the whole video; a mixed audience is served by the lower level done well.

| Level | Viewer                                                                                    | Length (ideas)  | Words                                                                                                                       | Explaining                                                                                    | Proof on screen                                                | Pictures                                                                 |
| ----- | ----------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0     | new to the subject: has never done it, or barely                                          | 8 min (2)       | everyday words only; at most 2 named terms in the whole video, each one introduced with a comparison                        | a comparison for every idea (a new intern, a librarian, a recipe); what it does, never how    | one before/after the viewer could do today, on a real artifact | a `scene` or picture for most slides; `flow` of 3 boxes at most; no code |
| 1     | has tried it a few times                                                                  | 8–10 min (2–3)  | plain words; ≤ 4 named terms, each defined in one sentence plus a comparison the first time                                 | a comparison for every mechanism; one idea per slide                                          | real prompts and answers, short                                | many scenes; small flows                                                 |
| 2     | does it regularly, as part of their week (the usual viewer of a practical how-to channel) | 10–12 min (3)   | the common terms (prompt, context window, model) named and defined once in a sentence                                       | a comparison for each new mechanism, then the real thing                                      | real prompts, before/after, the settings by name               | scenes for the moments, flows for processes                              |
| 3     | enthusiast: knows the tools and the options, compares approaches                          | 15 min (4)      | product and AI terms used freely after a one-line definition the first time                                                 | the mechanism in plain words, comparisons only where they save time                           | real prompts, configs, side-by-side outputs, numbers           | flows and docs more than scenes                                          |
| 4     | practitioner: does it for work, builds on it, knows the jargon                            | 15–18 min (4)   | the technical vocabulary (tokens, temperature, system prompt, API, JSON) without defining the basics; define advanced terms | how it works and the trade-offs, with numbers (limits, costs, latency)                        | code, API calls, configs, measurements, failure cases          | flows of 5–7 boxes, docs, tables; scenes only for the hook and the catch |
| 5     | expert or professional in the field                                                       | 18–20 min (4–5) | precise terms, nothing basic defined; name the mechanisms, papers and models                                                | the mechanism itself, the trade-offs, the edge cases, what the evidence does and doesn't show | benchmarks, papers (with sources), code, measurements          | diagrams of the mechanism; at most one comparison in the whole video     |

How it shapes each part:

- **Hook**: at 0–2, an everyday moment the viewer has lived ("you paste a long email thread and it forgets the first message"); at 4–5, a surprising fact or a failure case with a number ("the same prompt costs 3× more after one setting change").
- **Comparisons**: at 0–2 every mechanism gets one, from ordinary life, said before the real term; reuse the same comparison through the video instead of piling up new ones. At 4–5 they're the exception.
- **Terms**: at 0–2, say a term only if the viewer will meet it again (in the app, in an article), introduce it once ("this memory limit has a name: the context window") and keep using the same word. Never stack two new terms in one sentence. At 4–5, don't define what the viewer already knows; that reads as talking down.
- **Depth**: lower levels go wider and shallower (fewer ideas, each with one clear win); higher levels go deeper on fewer claims (the why, the limits, the numbers). Never pad a low-level video to reach a long length: if the topic needs 15 minutes, it's probably a level-3 video.
- **Research**: at 3–5, every number and claim gets a source (§2b recommended); at 0–2, still check facts, but put the numbers on screen sparingly (one per idea at most).
- **Packaging**: titles and thumbnail words at the same level: outcome and plain words at 0–2 ("Why ChatGPT forgets what you said"), the precise term at 4–5 ("Context windows: why 200k tokens isn't 200k").

`script-stats.mjs` reads `level` from `style.json` (or `--level`): it counts the technical terms the script says out loud and warns when a level 0–2 script uses more than the table allows (listing them, so each gets its definition and comparison), when a level 4–5 script uses almost none (probably too basic), and when `minutes` is far from the level's range. Its built-in term list is about AI; for another field, list the field's own jargon in `style.json` (`"terms": ["mulch", "pH", "NPK"]`) and it counts those too.

## Structure

The order is fixed. Times are for a 15-minute video; scale the ideas, not the hook or the intro. [`video-ideas.example.csv`](video-ideas.example.csv) has 12 videos outlined in this structure (one row each, a column per section), at different levels and lengths.

| Section      | Heading in `script.md`        | Length        | Job                                                                                                                                                                                                                      |
| ------------ | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hook**     | `## [HOOK]`                   | 20–35 s       | Earn the next 30 seconds. Open on the most surprising thing in the video: a result, a failure, a claim. Show it. Match what the thumbnail and title promised in the first sentence. No "hi guys", no name, no subscribe. |
| **Intro**    | `## [INTRO]`                  | 40–75 s       | Who this is for and what they'll walk away with (name the ideas as a roadmap, without giving away the best one). **Channel reminder** here (one line). Why trust you: what you tested.                                   |
| **Idea 1**   | `## [IDEA 1] <chapter title>` | 1½–4 min each | The strongest _easy_ idea first, so the viewer gets a win early.                                                                                                                                                         |
| **Idea 2**   | `## [IDEA 2] <chapter title>` |               |                                                                                                                                                                                                                          |
| **Mid hook** | `## [MID HOOK]`               | 20–50 s       | Between 40% and 60% of the runtime. Recap in one line what they've got so far, **subscribe ask**, then open a loop: "the next one is the one most people get wrong". Retention dips here; this is the re-hook.           |
| **Idea 3…5** | `## [IDEA 3] <chapter title>` |               | Put the best idea in the second half (idea 3 or the last one): it's what the mid hook promised.                                                                                                                          |
| **Summary**  | `## [SUMMARY]`                | 45–120 s      | The ideas as a checklist, one line each, in order. The one thing to do today.                                                                                                                                            |
| **Outro**    | `## [OUTRO]`                  | 15–40 s       | **Channel reminder** + **subscribe ask** + point at the next video (end screen). Stop talking when you're done: the last 20 s carry the end screen.                                                                      |

### Inside every idea

Each idea is a mini video with the same five beats. Give it a chapter title a viewer would click (≤ 40 chars, says the payoff, not "Part 2").

1. **Claim** (1–2 sentences): the idea, stated so it could be a tweet.
2. **Why it works**: the mechanism in plain words. One analogy, at most.
3. **Proof on screen**: a real artifact, prompt, before/after or number on a slide (`> SLIDE` with a `table`, `doc`, `fields`, `chat` or `image` layout; `> DEMO` in a presenter version). This is the part people remember. Every idea needs one.
4. **The catch**: when it doesn't work or a mistake people make. This is what makes the channel honest, and it's the "Limitations" pillar showing up in every video.
5. **Bridge**: one line that opens a loop into the next idea ("but this only works if the model can see the whole document, which brings me to…").

### Retention moves

- Pattern interrupt every 60–90 s: cut to screen, a B-roll, a zoom, an on-screen text, a question to camera. Mark them with cues.
- Open loops: tease something early that pays off later, and pay off every loop you open.
- Specific beats general: "I gave it a 40-page contract" beats "a long document".
- Say the number of ideas and where we are ("that's two of four").

## Facts, demos and honesty

- **Never invent a model output, a screen or a number.** Slides show real artifacts only (your files, sheets, prompts, a real screenshot); anything illustrative is labelled as such. In a presenter version, write `> DEMO (Ns): record live — expected: …` and let the presenter record what really happens. Claims our own data can't back (why something happened, who did what) stay out or get flagged for the user to confirm.
- **Date-sensitive facts** (model names, context window sizes, prices, feature availability) go stale in weeks. Check each one with a web search, and list every such claim with its source in `brief.md` under "Facts to verify before recording".
- No customer names, emails or real conversation data on screen or in the voice: blur or rewrite them, and label invented examples as such.
- Comparing tools is fine; bashing them isn't. Show the failure, say what it means.

## Voice

- First person to the viewer ("I'll show you", "we built"), second person to the viewer. Short sentences a voice can read in one breath.
- Write for a text-to-speech voice: numbers and symbols as they should be said ("a hundred and twenty-eight", "Account, then Team"), no `→`, `/` or parentheses in spoken lines, quotes introduced with a comma ("marked thirty of them, to ignore").
- Write for the ear: contractions, no parentheses, no "as shown above", numbers said the way you'd say them ("about forty pages").
- One idea per sentence. If a sentence needs a comma to breathe twice, split it.
- Avoid: "In today's video", "without further ado", "let's dive in", "game-changer", "unlock", "leverage", "revolutionize", "in the world of AI", "buckle up", "smash that like button".
- Spanish (if asked): neutral Spanish for Spain and LATAM, tú, product names untranslated.

## Emotion and delivery

A voice that reads every line the same way loses the viewer by minute two, however good the ideas are. Every script gets an emotional arc, written into the words first and then marked for the voice with `> TONE <name>`.

**The arc, section by section:**

| Section   | What the viewer should feel                                      | Typical tones                                      |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| Hook      | "wait, what?": a question they need answered, then a reveal      | `intrigue` → `suspense` → `surprise`               |
| Intro     | trust and a promise: this is worth the time                      | `warm` (the reminder), plain                       |
| Each idea | curiosity, then the reveal (the wow line), then the honest catch | `intrigue`, `surprise` or `excited`, `serious`     |
| Mid hook  | relief at what they've got, then pulled into the second half     | `warm` (the ask), `intrigue` or `suspense`         |
| Summary   | confidence: they've got it                                       | plain, one `excited` for the one thing to do today |
| Outro     | a friend saying goodbye                                          | `warm`                                             |

**Write the emotion into the words** (the tone only helps a line that already has it):

- **Question before answer.** "So why does it forget the first message?" then the answer, never the answer alone.
- **Withhold, then reveal.** The setup first, the payoff last and alone: "It's not the length. It's not the model. It's where you put the instruction." The reveal is its own short line.
- **Raise the stakes.** Say what it costs to get it wrong ("that's the email that goes to your biggest client").
- **Contrast.** A long line, then a short one. A big claim, then the small detail that proves it.
- **Specific surprises.** The number said on its own line ("Forty pages. It read three."), the unexpected detail, the thing that "shouldn't" work.
- **Open loops with a promise.** "And the third one is the one nobody talks about." Pay off every loop you open.
- **Talk to them.** "You've probably done this." Name the feeling: "this is the part that annoyed me."
- **Punctuation the voice can use**: a question mark lifts the line; an ellipsis ("and then…") becomes a real pause in a `suspense` line; one exclamation mark per section at most.
- No fake hype: the emotion must match a real reveal. "Mind-blowing" stays in the avoid list; a surprising true number does the job.

**Mark it for the voice.** Put `> TONE <name>` on its own line right before the spoken line it applies to (one line only; the next line goes back to plain):

| Tone       | Use it for                                                               | What the renderer does (every voice)                          |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `intrigue` | a question or mystery; the hook's opener, a bridge, the mid hook's tease | ≈ 0.25 s pause before, a little slower                        |
| `suspense` | the build-up right before a reveal                                       | ≈ 0.35 s before, clearly slower, pauses inside kept (≤ 0.5 s) |
| `surprise` | the reveal: the wow line, the surprising number, the twist               | a held breath before (≈ 0.45 s), normal speed                 |
| `excited`  | a payoff that works, a win for today                                     | short pause, a little quicker                                 |
| `serious`  | the catch, a warning, a cost                                             | ≈ 0.3 s before, slower and steady                             |
| `warm`     | reminders, the subscribe ask, reassurance, goodbye                       | short pause, slightly slower                                  |
| `playful`  | a light joke, an absurd example                                          | short pause, a little quicker                                 |

Kokoro, the free voice, can't act: for it a tone is timing only (the pause, the speed, the pauses kept), so the words carry the emotion. The paid voices act it as well: `openai:` voices get the tone as an instruction for that line (on top of `voiceInstructions`, or a default "engaging narrator" one), `elevenlabs:` voices get more expressive settings and, on an `eleven_v3` model, an audio tag (`[curious]`, `[surprised]`…). `"expressive"` in `style.json` scales the timing (0 = off, 1 = default, 1.5 = more dramatic).

**How many.** About 10–30 % of the lines: the hook gets two or three, each idea one `surprise` (on the line marked `> BEAT`) and usually one `serious` (the catch), the mid hook one tease. A suspense line must pay off (a `surprise` or `excited` line follows in the same section or the next). `script-stats.mjs` checks all of this and warns about a flat read (no tones, fewer than three kinds) or over-acting (more than 40 % of the lines).

```markdown
> TONE intrigue
> You paste a long email thread into the chat. So why does it ignore the very first message?
> TONE suspense
> The answer isn't what most people think…
> TONE surprise
> It never saw it at all.
> BEAT
```

## Story-telling (the `story` look)

When `style.json` has `"style": "story"`, the script tells a story instead of walking through a list. The structure doesn't change: the same seven sections, markers and timing, so `script-stats.mjs` still passes. How they're filled does:

- **Hook = a cold open on a moment.** A person, a time, a problem, told in the present tense: "It's 11 p.m. and the support queue has 400 tickets. The chatbot just told a customer their refund was approved. It wasn't." The surprising claim comes out of the scene; it isn't announced.
- **Intro**: the question the story raises, the channel reminder, and what the viewer gets by staying ("by the end you'll know the four things that would have stopped that reply").
- **Each idea is a small story**, the five beats wearing story clothes:
  1. situation: who, where, what they tried;
  2. what broke: the failure, shown with the real artifact;
  3. the turn: what changed;
  4. the lesson: the claim, said once, plainly;
  5. bridge: a question the next idea answers.

  Keep one thread (the same team or the same problem) running through all of them when the material allows.

- **Mid hook**: where the story stands, the subscribe ask, then raise the stakes for the second half.
- **Summary**: back to the opening scene, replayed with the lessons applied ("Same queue, same 11 p.m. This time…").
- **Outro**: as usual (channel reminder, subscribe, next video).
- **Slides**: fewer `points`, more `statement`, `word` and `quote`. Proof stays real: a `doc`, `table` or `chat` with the actual artifact, never an invented one. Scenes are told, not illustrated with fake screenshots.
- **Honesty**: a story built from real events uses the real details (anonymised: no customer names). A composite or hypothetical scene says so in the voiceover ("picture a team that…").

## `script.md` format (what the checker reads)

```markdown
# <working title>

## [HOOK]

> VISUAL: cold open on the screen recording, the model confidently counting 2 r's in "strawberry"

This model can write a legal contract. It can't count the letters in "strawberry".

## [INTRO]

> CHANNEL

On this channel I test what AI can actually do…

## [IDEA 1] Why it can't count letters

…spoken text…

> DEMO (40s): record live — ask for the r's in "strawberry", then ask it to spell it with dashes first. Expected: second one is right.

…

## [MID HOOK]

> SUBSCRIBE

…

## [IDEA 3] The hack that fixes long documents

…

## [SUMMARY]

…

## [OUTRO]

> CHANNEL
> SUBSCRIBE
> END SCREEN: next video "…" + subscribe button

…
```

Rules:

- `## [TAG]` headings, in the order above. Idea headings carry their chapter title after the tag.
- Lines starting with `>` are production cues, never spoken: `SLIDE {…}` (one slide, see `video-playbook.md`), `VISUAL:`, `SCREEN:`, `B-ROLL:`, `ON-SCREEN TEXT:`, `DEMO (Ns):`, `END SCREEN:`, and the markers `CHANNEL`, `SUBSCRIBE`, `BEAT` (a pause of ≈ 0.6 s after the spoken line just above it) and `TONE <name>` (how the spoken line just below it is delivered; see Emotion and delivery). `DEMO (Ns)` and `PAUSE (Ns)` add N seconds to the estimate, each `BEAT` its length, each `TONE` its pause and speed. The checker warns about an idea with no `BEAT` and about the emotion rules above.
- `CHANNEL` marks a channel reminder in that section; `SUBSCRIBE` marks a subscribe ask. The checker requires `CHANNEL` in INTRO and OUTRO, `SUBSCRIBE` in MID HOOK and OUTRO, and fails a `SUBSCRIBE` in HOOK or INTRO.
- Everything else under a heading is spoken text and gets counted.

## Title and description (`youtube.md`)

- **Titles:** 3 options, ≤ 60 characters (≤ 100 hard), the payoff or the tension first. Same promise as the hook's first line and the thumbnails. No clickbait the video doesn't pay off.
- **Description:** first 2 lines (shown above "…more") restate the promise with the main search phrase from the CSV. Then 3–5 lines on what's inside, the chapters, any links mentioned in the video, then the footer from `channel.md`.
- **Chapters:** from `chapters.txt` (first one at `0:00`, at least 3, each ≥ 10 s). These are estimates from word counts: **re-time them from the final edit** before publishing.
- **Tags:** 5–10, from the CSV's queries; they matter little, don't spend time on them.
- **Pinned comment:** a question that invites experience ("Which of these will you try first?").
