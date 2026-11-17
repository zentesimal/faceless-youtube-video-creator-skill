# Contributing

Maintained by [Zentesimal](https://zentesimal.com/?utm_source=github&utm_medium=oss&utm_campaign=faceless-youtube-video-creator-skill). Issues and pull requests are welcome; we read every one, usually within a week.

## Run it locally

1. `npm install --prefix skills/faceless-youtube-video-creator` and `npx playwright install chromium`.
2. Install `ffmpeg` and Python 3.10+.
3. In an empty folder, copy `skills/faceless-youtube-video-creator/references/faceless-youtube.config.example.json` to `faceless-youtube.config.json`, write a short `videos/test/script.md` (see `references/video-playbook.md`), and run:

   ```bash
   node <repo>/skills/faceless-youtube-video-creator/scripts/render-video.mjs videos/test --slides
   ```

## Pull requests

- One change per PR, with a before/after (a slide PNG, a frame strip or a short clip) when it changes how videos look.
- Keep the skill generic: anything specific to one channel goes in the config, a preset or a `channel.md`, not in the code.
- No new network calls without saying why in the README's Requirements, and nothing that phones home.
- New fonts or assets need their licence file next to them and a row in `THIRD_PARTY.md`.
