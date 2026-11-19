# Shorts playbook: 3 Shorts from a long video

A Short is a **standalone retelling of one moment** from a long video, not a clip cut out of it: a new 30–55 s script, re-rendered at 1080×1920 by the same `render-video.mjs`, in the same look and voice, with burned-in captions. The long video stays the product; each Short is a door into it.

## Picking the moments

Propose 5, the user picks 3. A good moment:

- **stands alone**: it makes sense to someone who has never seen the long video (no "as we saw", no "idea 3");
- **has a turn**: a question and its surprising answer, a myth and the fact, a before/after number, a mistake and the fix;
- **has one picture**: a scene, a number or a chat that tells it without the voice;
- **pays off in under a minute**: one idea, one proof. A five-step process is a long video, not a Short.

Good sources, in order: the hook's paradox, each idea's wow line (`> TONE surprise`), a surprising number (`number` slide), the honest catch (`serious`), a before/after. Avoid the intro, the summary and anything that needs a demo to land.

Spread the 3 picks: different ideas, different openings (a question, a number, a bold claim), so the three Shorts don't feel like the same video.

## Structure

```markdown
## [HOOK]

> SLIDE {"layout":"word","text":"Generic.","theme":"dark"}

> TONE intrigue
> Why does AI give you a different script every single time?

## [PAYOFF]

> SLIDE {…}
> …3–6 slides: the answer, the one proof, the takeaway…

## [LOOP]

> SLIDE {"layout":"statement","text":"Full video\nlinked above.","highlight":"linked above"}

And next time you ask, the answer isn't generic. Full video linked above.
```

- **[HOOK]**: one spoken line, ≤ 12 words, on a slide that already shows the tension. The scroll decides in 2–3 s: no greeting, no channel name, no "in this video". Open on the question or the claim itself.
- **[PAYOFF]**: retold, not copied. Cut every reference to the rest of the video. One idea, one proof, one takeaway. A slide every 3–5 s (pace 4–5).
- **[LOOP]**: a last line that runs back into the first (the viewer rewatches, which counts) or sends them to the long video. Never "subscribe": the Shorts player has its own button.
- **Length**: 30–55 s spoken (≈ 90–170 words at 185 wpm). YouTube takes up to 3 min, but past 60 s a Short stops looping and is shown less. `script-stats.mjs` warns outside 20–58 s and fails past 180 s.
- **Tones**: the hook gets `intrigue` or `suspense`, the payoff its `surprise`; one or two tones per Short.

## The frame (1080×1920)

The renderer handles the layout; what you control is what goes on each slide.

- **Safe zone**: slide text sits between y ≈ 230 and y ≈ 1220, x 90–960. Above it is the Shorts top bar, to the right the like/comment/share buttons, below the captions and then the title and channel overlay.
- **Captions** sit in the band y ≈ 1270–1440, 2–4 words at a time, white with an outline in the theme's ink, in the look's display font. `"captions": false` in `style.json` turns them off (for a Short that is only words on slides).
- **Text layouts** (`statement`, `word`, `number`, `point`, `points`, `quote`, `chat`, `image`, `doodle`) use the full column, a quarter bigger than in 16:9. Keep `points` to 3 and statements to two short lines.
- **Pictures** (`scene`, `illustration`, `flow`) keep their 1920×1080 drawing, scaled into a band under the text: by default 0.8× (the middle ~70 % shows), `"focus": <x>` (in the 1920 frame) centres another spot, `"fit": true` shows the whole picture smaller. A scene's `text` goes on a plate above the picture, and the cast stands as if there were no text.
- **Hard to read on a phone**: `table`, `doc`, `fields`, `flow` (the renderer warns). Turn a table into a `number` or a `chat`, a doc into a `quote` of its one line.
- **Not in a Short**: chapter cards, `subscribe`, `end`, the label, the logo and the progress bar (YouTube draws its own).
- **The first frame** is what people see in the feed and what the app offers as the cover: make slide 1 readable on its own.

## Packaging

`youtube.json` in the Short's folder, checked by `youtube-meta.mjs` (it sees `"format": "short"` in `style.json`):

- `title` ≤ 70 characters: the hook as a statement or a question, not the long video's title;
- `description`: 1–2 lines, the long video's URL, `#Shorts` and 2–3 topic hashtags;
- `longVideo`: the long video's URL; set it as the Short's **Related video** in Studio (no API sets it);
- `tags`, `language`, `containsSyntheticMedia`, `madeForKids` as for the long video;
- no chapters, no thumbnails.

Publish after the long video, a few days apart, and add each Short's URL to the topic sheet row's `related_links`.
