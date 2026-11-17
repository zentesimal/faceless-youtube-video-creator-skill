# Style presets

One folder per look. Each one names **where its imagery comes from** and how the video should sound, so a new video can say "same as the paint one" instead of rebuilding a theme. The setup question (SKILL.md §1b) offers every folder here as a look option.

```
styles/<name>/
├── style.json   # the preset: style ("brand" | "story"), theme, and optional defaults (pace, gap, sectionGap, maxPause, animate, imageStyle)
├── style.md     # imagery source, narration rules, slide rules, what to avoid
└── images/      # optional reference images for the moodboard (keep them local: don't commit other people's work)
```

A video uses one with `$W/style.json`:

```json
{ "preset": "paint-explainer", "pace": 3, "voice": "am_michael" }
```

The preset is the base; anything in `$W/style.json` wins (the `theme` is merged key by key). `voice` is still asked per video, so presets don't set it.

## Presets

| Folder            | Imagery source                                                             | Narration                                                                      |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `clean` (default) | your real artifacts and screenshots, scenes; your palette, fonts and logo  | how-to, ideas as a numbered list                                               |
| `paint-explainer` | MS Paint-style hand drawings (`paint` texture, doodles, wobbly-ink scenes) | one continuous story: cold open, paradox, named studies, analogies, plot twist |

The project config's `look.preset` picks the default; a video's `style.json` can pick another.

## Adding a preset

1. `mkdir styles/<name>/images` and drop 6–12 reference frames or images in `images/` (screenshots you took, your own art, licensed stock). They stay local.
2. Run the moodboard: `node ${CLAUDE_SKILL_DIR}/scripts/moodboard.mjs styles/<name>/images --out styles/<name>`. Read `moodboard-sheet.png` and the images.
3. Write `style.json` (optionally an `imageStyle`: one paragraph describing the look for generated illustrations; without it one is built from the theme colours) (theme roles as in SKILL.md §1b: `ground`, `second` ≥ 4.5:1 on ground, `main` ≥ 3:1, `accent`) and `style.md` (source, mood, palette roles, type, texture, narration rules, slide rules, avoid list).
4. From a YouTube video you admire: describe its devices in your own words (structure, pacing, how it uses pictures); if a transcript tool is connected, read the transcript for the narration. Take frames yourself for the palette. Record only what you could check, and never copy its words.

Rules:

- **Reference only.** Images in `images/` shape the palette, type and texture. They never appear in a video, a thumbnail or `$W/assets/`, and they're never committed: other people's frames aren't yours to redistribute.
- **Don't imitate a channel.** A preset borrows a feel (palette family, pacing, narrative devices), not someone's identity: no copied titles, catchphrases, logos, characters or artwork.
- Proof slides stay real in every look (your files, sheets, prompts, real screenshots).
