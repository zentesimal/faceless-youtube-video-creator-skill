# Paint explainer

A narrated documentary feel in a hand-drawn MS Paint style: one continuous story that turns a "why is it like this?" question into a chain of discoveries, each pinned to a real study.

## Picture

**MS Paint-style hand drawings**, made with the `paint` texture: white canvas, thick wobbly black ink, flat Paint colours, hand lettering (Permanent Marker and Patrick Hand, bundled with their licences), a yellow marker highlight, `doodle` slides and `scene` slides drawn in the same wobbly ink.

To tune it: adjust `style.json` (canvas, ink and marker in `theme`; the Paint colours of the doodles in `assets/doodles.js`), or build a new preset from your own reference images (`styles/README.md`).

## Narration

The whole video is one uninterrupted voiceover, no section breaks heard as pauses. What makes it work:

1. **Cold open in the second person, on an everyday moment**, then the absurdity, with numbers that make it concrete.
2. **A paradox stated as stakes**: why hasn't this been fixed / deleted / replaced already? A real quote from a named expert seals it.
3. **One more turn before the intro ends**: "but here's the part nobody mentions".
4. **Every claim pinned to a study**: who, where, when, which journal, then what they did, then what they saw. The description lists the DOIs.
5. **One everyday analogy per mechanism**, said once, then used.
6. **Spoken bridges instead of pauses**: each section ends on the question the next one answers.
7. **Escalation and a late plot twist** that reframes the title, then the ending answers the title.
8. **The subscribe ask comes once, near the end.** (The skill also asks for a mid-hook ask: say it as one bridged sentence without breaking the story.)

## How to write a script in this style

- The seven sections stay (script-stats still passes); the headings are never "felt". The intro is two or three sentences inside the story, the channel line said in passing.
- Each idea = a discovery: situation (what people assumed), the study (who, when, where, what they did), what they found, what it means, a bridge question.
- Every study named on screen must be real and checked (web search, the paper's DOI in `brief.md` and the description). For your own topics, "the study" can be your own data (a planning sheet, your counts), labelled as yours.
- Numbers said the way a person says them; one analogy per idea, no more.

## Slides

- Pace 3 by default: slow push-ins, short crossfades, nothing faster; the voice carries it.
- `scene` slides for moments with characters (the person at 11 p.m., the robot shrugging): in this look they're drawn with thick wobbly ink. Generated illustrations, when on, use the MS Paint image style.
- A `doodle` for every scene, object and analogy (the customer at 11 p.m., the missing button, the photographer's shot list): about one slide in three. Hand-drawn pictures are the look; text-only slides carry the turns.
- Then `statement`, `word` and `quote` (the expert's line, with `by`). A `number` for each striking figure. Lists rarely, and built up (`reveal`).
- Each cited study gets a `doc` slide styled as a citation card: `file` = journal and year, `lines` = authors, institution, one line on what they found. Real citations only.
- Chapter cards read as "Chapter n" (story look); keep titles as questions when it fits ("Why can't half the brain sleep?").

## Voice

Not fixed: asked per video. A calm, steady narrator suits it (`am_michael`, or `af_heart` for warmth). Continuity settings in `style.json`: 0.05 s between slides, 0.2 s between sections, pauses inside a line capped at 0.2 s.

## Avoid

- Copying another channel: its titles, catchphrases, sign-off or artwork. Borrow devices, not words.
- Invented studies, invented quotes, or a study's finding stretched beyond what it showed.
- Stock-photo slides or generated "science" pictures pretending to be real data.
