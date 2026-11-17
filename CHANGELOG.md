# Changelog

## 0.1.0 (unreleased)

First public release.

- Topic to finished video, 8–20 minutes long (asked per video): a typed topic, a row from your topic sheet, or a brainstorm from a CSV; script in a fixed structure with subscribe asks, slides with a local AI voiceover (Kokoro), subtitles, real chapter times, titles and description, two A/B thumbnails.
- Beats: a longer pause (≈ 0.6 s) after the hook's promise, lines marked `> BEAT` and every section's conclusion, so viewers take each chunk in; `"beat": 0` turns them off.
- `youtube.json` with every upload field (title, description with chapters, tags, category, language, made-for-kids and altered-content answers, thumbnails, subtitles, pinned comment), checked against YouTube's limits by `youtube-meta.mjs` (local; nothing is uploaded).
- Optional research step before scripting: findings in `research.md` with a numbered, checkable source list the user approves; the script and the description cite it.
- Language asked per video (English or Spanish for now): script, slides, voices, subtitles, titles, description and thumbnails follow it; the renderer stops if the voice speaks another language.
- First-run setup writes `faceless-youtube.config.json` and `channel.md` in your project.
- Looks: `clean` (your palette, fonts and logo) and `paint-explainer` (MS Paint-style hand drawings); new looks from an inspiration folder.
- Thumbnail layouts in styles common on the home feed (`question`, `title`, `mood`, `card`) over the same scenes as the slides; Anton and Oswald bundled.
- Pace 1–5, optional animations (entrances, count-ups, self-drawing doodles, acting characters), `scene` slides with a mascot, people, robots, 8 backgrounds and props.
- Optional generated illustrations with the OpenAI Image API.
- Optional Zentesimal integration: topics from real customer questions.
