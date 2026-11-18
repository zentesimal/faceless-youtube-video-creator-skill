# Channel brief

**Example.** The skill's first-run setup writes your own copy to `channel/channel.md` in your project (`paths.channel` in `faceless-youtube.config.json`), filled from your answers, next to the rest of your channel kit (logo, avatar, banner, Studio settings); this file is the template and the fallback. It's written for a practical-AI channel: adapt every line.

The one place that says what the channel is about. The script's channel reminders, the subscribe asks, the description footer and the thumbnails all come from here. **Edit this file when the channel changes**, not the scripts.

## Identity

| Field         | Value                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel name  | My Channel                                                                                                                                                                                        |
| Handle        | `<handle>` (without the @; shown on the Subscribe slide and in the footer link)                                                                                                                   |
| Avatar        | - (optional path, relative to your project, to the channel's profile picture; brand look falls back to the logo, story look to the channel's initial)                                             |
| Narrator      | an AI voice (picked at the start of each video; `af_heart` by default) reading the script over slides (your brand look, or the no-branding story look), in first person: "I tested…", "we built…" |
| Promise       | Practical AI, tested on real work: how LLMs really work, how to use them well, where they break, and the hacks that save real time.                                                               |
| Audience      | people who use ChatGPT, Claude, Gemini & co. at work and want to get more out of them: operators, support and ops leads, founders, curious builders. Not ML researchers.                          |
| Language      | Asked per video: English (default) or Spanish                                                                                                                                                     |
| Upload rhythm | say "every week" only if the user confirms it; otherwise "regularly"                                                                                                                              |

## Content pillars

Every video belongs to exactly one pillar. Topic candidates that fit none are dropped.

| Pillar            | What a video here does                                                   | Example angles                                                                            |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **How LLMs work** | explains one mechanism in plain words, with a demo that makes it visible | tokens and why models miscount letters, context windows, temperature, why models "forget" |
| **How to use AI** | teaches a workflow the viewer can copy today                             | writing prompts that survive reuse, AI for meeting notes, building a personal assistant   |
| **Limitations**   | shows where AI fails, why, and what to do instead (honest, not doom)     | hallucinated sources, math, long documents, confident wrong answers, privacy              |
| **AI hacks**      | a surprising technique with a before/after on screen                     | role + rubric prompts, self-critique loops, "ask me questions first", structured output   |

## Channel reminder lines (rotate, adapt; never read the same one twice in a video)

Short, said in passing, never a pitch. One in the **intro**, one again in the **outro**.

- "On this channel I test what AI can actually do, and where it falls apart, so you don't have to."
- "This channel is about using AI for real work: how it works, how to use it, and where it breaks."
- "Everything here gets tested on real work. No hype, just what works."
- "If you use ChatGPT or Claude at work, this channel is the manual nobody gave you."

## Subscribe asks (rotate, adapt)

Placed at the **mid hook** (after the viewer has already got value) and in the **outro**. Never in the first 60 s. Tie the ask to a reason, not a favour.

- Mid hook: "If idea two already saved you some time, subscribing is how you get the next test. Now, the next one is the one most people get wrong…"
- Mid hook: "Quick one: if you're getting something out of this, hit subscribe. It's free, and it's how I know to make more of these."
- Outro: "If you want the next experiment, subscribe. I test one AI thing like this every video."
- Outro: "Subscribe if you want more AI that's actually been tested, not just talked about."

Don't ask for likes, comments and the bell all at once. One ask per moment; a comment prompt ("tell me which hack you'll try") is fine in the outro as a second line.

## Company or sponsor mentions

If the channel belongs to a company (`identity.company` in the config), mention it at most **once** per video, only where it is a genuine example ("we run this on our own support inbox, and this is the failure we see most"), never as a pitch: no pricing, no "book a demo". The logo on the thumbnail corner and the end screen is enough.

## Description footer (paste under every description)

```
About this channel: practical AI, tested on real work. How LLMs work, how to use them, where they break, and the hacks that save real time.
Subscribe for the next test: https://www.youtube.com/@<handle>?sub_confirmation=1
```

Replace `<handle>` once the channel handle is known, and drop this note.
