// Scene library for the `scene` slide layout: backgrounds, characters (the ghost mascot, a person,
// a robot) in poses, and props. Inlined by render-video.mjs where slide.html has /*SCENES*/.
//
// Everything is flat vector art in the theme's colours (CSS variables set by slide.html), so a scene matches
// every look: the brand palette, a story theme, or the MS Paint look (slide.html roughens it with #wobble).
// Groups carry classes the animation layer in slide.html moves: .bgl (background), .cloud, .star, .float,
// .aurora, .glow, and per character .pop (entrance) > .act (pose action) > .bob (idle), .arm, .eyes, .x (extras).
// .plx[data-depth] groups are the camera's depth layers (0 = far sky … 1 = the ground and the cast).
//
//   window.scene(spec, { textMode: 'none' | 'left' | 'top' }) →
//     { svg, dark, ground, cast: [{ who, pose, x, headTop, say }] }
//   window.SCENE = { backgrounds, characters, poses, props }
;(function () {
  const LINE = 'var(--sc-line)'
  const s = (fill, extra = '') =>
    `style="fill:${fill};stroke:${LINE};stroke-width:var(--sc-lw);stroke-linejoin:round;stroke-linecap:round;${extra}"`
  const nf = (fill, extra = '') => `style="fill:${fill};${extra}"`
  const ln = (color = LINE, w = 'var(--sc-lw)') =>
    `style="fill:none;stroke:${color};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round"`
  const mix = (a, p, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`
  const SKY = mix('var(--main)', 22, '#fff')
  const WALL = 'var(--sc-wall)'
  const FLOOR = 'var(--sc-floor)'
  const GREEN = '#6bb38a'
  const GREEN2 = '#4f9a72'

  // deterministic pseudo-random, so a scene renders the same every time
  const rng = (seed) => () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  // ---------- backgrounds (1920×1080). ground = the y characters stand on ----------
  const cloud = (x, y, k = 1) =>
    `<g class="cloud" transform="translate(${x} ${y}) scale(${k})"><path d="M-110 30 C-130 -10 -80 -40 -50 -22 C-40 -70 40 -74 52 -26 C90 -44 130 -6 108 30 Z" ${nf('#fff', 'opacity:.92')}/></g>`
  const skyline = (y, color, seed, lit) => {
    const r = rng(seed)
    let out = ''
    let x = -20
    while (x < 1940) {
      const w = 90 + Math.round(r() * 110)
      const h = 120 + Math.round(r() * 260)
      out += `<rect x="${x}" y="${y - h}" width="${w}" height="${h + 4}" ${nf(color)}/>`
      if (lit)
        for (let wy = y - h + 26; wy < y - 30; wy += 46)
          for (let wx = x + 18; wx < x + w - 24; wx += 34)
            if (r() < 0.38)
              out += `<rect x="${wx}" y="${wy}" width="14" height="20" rx="2" ${nf(lit)}/>`
      x += w + 8 + Math.round(r() * 20)
    }
    return out
  }
  const stars = (n, seed, maxY = 820) => {
    const r = rng(seed)
    let out = ''
    for (let i = 0; i < n; i++) {
      const x = Math.round(r() * 1920)
      const y = Math.round(r() * maxY)
      const rad = (1.5 + r() * 3.5).toFixed(1)
      out += `<circle class="star" cx="${x}" cy="${y}" r="${rad}" ${nf('#fff', 'opacity:' + (0.5 + r() * 0.5).toFixed(2))}/>`
    }
    return out
  }
  const plantArt = (x, y, k = 1) =>
    `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<path d="M-30 -150 C-90 -200 -110 -260 -70 -300 C-40 -250 -30 -200 -10 -150 Z" ${s(GREEN)}/>` +
    `<path d="M10 -150 C40 -230 100 -260 120 -300 C120 -230 80 -180 30 -150 Z" ${s(GREEN2)}/>` +
    `<path d="M-6 -150 C-20 -230 0 -300 20 -340 C40 -280 30 -210 14 -150 Z" ${s(GREEN)}/>` +
    `<path d="M-60 -150 L60 -150 L46 0 L-46 0 Z" ${s('var(--accent)')}/>` +
    `</g>`

  // ---------- layered worlds (illustrated-explainer look): flat vector, gradients, glow, depth layers ----------
  // These backgrounds return `layers` ([{depth, svg}], far → near) instead of one `svg`, so the camera can move
  // them at different speeds (parallax; slide.html › camera). depth 0 = the sky, 1 = the ground the cast stands
  // on (it moves with the cast, so feet never slide). Colours come from the theme, like every other scene.
  const lin = (id, stops, vertical = true) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">` +
    stops
      .map(([o, c, a = 1]) => `<stop offset="${o}" style="stop-color:${c};stop-opacity:${a}"/>`)
      .join('') +
    `</linearGradient>`
  const rad = (id, c, a = 0.85) =>
    `<radialGradient id="${id}"><stop offset="0" style="stop-color:${c};stop-opacity:${a}"/>` +
    `<stop offset="1" style="stop-color:${c};stop-opacity:0"/></radialGradient>`
  // a soft flat cloud with a lit rim (no outline)
  const pcloud = (x, y, k, fill, rim) =>
    `<g class="cloud" transform="translate(${x} ${y}) scale(${k})">` +
    `<path d="M-170 40 C-200 0 -150 -40 -100 -26 C-90 -86 0 -96 30 -40 C60 -76 150 -60 150 -6 C200 -6 210 40 170 40 Z" ${nf(fill)}/>` +
    `<path d="M-150 10 C-140 -18 -112 -26 -96 -20 C-80 -70 -4 -80 24 -30 C40 -54 100 -50 120 -18" ${ln(rim, 7)}/></g>`
  // a ridge line of peaks across the frame, filled down to the bottom
  const ridge = (base, h, n, seed, fill, snow) => {
    const r = rng(seed)
    let d = `M-40 ${base}`
    let caps = ''
    const step = 2000 / n
    for (let i = 0; i < n; i++) {
      const x0 = -40 + i * step
      const px = x0 + step * (0.35 + r() * 0.3)
      const py = base - h * (0.55 + r() * 0.45)
      d += ` L${px.toFixed(0)} ${py.toFixed(0)} L${(x0 + step).toFixed(0)} ${base - h * r() * 0.15}`
      if (snow) {
        const w = step * 0.16
        caps += `<path d="M${(px - w).toFixed(0)} ${(py + w * 0.9).toFixed(0)} L${px.toFixed(0)} ${py.toFixed(0)} L${(px + w).toFixed(0)} ${(py + w * 0.9).toFixed(0)} L${(px + w * 0.4).toFixed(0)} ${(py + w * 0.7).toFixed(0)} L${px.toFixed(0)} ${(py + w).toFixed(0)} L${(px - w * 0.5).toFixed(0)} ${(py + w * 0.65).toFixed(0)} Z" ${nf(snow)}/>`
      }
    }
    return `<path d="${d} L1960 1100 L-40 1100 Z" ${nf(fill)}/>` + caps
  }
  // a soft rolling band (hills or waves) with an optional bright crest line
  const band = (y, amp, waves, phase, fill, crest) => {
    let d = `M-60 ${y}`
    const seg = 2040 / waves
    for (let i = 0; i < waves; i++) {
      const x = -60 + i * seg
      const up = (i + phase) % 2 ? amp : -amp
      d += ` C${(x + seg * 0.35).toFixed(0)} ${y + up} ${(x + seg * 0.65).toFixed(0)} ${y + up} ${(x + seg).toFixed(0)} ${y}`
    }
    const top = d
    return (
      `<path d="${top} L1980 1100 L-60 1100 Z" ${nf(fill)}/>` +
      (crest ? `<path d="${top}" ${ln(crest, 5)} opacity=".8"/>` : '')
    )
  }
  const trees = (xs, base, color, k = 1) =>
    xs
      .map(
        (x) =>
          `<path d="M${x} ${base - 70 * k} L${x + 22 * k} ${base} L${x - 22 * k} ${base} Z" ${nf(color)}/>`
      )
      .join('')

  const WORLD = {
    // golden-hour valley: peach sky, a big low sun, misty ridges, a grassy foreground
    dawn: () => ({
      ground: 930,
      defs:
        lin('sc-dawn-sky', [
          [0, mix('var(--second)', 70, 'var(--main)')],
          [0.45, mix('var(--main)', 55, '#fff')],
          [0.78, mix('var(--accent)', 45, '#fff')],
          [1, mix('var(--accent)', 75, '#fff')]
        ]) + rad('sc-dawn-sun', mix('var(--accent)', 40, '#fff'), 0.9),
      layers: [
        {
          depth: 0,
          svg:
            `<rect width="1920" height="1080" fill="url(#sc-dawn-sky)"/>` +
            `<circle class="glow" cx="1400" cy="600" r="380" fill="url(#sc-dawn-sun)"/>` +
            `<circle cx="1400" cy="600" r="86" ${nf(mix('var(--accent)', 18, '#fff'))}/>`
        },
        {
          depth: 0.12,
          svg:
            pcloud(
              380,
              230,
              1.1,
              mix('var(--second)', 30, 'var(--accent)'),
              mix('var(--accent)', 30, '#fff')
            ) +
            pcloud(
              1020,
              150,
              0.8,
              mix('var(--second)', 35, 'var(--main)'),
              mix('var(--accent)', 40, '#fff')
            ) +
            pcloud(
              1700,
              330,
              0.7,
              mix('var(--second)', 30, 'var(--accent)'),
              mix('var(--accent)', 30, '#fff')
            )
        },
        {
          depth: 0.3,
          svg: ridge(
            700,
            230,
            7,
            21,
            mix('var(--main)', 38, '#fff'),
            mix('var(--accent)', 12, '#fff')
          )
        },
        {
          depth: 0.55,
          svg:
            band(770, 50, 4, 0, mix('var(--main)', 62, 'var(--second)')) +
            trees([210, 260, 1480, 1530, 1580], 760, mix('var(--main)', 45, 'var(--second)'), 0.9)
        },
        {
          depth: 1,
          svg: band(
            930,
            26,
            3,
            1,
            mix('var(--second)', 72, 'var(--main)'),
            mix('var(--accent)', 55, '#fff')
          )
        }
      ]
    }),
    // dusk at sea: teal sky to peach horizon, far icebergs, rolling wave bands with gold crests, an ice floe
    sea: () => ({
      ground: 930,
      defs:
        lin('sc-sea-sky', [
          [0, mix('var(--main)', 65, '#fff')],
          [0.62, mix('var(--accent)', 38, '#fff')],
          [1, mix('var(--accent)', 60, '#fff')]
        ]) +
        lin('sc-sea-water', [
          [0, mix('var(--main)', 70, '#fff')],
          [1, mix('var(--main)', 70, 'var(--second)')]
        ]) +
        rad('sc-sea-sun', mix('var(--accent)', 35, '#fff'), 0.8),
      layers: [
        {
          depth: 0,
          svg:
            `<rect width="1920" height="1080" fill="url(#sc-sea-sky)"/>` +
            `<circle class="glow" cx="300" cy="560" r="330" fill="url(#sc-sea-sun)"/>` +
            `<circle cx="300" cy="560" r="60" ${nf(mix('var(--accent)', 15, '#fff'))}/>` +
            `<rect y="560" width="1920" height="520" fill="url(#sc-sea-water)"/>`
        },
        {
          depth: 0.1,
          svg:
            pcloud(
              900,
              180,
              1,
              mix('var(--main)', 55, 'var(--second)'),
              mix('var(--accent)', 35, '#fff')
            ) +
            pcloud(
              1650,
              260,
              0.75,
              mix('var(--main)', 55, 'var(--second)'),
              mix('var(--accent)', 35, '#fff')
            )
        },
        {
          depth: 0.25,
          svg:
            `<path d="M1240 566 L1300 520 L1340 540 L1380 506 L1450 566 Z" ${nf(mix('var(--main)', 12, '#fff'))}/>` +
            `<path d="M1300 520 L1340 540 L1330 566 L1280 566 Z" ${nf(mix('var(--main)', 30, '#fff'))}/>` +
            `<path d="M1640 566 L1690 530 L1740 566 Z" ${nf(mix('var(--main)', 12, '#fff'))}/>` +
            `<path d="M80 566 L120 540 L150 552 L190 566 Z" ${nf(mix('var(--main)', 15, '#fff'))}/>`
        },
        {
          depth: 0.4,
          svg: band(640, 14, 6, 0, mix('var(--main)', 75, '#fff'), mix('var(--accent)', 55, '#fff'))
        },
        {
          depth: 0.6,
          svg: band(
            740,
            22,
            5,
            1,
            mix('var(--main)', 82, 'var(--second)'),
            mix('var(--accent)', 60, '#fff')
          )
        },
        {
          depth: 0.8,
          svg: band(
            860,
            30,
            4,
            0,
            mix('var(--main)', 62, 'var(--second)'),
            mix('var(--accent)', 65, '#fff')
          )
        },
        {
          depth: 1,
          svg:
            `<ellipse cx="960" cy="950" rx="560" ry="70" ${nf(mix('var(--main)', 30, '#fff'))}/>` +
            `<path d="M400 930 C520 905 1400 905 1520 930 C1400 952 520 952 400 930 Z" ${nf('#fff')}/>` +
            band(
              1040,
              18,
              4,
              1,
              mix('var(--main)', 50, 'var(--second)'),
              mix('var(--accent)', 60, '#fff')
            )
        }
      ]
    }),
    // polar night: deep sky, stars, glowing aurora ribbons, lavender peaks, a snowy foreground
    aurora: () => ({
      ground: 930,
      dark: true,
      defs:
        lin('sc-aur-sky', [
          [0, mix('var(--second)', 80, '#000')],
          [1, mix('var(--second)', 70, 'var(--main)')]
        ]) +
        lin(
          'sc-aur-band',
          [
            [0, '#7fffd4', 0],
            [0.3, mix('var(--main)', 40, '#7fffd4'), 0.85],
            [0.7, mix('#b48cff', 60, 'var(--main)'), 0.7],
            [1, '#b48cff', 0]
          ],
          false
        ) +
        `<filter id="sc-aur-blur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>`,
      layers: [
        {
          depth: 0,
          svg: `<rect width="1920" height="1080" fill="url(#sc-aur-sky)"/>${stars(120, 17, 760)}`
        },
        {
          depth: 0.1,
          svg:
            `<g filter="url(#sc-aur-blur)"><path class="aurora" d="M-100 330 C300 160 700 420 1050 250 S1700 170 2020 300" style="fill:none;stroke:url(#sc-aur-band);stroke-width:110"/>` +
            `<path class="aurora" d="M-100 470 C400 330 800 520 1200 380 S1800 360 2020 430" style="fill:none;stroke:url(#sc-aur-band);stroke-width:60;opacity:.6"/></g>`
        },
        {
          depth: 0.3,
          svg: ridge(
            760,
            300,
            6,
            9,
            mix('var(--second)', 52, '#b9b4e6'),
            mix('var(--second)', 12, '#fff')
          )
        },
        { depth: 0.6, svg: band(830, 40, 4, 0, mix('var(--second)', 30, '#cfd6f2')) },
        {
          depth: 1,
          svg: band(
            930,
            22,
            3,
            1,
            mix('var(--second)', 10, '#f2f5fc'),
            mix('var(--main)', 30, '#fff')
          )
        }
      ]
    })
  }

  const BG = {
    // nothing behind the cast: used to stand characters on top of a generated picture
    none: () => ({ ground: 930, svg: '' }),
    ...WORLD,
    plain: () => ({
      ground: 920,
      svg:
        `<ellipse cx="960" cy="935" rx="820" ry="34" ${nf(mix('var(--second)', 7, 'transparent'))}/>` +
        `<path d="M200 920 H1720" ${ln(mix('var(--second)', 30, 'transparent'), 5)}/>`
    }),
    desk: () => ({
      ground: 900,
      svg:
        `<rect width="1920" height="1080" ${nf(WALL)}/>` +
        // window with a small view
        `<g class="bgl"><rect x="1260" y="140" width="460" height="390" rx="20" ${s(SKY)}/>` +
        `<circle cx="1610" cy="250" r="46" ${nf('var(--accent)', 'opacity:.85')}/>` +
        `<path d="M1262 470 h60 v-70 h50 v-40 h60 v110 h50 v-60 h70 v60 h60 v-90 h70 v90 h36 v56 h-456 Z" ${nf(mix('var(--main)', 40, '#fff'))}/>` +
        `<path d="M1490 140 V530 M1260 335 H1720" ${ln()}/>` +
        `<rect x="1260" y="140" width="460" height="390" rx="20" ${s('none')}/></g>` +
        // shelf with books
        `<g class="bgl"><g transform="translate(0 -70)"><path d="M170 360 H640" ${ln(LINE, 10)}/>` +
        `<rect x="200" y="230" width="44" height="130" rx="6" ${s('var(--main)')}/>` +
        `<rect x="250" y="250" width="40" height="110" rx="6" ${s('var(--accent)')}/>` +
        `<rect x="296" y="220" width="50" height="140" rx="6" ${s(mix('var(--main)', 40, '#fff'))}/>` +
        `<rect x="372" y="262" width="120" height="44" rx="6" transform="rotate(-8 432 284)" ${s(mix('var(--accent)', 50, '#fff'))}/>` +
        `<circle cx="580" cy="320" r="38" ${s(GREEN)}/></g></g>` +
        `<rect y="900" width="1920" height="180" ${nf(FLOOR)}/>` +
        `<path d="M0 900 H1920" ${ln()}/>`
    }),
    office: () => ({
      ground: 900,
      svg:
        `<rect width="1920" height="1080" ${nf(WALL)}/>` +
        `<g class="bgl"><clipPath id="sc-win"><rect x="130" y="130" width="760" height="520" rx="18"/></clipPath>` +
        `<rect x="130" y="130" width="760" height="520" rx="18" ${s(SKY)}/>` +
        `<g clip-path="url(#sc-win)">${skyline(650, mix('var(--main)', 30, '#fff'), 11, null)}</g>` +
        `<path d="M383 130 V650 M637 130 V650 M130 390 H890" ${ln()}/>` +
        `<rect x="130" y="130" width="760" height="520" rx="18" ${s('none')}/></g>` +
        // whiteboard with a chart sketch
        `<g class="bgl"><rect x="1150" y="170" width="620" height="400" rx="14" ${s('#fff')}/>` +
        `<path d="M1210 510 V230 M1210 510 H1720" ${ln(mix('var(--second)', 60, '#fff'), 6)}/>` +
        `<rect x="1260" y="420" width="60" height="90" ${nf('var(--main)', 'opacity:.75')}/>` +
        `<rect x="1350" y="370" width="60" height="140" ${nf('var(--main)', 'opacity:.75')}/>` +
        `<rect x="1440" y="300" width="60" height="210" ${nf('var(--accent)')}/>` +
        `<path d="M1540 300 C1580 260 1620 290 1680 240" ${ln('var(--accent)', 7)}/>` +
        `<path d="M1300 588 H1620" ${ln(LINE, 10)}/></g>` +
        `<rect y="900" width="1920" height="180" ${nf(FLOOR)}/>` +
        `<path d="M0 900 H1920" ${ln()}/>` +
        plantArt(1820, 900, 0.85)
    }),
    city: () => ({
      ground: 920,
      svg:
        `<rect width="1920" height="1080" ${nf(SKY)}/>` +
        `<g class="bgl"><circle cx="1500" cy="240" r="110" ${nf('var(--accent)')}/>` +
        cloud(420, 210, 1.1) +
        cloud(1080, 140, 0.8) +
        cloud(1750, 380, 0.7) +
        skyline(860, mix('var(--main)', 32, '#fff'), 3, null) +
        skyline(920, mix('var(--main)', 70, 'var(--second)'), 7, mix('var(--accent)', 70, '#fff')) +
        `</g><rect y="920" width="1920" height="160" ${nf(mix('var(--second)', 80, 'var(--ground)'))}/>` +
        `<path d="M0 1000 H1920" style="fill:none;stroke:${mix('var(--ground)', 70, 'transparent')};stroke-width:8;stroke-dasharray:70 60"/>`
    }),
    night: () => ({
      ground: 920,
      dark: true,
      svg:
        `<rect width="1920" height="1080" ${nf(mix('var(--second)', 90, '#000'))}/>` +
        `<g class="bgl">${stars(90, 5, 700)}` +
        `<circle cx="1540" cy="230" r="95" ${nf('#f6f0d6')}/><circle cx="1505" cy="205" r="16" ${nf('#e3dcbd')}/><circle cx="1570" cy="265" r="11" ${nf('#e3dcbd')}/>` +
        skyline(920, mix('var(--second)', 70, '#000'), 9, mix('var(--accent)', 85, '#fff')) +
        `</g><rect y="920" width="1920" height="160" ${nf(mix('var(--second)', 60, '#000'))}/>`
    }),
    hills: () => ({
      ground: 930,
      svg:
        `<rect width="1920" height="1080" ${nf(mix('var(--main)', 16, '#fff'))}/>` +
        `<g class="bgl"><circle cx="1560" cy="230" r="100" ${nf('var(--accent)')}/>` +
        cloud(380, 200, 1) +
        cloud(1020, 300, 0.75) +
        `<path d="M-20 760 C300 560 620 600 900 720 C1200 560 1600 560 1940 720 V1100 H-20 Z" ${nf(mix(GREEN, 55, '#fff'))}/>` +
        `<g transform="translate(1640 800)"><rect x="-16" y="-120" width="32" height="130" rx="8" ${s('#a26b45')}/><circle cx="0" cy="-170" r="90" ${s(GREEN2)}/></g>` +
        `</g><path d="M-20 900 C400 860 1500 860 1940 900 V1100 H-20 Z" ${nf(GREEN)}/>` +
        `<path d="M-20 900 C400 860 1500 860 1940 900" ${ln(mix(GREEN2, 80, '#000'), 5)}/>`
    }),
    stage: () => ({
      ground: 900,
      dark: true,
      svg:
        `<rect width="1920" height="1080" ${nf(mix('var(--second)', 92, '#000'))}/>` +
        `<g class="bgl"><polygon class="spot" points="860,0 1060,0 1400,900 520,900" ${nf('#fff', 'opacity:.10')}/>` +
        `<ellipse cx="960" cy="905" rx="460" ry="50" ${nf('#fff', 'opacity:.12')}/>` +
        `<path d="M0 0 H330 C300 300 330 700 250 1080 H0 Z" ${nf(mix('var(--accent)', 55, '#7a1730'))}/>` +
        `<path d="M1920 0 H1590 C1620 300 1590 700 1670 1080 H1920 Z" ${nf(mix('var(--accent)', 55, '#7a1730'))}/>` +
        `<path d="M90 0 C80 400 110 700 60 1080 M190 0 C180 400 200 700 160 1080 M1830 0 C1840 400 1810 700 1860 1080 M1730 0 C1740 400 1720 700 1760 1080" ${ln('rgba(0,0,0,.25)', 8)}/>` +
        `<path d="M0 0 H1920 V70 C1600 120 320 120 0 70 Z" ${nf(mix('var(--accent)', 45, '#5a1022'))}/></g>` +
        `<rect y="900" width="1920" height="180" ${nf(mix('var(--second)', 70, '#3a2a1a'))}/>`
    }),
    space: () => ({
      ground: 930,
      dark: true,
      svg:
        `<rect width="1920" height="1080" ${nf(mix('var(--second)', 85, '#000'))}/>` +
        `<g class="bgl">${stars(140, 13, 1080)}` +
        `<circle cx="1500" cy="300" r="150" ${nf('var(--main)')}/>` +
        `<path d="M1440 220 C1500 240 1560 230 1620 250" ${ln('rgba(255,255,255,.25)', 14)}/>` +
        `<ellipse cx="1500" cy="300" rx="250" ry="52" transform="rotate(-14 1500 300)" style="fill:none;stroke:var(--accent);stroke-width:14"/>` +
        `<circle cx="330" cy="200" r="46" ${nf('#d8d4e8')}/><circle cx="318" cy="190" r="9" ${nf('#bdb7d2')}/></g>`
    })
  }

  // ---------- faces ----------
  // f = { x, y (eye line), dx (eye spacing), rx, ry, my (mouth y), ink, k (mouth scale), cheeks }
  const face = (f, expr, eyes) => {
    const ink = f.ink
    let e
    if (eyes === 'happy')
      e =
        `<path d="M${f.x - f.dx - f.rx} ${f.y + 4} Q${f.x - f.dx} ${f.y - f.ry - 4} ${f.x - f.dx + f.rx} ${f.y + 4}" ${ln(ink, 6)}/>` +
        `<path d="M${f.x + f.dx - f.rx} ${f.y + 4} Q${f.x + f.dx} ${f.y - f.ry - 4} ${f.x + f.dx + f.rx} ${f.y + 4}" ${ln(ink, 6)}/>`
    else {
      const up = eyes === 'up' ? -5 : 0
      const big = eyes === 'wide' ? 1.3 : 1
      e = [-1, 1]
        .map(
          (sd) =>
            `<ellipse cx="${f.x + sd * f.dx + (eyes === 'up' ? 3 : 0)}" cy="${f.y + up}" rx="${f.rx * big}" ry="${f.ry * big}" ${nf(ink)}/>` +
            (f.shine
              ? `<circle cx="${f.x + sd * f.dx + f.rx * 0.35}" cy="${f.y + up - f.ry * 0.4}" r="${f.rx * 0.36}" ${nf('#fff')}/>`
              : '')
        )
        .join('')
      if (eyes === 'sad')
        e +=
          `<path d="M${f.x - f.dx - f.rx - 4} ${f.y - f.ry - 8} L${f.x - f.dx + f.rx} ${f.y - f.ry - 16}" ${ln(ink, 5)}/>` +
          `<path d="M${f.x + f.dx + f.rx + 4} ${f.y - f.ry - 8} L${f.x + f.dx - f.rx} ${f.y - f.ry - 16}" ${ln(ink, 5)}/>`
    }
    const k = f.k || 1
    const M = {
      smile: `<path d="M${-17 * k} ${-4 * k} Q0 ${16 * k} ${17 * k} ${-4 * k}" ${ln(ink, 5.5)}/>`,
      grin: `<path d="M${-20 * k} ${-6 * k} Q0 ${28 * k} ${20 * k} ${-6 * k} Z" ${nf(ink)}/>`,
      flat: `<path d="M${-16 * k} ${2 * k} Q${-6 * k} ${-5 * k} ${2 * k} ${2 * k} T${18 * k} ${2 * k}" ${ln(ink, 5.5)}/>`,
      o: `<ellipse cx="0" cy="${2 * k}" rx="${9 * k}" ry="${12 * k}" ${nf(ink)}/>`,
      frown: `<path d="M${-15 * k} ${8 * k} Q0 ${-8 * k} ${15 * k} ${8 * k}" ${ln(ink, 5.5)}/>`,
      side: `<path d="M${-4 * k} ${2 * k} Q${6 * k} ${-3 * k} ${15 * k} ${0}" ${ln(ink, 5.5)}/>`
    }
    const cheeks = f.cheeks
      ? [-1, 1]
          .map(
            (sd) =>
              `<ellipse cx="${f.x + sd * f.cheeks[0]}" cy="${f.cheeks[1]}" rx="${f.cheeks[2]}" ry="${f.cheeks[3]}" ${nf('var(--accent)', 'opacity:.45')}/>`
          )
          .join('')
      : ''
    return (
      cheeks +
      `<g class="eyes">${e}</g>` +
      `<g transform="translate(${f.x} ${f.my})">${M[expr] || M.smile}</g>`
    )
  }

  // ---------- extras over the head: ? · shock lines · sparkles · thought dots · drop ----------
  const spark = (x, y, r, c) =>
    `<path class="x" d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" ${nf(c)}/>`
  const extra = (kind, top, hw) => {
    if (kind === '?')
      return `<text class="x" x="${hw * 1.05}" y="${top + 70}" style="font:900 96px var(--display), Georgia, serif;fill:var(--accent);stroke:${LINE};stroke-width:3;paint-order:stroke">?</text>`
    if (kind === 'lines')
      return `<g class="x"><path d="M${-hw * 0.9} ${top + 10} l-26 -30 M0 ${top - 18} v-36 M${hw * 0.9} ${top + 10} l26 -30" ${ln('var(--accent)', 9)}/></g>`
    if (kind === 'sparkles')
      return (
        spark(-hw * 1.05, top + 10, 22, 'var(--accent)') +
        spark(hw * 1.1, top - 10, 28, 'var(--accent)') +
        spark(hw * 0.4, top - 50, 16, 'var(--main)')
      )
    // a thought: two small trailing dots, then a cloud with "…" in it (loose circles alone read as stray bubbles)
    if (kind === 'dots')
      return (
        `<circle class="x" cx="${hw * 0.72}" cy="${top - 2}" r="7" ${s('#fff')}/>` +
        `<circle class="x" cx="${hw * 0.95}" cy="${top - 28}" r="11" ${s('#fff')}/>` +
        `<g transform="translate(${hw * 1.32} ${top - 82})"><g class="x">` +
        `<path d="M-46 16 A20 20 0 0 1 -36 -18 A27 27 0 0 1 10 -32 A23 23 0 0 1 48 -8 A18 18 0 0 1 38 20 Z" ${s('#fff')}/>` +
        [-16, 0, 16].map((dx) => `<circle cx="${dx}" cy="-2" r="4.5" ${nf(LINE)}/>`).join('') +
        `</g></g>`
      )
    if (kind === 'drop')
      return `<path class="x drop" d="M${hw * 0.85} ${top + 60} q-16 26 0 36 q16 -10 0 -36 Z" ${s('#7ec8f2')}/>`
    return ''
  }

  // ---------- poses: arm angles (degrees out from hanging down; negative = across the body) ----------
  const POSES = {
    neutral: { L: 14, R: 14, mouth: 'smile' },
    wave: { L: 14, R: 150, mouth: 'grin', act: 'wave' },
    talk: { L: 14, R: 60, mouth: 'grin', act: 'talk' },
    point: { L: 14, R: 95, mouth: 'smile', act: 'point' },
    shrug: { L: 70, R: 70, mouth: 'flat', extra: '?', act: 'shrug' },
    shock: { L: 150, R: 150, mouth: 'o', eyes: 'wide', extra: 'lines', act: 'jump' },
    think: { L: 14, R: -140, mouth: 'side', eyes: 'up', extra: 'dots', act: 'think' },
    cheer: { L: 155, R: 155, mouth: 'grin', eyes: 'happy', extra: 'sparkles', act: 'hop' },
    sad: { L: 4, R: 4, mouth: 'frown', eyes: 'sad', extra: 'drop', act: 'droop' }
  }

  // ---------- characters: drawn with the feet at 0,0, about 300 units tall ----------
  // arm(): a limb hanging down from the shoulder (0,0); rotated by the pose
  const armG = (side, x, y, angle, inner, rest) =>
    `<g transform="translate(${x} ${y})"><g class="arm arm${side}" data-a="${angle}" data-rest="${rest}" style="transform:rotate(${side === 'L' ? angle : -angle}deg)">${inner}</g></g>`

  const CHAR = {
    // the ghost: a friendly mascot (the default lead; the config's look.mascot can pick another)
    ghost: (p, o) => {
      const k = 1.4
      // a rounded little arm (closed at the shoulder too: it sits over the body, so a flat end would show)
      const nub = `<path d="M-14 0 A14 14 0 0 1 14 0 C16 24 9 48 0 60 C-9 48 -16 24 -14 0 Z" ${s('var(--sc-ghost)')}/>`

      const body =
        `<path d="M-80 0 V-132 A80 80 0 0 1 80 -132 V0 q-13.3 -18 -26.7 0 q-13.3 18 -26.7 0 q-13.3 -18 -26.7 0 q-13.3 18 -26.7 0 q-13.3 -18 -26.7 0 q-13.3 18 -26.7 0 Z" ${s('var(--sc-ghost)')}/>` +
        `<path d="M40 -196 A80 80 0 0 1 77 -132 V-16 Q62 -40 58 -118 Q54 -170 40 -196 Z" ${nf(mix(LINE, 14, 'transparent'))}/>`
      const f = face(
        {
          x: 0,
          y: -136,
          dx: 26,
          rx: 10,
          ry: 15,
          my: -100,
          ink: 'var(--sc-ink)',
          shine: true,
          cheeks: [46, -104, 13, 7]
        },
        p.mouth,
        p.eyes
      )
      return {
        k,
        top: -212 * k,
        hw: 80 * k,
        float: true,
        art:
          // the arms are drawn over the body's edge (behind it, only white slivers showed, like stray bubbles);
          // the face stays on top of them
          `<g transform="scale(${k})">` +
          body +
          armG('L', -64, -92, p.L, nub, 14) +
          armG('R', 64, -92, p.R, nub, 14) +
          f +
          `</g>`
      }
    },
    person: (p, o) => {
      const shirt = o.color || 'var(--main)'
      const skin = o.skin || '#f2c6a2'
      const hair = o.hair || 'var(--second)'
      const arm =
        `<path d="M-15 -4 L-15 90 A15 15 0 0 0 15 90 L15 -4 A15 15 0 0 0 -15 -4 Z" ${s(shirt)}/>` +
        `<circle cx="0" cy="100" r="17" ${s(skin)}/>`
      const f = face(
        {
          x: 0,
          y: -256,
          dx: 19,
          rx: 6.5,
          ry: 8,
          my: -230,
          ink: 'var(--sc-ink)',
          k: 0.85,
          cheeks: [33, -236, 9, 5]
        },
        p.mouth,
        p.eyes
      )
      return {
        top: -316,
        hw: 60,
        art:
          `<rect x="-44" y="-100" width="34" height="100" rx="14" ${s(mix(hair, 85, '#000'))}/>` +
          `<rect x="10" y="-100" width="34" height="100" rx="14" ${s(mix(hair, 85, '#000'))}/>` +
          `<rect x="-64" y="-212" width="128" height="134" rx="46" ${s(shirt)}/>` +
          `<circle cx="0" cy="-258" r="56" ${s(skin)}/>` +
          `<path d="M-58 -262 C-62 -332 62 -332 58 -262 C46 -296 -6 -300 -30 -284 C-40 -280 -52 -272 -58 -262 Z" ${s(hair)}/>` +
          f +
          armG('L', -56, -192, p.L, arm, 14) +
          armG('R', 56, -192, p.R, arm, 14)
      }
    },
    robot: (p, o) => {
      const metal = o.color || mix('var(--main)', 22, '#fff')
      const arm =
        `<path d="M-13 -4 L-13 78 A13 13 0 0 0 13 78 L13 -4 A13 13 0 0 0 -13 -4 Z" ${s(metal)}/>` +
        `<circle cx="0" cy="88" r="16" ${s(mix(metal, 70, 'var(--second)'))}/>`
      const f = face(
        { x: 0, y: -266, dx: 24, rx: 9, ry: 12, my: -240, ink: 'var(--accent)', k: 0.9 },
        p.mouth,
        p.eyes
      )
      return {
        top: -352,
        hw: 66,
        art:
          `<rect x="-42" y="-70" width="28" height="70" rx="8" ${s(mix(metal, 70, 'var(--second)'))}/>` +
          `<rect x="14" y="-70" width="28" height="70" rx="8" ${s(mix(metal, 70, 'var(--second)'))}/>` +
          `<rect x="-72" y="-206" width="144" height="144" rx="24" ${s(metal)}/>` +
          `<circle cx="0" cy="-140" r="20" ${s('var(--accent)')}/>` +
          `<path d="M0 -316 V-342" ${ln()}/><circle cx="0" cy="-350" r="11" ${s('var(--accent)')}/>` +
          `<rect x="-66" y="-318" width="132" height="104" rx="28" ${s(metal)}/>` +
          `<rect x="-50" y="-302" width="100" height="72" rx="18" ${nf('var(--sc-screen)')}/>` +
          f +
          armG('L', -74, -186, p.L, arm, 14) +
          armG('R', 74, -186, p.R, arm, 14)
      }
    }
  }

  // ---------- props: on the ground at 0,0 ----------
  const PROPS = {
    laptop: () =>
      `<rect x="-110" y="-150" width="220" height="18" rx="6" ${s(mix('var(--second)', 40, '#8a6a4a'))}/>` +
      `<path d="M-90 -132 V0 M90 -132 V0" ${ln(LINE, 12)}/>` +
      `<rect x="-86" y="-300" width="172" height="122" rx="12" ${s(mix('var(--second)', 80, '#fff'))}/>` +
      `<rect x="-72" y="-288" width="144" height="98" rx="6" ${nf(mix('var(--main)', 35, '#fff'))}/>` +
      `<path d="M-60 -264 H20 M-60 -240 H50 M-60 -216 H0" ${ln('#fff', 8)}/>` +
      `<path d="M-104 -178 H104 L92 -152 H-92 Z" ${s(mix('var(--second)', 60, '#fff'))}/>`,
    plant: () => plantArt(0, 0, 0.75),
    chart: () =>
      `<path d="M-80 0 L-40 -150 M80 0 L40 -150" ${ln(LINE, 10)}/>` +
      `<rect x="-120" y="-340" width="240" height="200" rx="10" ${s('#fff')}/>` +
      `<rect x="-92" y="-210" width="40" height="50" ${nf('var(--main)', 'opacity:.6')}/>` +
      `<rect x="-36" y="-250" width="40" height="90" ${nf('var(--main)', 'opacity:.8')}/>` +
      `<rect x="20" y="-300" width="40" height="140" ${nf('var(--accent)')}/>` +
      `<path d="M-100 -158 H100" ${ln(LINE, 5)}/>`,
    books: () =>
      `<rect x="-90" y="-40" width="180" height="40" rx="6" ${s('var(--main)')}/>` +
      `<rect x="-76" y="-78" width="160" height="38" rx="6" ${s('var(--accent)')}/>` +
      `<rect x="-84" y="-114" width="150" height="36" rx="6" ${s(mix('var(--main)', 40, '#fff'))}/>`,
    bulb: () =>
      `<g class="float"><g transform="translate(0 -420)">` +
      `<path d="M-60 -10 C-60 -90 60 -90 60 -10 C60 25 30 40 26 70 H-26 C-30 40 -60 25 -60 -10 Z" ${s('#fff3a8')}/>` +
      `<rect x="-26" y="70" width="52" height="34" rx="6" ${s(mix('var(--second)', 40, '#fff'))}/>` +
      `<path d="M-100 -40 l-30 -10 M100 -40 l30 -10 M0 -110 v-34 M-74 -96 l-22 -24 M74 -96 l22 -24" ${ln('var(--accent)', 8)}/>` +
      `</g></g>`,
    trophy: () =>
      `<rect x="-70" y="-60" width="140" height="60" rx="8" ${s(mix('var(--second)', 70, '#fff'))}/>` +
      `<rect x="-16" y="-120" width="32" height="64" ${s('#f2c14e')}/>` +
      `<path d="M-80 -260 H80 C80 -170 40 -130 0 -124 C-40 -130 -80 -170 -80 -260 Z" ${s('#f2c14e')}/>` +
      `<path d="M-80 -236 C-130 -236 -126 -170 -66 -168 M80 -236 C130 -236 126 -170 66 -168" ${ln()}/>`,
    boxes: () =>
      `<rect x="-110" y="-110" width="130" height="110" rx="6" ${s('#d2a679')}/>` +
      `<rect x="20" y="-90" width="100" height="90" rx="6" ${s('#c4956a')}/>` +
      `<rect x="-80" y="-200" width="110" height="90" rx="6" ${s('#d9b48c')}/>` +
      `<path d="M-45 -110 V-60 M70 -90 V-50 M-25 -200 V-160" ${ln(LINE, 5)}/>`,
    papers: () =>
      `<rect x="-90" y="-28" width="180" height="28" rx="4" ${s('#fff')}/>` +
      `<rect x="-84" y="-54" width="170" height="26" rx="4" ${s('#fff')}/>` +
      `<rect x="-94" y="-80" width="176" height="26" rx="4" ${s('#fff')}/>` +
      `<g class="float"><rect x="40" y="-220" width="90" height="116" rx="6" transform="rotate(18 85 -162)" ${s('#fff')}/>` +
      `<path d="M58 -190 h50 M56 -170 h54 M54 -150 h40" transform="rotate(18 85 -162)" ${ln(mix(LINE, 50, '#fff'), 5)}/></g>`,
    server: () =>
      `<rect x="-90" y="-330" width="180" height="330" rx="14" ${s(mix('var(--second)', 85, '#fff'))}/>` +
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="-70" y="${-310 + i * 78}" width="140" height="60" rx="8" ${s(mix('var(--second)', 60, '#fff'))}/>` +
            `<circle class="star" cx="44" cy="${-280 + i * 78}" r="8" ${nf(i % 2 ? 'var(--accent)' : '#7ee2a8')}/>` +
            `<path d="M-50 ${-280 + i * 78} H10" ${ln('rgba(255,255,255,.6)', 6)}/>`
        )
        .join('')
  }

  // where the cast stands: x per member, scale; textMode left = one figure on the right
  const slots = (n, textMode) => {
    if (textMode === 'left') return { xs: [1440, 1720, 1160].slice(0, n), k: n > 1 ? 0.95 : 1.3 }
    const k = { 1: 1.45, 2: 1.3, 3: 1.12 }[n] || 1
    const xs = { 1: [960], 2: [660, 1260], 3: [480, 960, 1440] }[n] || [960]
    return { xs, k: textMode === 'top' ? k * 0.78 : k }
  }

  const parseMember = (m) => {
    if (typeof m === 'string') {
      const [who, pose] = m.split(':')
      return { who, pose }
    }
    return m || {}
  }

  window.scene = function (S, o = {}) {
    const textMode = o.textMode || 'none'
    // bg: a name from BG, or { prompt | src, dark, ground } for a generated / given picture (S._bg, a data URL)
    const named = typeof S.bg === 'string' ? S.bg : S._bg ? 'image' : 'plain'
    const bo = S.bg && typeof S.bg === 'object' ? S.bg : {}
    const bg =
      named === 'image'
        ? {
            ground: bo.ground || 930,
            dark: !!bo.dark,
            svg: `<image href="${S._bg}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>`
          }
        : (BG[named] || BG.plain)()
    const ground = S.ground || bg.ground
    const cast = (
      Array.isArray(S.cast) ? S.cast : S.cast ? [S.cast] : [{ who: o.mascot || 'ghost' }]
    )
      .map(parseMember)
      .slice(0, 3)
    const { xs, k } = slots(cast.length, textMode)
    const placed = []
    let figs = ''
    cast.forEach((m, i) => {
      const who = CHAR[m.who] ? m.who : 'ghost'
      const poseName = POSES[m.pose] ? m.pose : 'neutral'
      let pose = { ...POSES[poseName] }
      const x = m.x ?? xs[i]
      // point and think toward the middle of the frame: a figure on the right uses its left arm
      if (x > 960 && (poseName === 'point' || poseName === 'talk' || poseName === 'wave'))
        pose = { ...pose, L: pose.R, R: pose.L }
      const c = CHAR[who](pose, m)
      const sc = (m.size || 1) * k
      const ex = pose.extra ? extra(pose.extra, c.top, c.hw) : ''
      figs +=
        `<g class="fig fig-${who}" data-act="${pose.act || ''}" data-float="${c.float ? 1 : 0}" transform="translate(${x} ${ground}) scale(${sc})">` +
        `<ellipse cx="0" cy="6" rx="${c.hw * 0.85}" ry="12" ${nf('rgba(0,0,0,.16)')} class="shadow"/>` +
        `<g class="pop"><g class="act"><g class="bob"><g${c.float ? ' transform="translate(0 -14)"' : ''}>${c.art}${ex}</g></g></g></g></g>`
      placed.push({
        who,
        pose: poseName,
        x,
        headTop: ground + c.top * sc - (c.float ? 14 * sc : 0),
        say: m.say
      })
    })
    // props: in free spots along the ground, away from the cast and (textMode left) from the text
    const props = (Array.isArray(S.props) ? S.props : S.props ? [S.props] : []).slice(0, 3)
    const free = (textMode === 'left' ? [1100, 1780, 1240] : [250, 1670, 960, 700, 1220]).filter(
      (fx) => placed.every((p) => Math.abs(p.x - fx) > 260)
    )
    const AT = { left: 250, right: 1670, center: 960 }
    let propSvg = ''
    props.forEach((pr, i) => {
      const p = typeof pr === 'string' ? { prop: pr } : pr
      const draw = PROPS[p.prop]
      if (!draw) return
      const px = typeof p.at === 'number' ? p.at : (AT[p.at] ?? free[i] ?? 250 + i * 300)
      propSvg += `<g class="prop" transform="translate(${px} ${ground}) scale(${p.size || 1})"><g class="pin">${draw()}</g></g>`
    })
    // depth groups (.plx) for the camera: a layered world keeps its layers; any other background is one layer
    // at depth 1, so it moves with the cast (the floor never slides under their feet)
    const bgLayers = bg.layers || [{ depth: 1, svg: bg.svg }]
    return {
      svg:
        `<svg class="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">` +
        (bg.defs ? `<defs>${bg.defs}</defs>` : '') +
        `<g class="bgall">${bgLayers.map((l) => `<g class="plx" data-depth="${l.depth}">${l.svg}</g>`).join('')}</g>` +
        `<g class="plx" data-depth="1">${propSvg}${figs}</g></svg>`,
      dark: !!bg.dark,
      layered: !!bg.layers,
      ground,
      cast: placed
    }
  }
  window.sceneIsDark = (S) =>
    typeof S.bg === 'string' ? !!(BG[S.bg] && BG[S.bg]().dark) : !!(S.bg && S.bg.dark)
  window.sceneIsLayered = (S) => typeof S.bg === 'string' && !!WORLD[S.bg]
  window.SCENE = {
    backgrounds: Object.keys(BG),
    worlds: Object.keys(WORLD),
    characters: Object.keys(CHAR),
    poses: Object.keys(POSES),
    props: Object.keys(PROPS)
  }
})()
