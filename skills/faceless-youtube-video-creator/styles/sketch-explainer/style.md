# Sketch explainer

A calm, hand-drawn explainer: pencil and ink sketches on warm paper, one visual metaphor per idea. Everyday struggles (work, learning, habits, money, AI at work) told through a person and the thing that weighs on them.

## Source

| Field     | Value                                                                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference | one frame from a hand-drawn explainer video (2026-11): a stressed person running with a toppling stack of books, diplomas and briefcases past a grey crowd                                                                                                                                                             |
| Checked   | the frame itself (palette from `moodboard.mjs`: cream `#f2e7d3`, graphite `#6a645b`–`#bfb6a7`, ink, ochre accents on the briefcases). The video, its channel and its narration were not identified: nothing here copies them                                                                                           |
| Picture   | **generated illustrations carry this look** (`illustrations: true`): the `imageStyle` in `style.json` describes it (`imageStyleDay` with day pictures: the same sketch without the dark vignette). Without them, slides fall back to vector `scene`s in the paper palette, which read as a clean cartoon, not a sketch |

Reference frames live in `images/` (local only, gitignored).

## Look

Cream paper ground with grain and a soft vignette (`grain` texture), near-black ink for text and dark slides, graphite for numbers and bold, one ochre accent for highlights. Patrick Hand for everything (hand lettering, but readable). No logo, no progress bar; "Chapter n" labels (in the video's language).

## Narration

- Second person, empathetic, unhurried: "You've got three courses half done and a fourth in the cart."
- **One metaphor per idea**, drawn as the idea's main picture and named in the voice once: the stack that topples, the backpack of stones, the tangled cable, the full inbox as a flood.
- Each idea: the struggle (picture) → why it happens (plain mechanism) → the proof (a real artifact or a named study, on a `doc` or `table` slide, never drawn) → what to do instead → a bridge question.
- Ends quiet: the opening picture again, lighter ("same person, one book in hand").

## Slides

- Pace 2–3. An `illustration` (or a `scene` without generated pictures) for each metaphor, about one slide in three; `statement` and `quote` slides between them; `doc` / `table` for the proof.
- Write illustration prompts as one moment with one subject: "a person running past a grey crowd with a toppling stack of books and two glowing ochre briefcases". Never ask for text in a picture.
- Keep the background grey and the subject inked; colour only the thing the idea is about.

## Product screens

`"screenTreat": "sketch"` (greyscale on paper) for real screenshots, or a `mock` when a drawn UI fits the story better (labelled as recreated).

## Avoid

- Copying the reference: its frames, characters or compositions. Borrow the technique (ink subject, grey crowd, ochre accent), not the drawing.
- Busy pictures: one subject, one metaphor, lots of paper.
- Drawn "proof": screens, charts or answers are real artifacts on proof slides, never illustrations.
