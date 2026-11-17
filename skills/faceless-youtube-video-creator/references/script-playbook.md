# Long-form script playbook (8–20 min)

How a script for the channel reads, and the exact file format that `scripts/script-stats.mjs` checks. Read [channel.md](channel.md) first: it holds the reminders and subscribe lines.

## Length budget

The default video is read by an AI voice at about **185 words a minute** (`script-stats.mjs --wpm 185`): speed 0.92, pauses capped, and the voice never stops between slides, so sections are joined by spoken bridges, not silence. The exception is a **beat** (≈ 0.6 s, 3× the normal pause) after the lines that must land: the renderer adds one after every section's last line, and `> BEAT` after a spoken line asks for one (the hook's promise, each idea's wow line, the mid hook's tease; one or two per idea). The end slide adds 20 s. A presenter on camera speaks about 150 (`--wpm 150`), and screen demos add time without words: give each one a duration in its cue (`> DEMO (40s): …`).

The length is chosen at the start (8–20 min, saved as `minutes` in `$W/style.json`); the checker reads it and fails a script more than a minute off it. Budget about 185 spoken words per minute for the voice (150 for a presenter):

| Target length | Spoken words (voice at 185 wpm · presenter at 150, before demos) | Ideas |
| ------------- | ---------------------------------------------------------------- | ----- |
| 8–9 min       | ≈ 1,500–1,650 (voice) · 1,200–1,350 (presenter)                  | 2–3   |
| 10–11 min     | ≈ 1,850–2,000 (voice) · 1,500–1,650 (presenter)                  | 3     |
| 12–13 min     | ≈ 2,200–2,400 (voice) · 1,800–1,950 (presenter)                  | 3–4   |
| 14–16 min     | ≈ 2,600–2,950 (voice) · 2,100–2,400 (presenter)                  | 4     |
| 17–18 min     | ≈ 3,150–3,300 (voice) · 2,550–2,700 (presenter)                  | 4–5   |
| 19–20 min     | ≈ 3,500–3,700 (voice) · 2,850–3,000 (presenter)                  | 5     |

Default: **15 min, 4 ideas.** Scale the ideas, not the hook or the intro. At 8–9 min, two ideas can carry it: the mid hook then sits after the first. Without a target (`minutes` unset), the checker keeps the old 12–18 min window.

## Structure

The order is fixed. Times are for a 15-minute video; scale the ideas, not the hook or the intro.

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
- Lines starting with `>` are production cues, never spoken: `SLIDE {…}` (one slide, see `video-playbook.md`), `VISUAL:`, `SCREEN:`, `B-ROLL:`, `ON-SCREEN TEXT:`, `DEMO (Ns):`, `END SCREEN:`, and the markers `CHANNEL`, `SUBSCRIBE` and `BEAT` (a pause of ≈ 0.6 s after the spoken line just above it). `DEMO (Ns)` and `PAUSE (Ns)` add N seconds to the estimate, each `BEAT` its length. The checker warns about an idea with no `BEAT`.
- `CHANNEL` marks a channel reminder in that section; `SUBSCRIBE` marks a subscribe ask. The checker requires `CHANNEL` in INTRO and OUTRO, `SUBSCRIBE` in MID HOOK and OUTRO, and fails a `SUBSCRIBE` in HOOK or INTRO.
- Everything else under a heading is spoken text and gets counted.

## Title and description (`youtube.md`)

- **Titles:** 3 options, ≤ 60 characters (≤ 100 hard), the payoff or the tension first. Same promise as the hook's first line and the thumbnails. No clickbait the video doesn't pay off.
- **Description:** first 2 lines (shown above "…more") restate the promise with the main search phrase from the CSV. Then 3–5 lines on what's inside, the chapters, any links mentioned in the video, then the footer from `channel.md`.
- **Chapters:** from `chapters.txt` (first one at `0:00`, at least 3, each ≥ 10 s). These are estimates from word counts: **re-time them from the final edit** before publishing.
- **Tags:** 5–10, from the CSV's queries; they matter little, don't spend time on them.
- **Pinned comment:** a question that invites experience ("Which of these will you try first?").
