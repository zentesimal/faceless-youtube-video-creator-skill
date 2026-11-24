# Illustrated explainer

An animated, illustration-first explainer: full-bleed flat-vector worlds (gradient skies, layered hills and seas, soft glow), a camera that drifts through them with parallax, floating particles, map-style pins and glowing paths, and the mascot acting inside the picture. The narration carries the facts; the screen carries a picture, rarely a sentence.

## Source

| Field     | Value                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reference | an animated, illustrated science explainer on YouTube (2026-11), watched as a style reference                                                                                                                                                                                                                                                                                                                            |
| Checked   | a handful of frames across the video. Seen: flat vector art with no outlines, gradient skies (indigo → violet → peach), atmospheric layers (far ridges lighter and bluer), glowing light, snow and dust particles, a slow camera with foreground blur, a map with round pins, a glowing ring around a spot, a recurring mascot, almost no on-screen text. The narration was not read: the narration rules below are ours |
| Picture   | free: the layered vector backgrounds `aurora`, `sea` and `dawn` (`scene` slides, parallax included). Richer: **generated illustrations** in this preset's `imageStyle`, best as `layers` (a backdrop and one or two cut-outs) so the camera has depth to move through                                                                                                                                                    |

Reference frames live in `images/` (local only, gitignored).

## Look

Pale-ice ground (`#eef3f4`) for the few text slides, deep indigo (`#1c1f4a`) for text and dark punches, teal (`#2f7f9a`) for numbers, warm orange (`#f2994a`) for highlights, pins and glows. Inter for everything, bold. `soft` texture: a clean vignette, no grain. Characters keep a thin 3 px line (`outline`) so a light mascot reads on light skies. No logo, no progress bar.

The preset turns on `"camera": "auto"`: every `illustration`, and every `scene` on a layered world (`aurora`, `sea`, `dawn`), drifts slowly with parallax. Other scenes and text slides keep the normal entrances.

## Narration

- One continuous story, told to one viewer: a question, a reveal, the mechanism, the surprise, what it means for them. Second person, curious, plain words.
- **Picture first.** Each sentence gets a picture that acts it out; the text slide is the exception (the line to remember, one number, a real artifact).
- **The mascot is the guide.** Your mascot (the config's `look.mascot`; the ghost by default) appears in the hook, at each reveal (`point`, `shock`, `cheer`) and at the subscribe ask; it never explains in a bubble what the voice already says (a bubble is a reaction: ≤ 5 words).
- **Maps and diagrams over lists.** Where another look would write three bullets, draw a place with three pins, one path that draws itself, or a `flow` diagram (a process, a loop, a concept and its parts), built one box per sentence.

## Slides

- Pace 4 (the default here) or 5. About two slides in three are `scene` or `illustration`; the rest are `word`, `statement`, `number` and the proof slides (`doc`, `table`, `chat`, `image`), which stay real artifacts.
- Vary the world: never the same background twice in a row; alternate day (`dawn`, `sea`) and night (`aurora`). Give each its particles: `snow` or `stars` at night, `dust` or `bokeh` at dawn, `sparkle` on a win.
- `marks` carry the information a list would: a `pin` per item (≤ 4, with a 1–3 word `label`), one `path` for a journey or a flow, a `ring` on the thing to look at, an `arrow` from cause to effect. Keep them clear of the cast and of the text.
- When the items lead into each other, use a `flow` instead (over a world with `bg`, so it stays in the picture): `cycle` for a loop, `hub` for a concept and its parts, `auto` for a process; `reveal: "build"` to grow it with the voice.
- Steer the camera on purpose at least once per idea: `{"to": [x, y], "zoom": 1.25}` pushes into the pin or ring the voice is talking about; `pan-right` follows a path.
- With generated illustrations: write `layers` as one backdrop (sky, far scenery, ground plane; no characters) plus one or two cut-outs (a foreground rock or ice floe, a midground island, a tree), each a separate prompt. Put the mascot in with `cast`, never in the prompt, so it looks the same in every shot and can act.
  - Tested 2026-11-17 (one backdrop + two cut-outs, about 80 s to generate): the backdrop comes back opaque and the cut-outs as RGBA with soft glow edges, and they stack cleanly (no boxes or seams; a cut-out island's own patch of water blends into the backdrop sea). Two things to watch: the model leans painterly rather than flat vector, so the drawn mascot can look flatter than the world around it; and every cut-out comes back in the middle of its frame, whatever the prompt asks, so place it with the layer's `x`, `y` and `scale`, put the ring on that spot and the figure's `x` on the empty side (checked again 2026-11-17 on four shots).

## Product screens

A `screen` with `"treat": "tint"` sits better between the illustrations; keep them for proof and let the pictures carry the story.

## Avoid

- Copying the reference: its characters (its mascot is theirs; yours is your own), its compositions, maps, colours as a set, titles or wording. Borrow the techniques only: layered depth, glow, particles, pins, a moving camera.
- Text over pictures beyond a short plate; paragraphs on screen.
- Busy frames: one subject, one mark to look at, empty sky around it.
- Drawn "proof": screens, charts with real numbers or AI answers are real artifacts on proof slides, never illustrations.
