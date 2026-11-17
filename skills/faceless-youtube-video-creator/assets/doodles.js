// Shared doodle library (MS Paint-style drawings) for slide.html and thumbnail.html.
// The renderers inline this file where a template has /*DOODLES*/. Each doodle is plain SVG with thick black
// ink and flat Paint colours; the templates roughen it with the #wobble filter. Illustrations only, never a
// picture of a real screen.
;(function () {
  // ---------- doodles: MS Paint-style drawings, drawn as plain SVG and roughened by the #wobble filter.
  // Flat Paint colours, thick black ink. They are illustrations, never pictures of a real screen.
  const PAINT = {
    red: '#ed1c24',
    orange: '#ff7f27',
    yellow: '#fff200',
    green: '#22b14c',
    blue: '#00a2e8',
    indigo: '#3f48cc',
    purple: '#a349a4',
    pink: '#ffaec9',
    gray: '#c3c3c3',
    brown: '#b97a57',
    white: '#ffffff'
  }
  const ink = 'stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"'
  const f = (c) => `fill="${PAINT[c] || c}" ${ink}`
  const line = (d) => `<path d="${d}" fill="none" ${ink}/>`
  const txt = (x, y, t, size = 64, c = '#111') =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${c}" style="font-family:var(--display)">${t}</text>`
  const DOODLES = {
    sheet: () =>
      `<rect x="40" y="40" width="320" height="230" ${f('white')}/><rect x="40" y="40" width="320" height="50" ${f('blue')}/>` +
      line('M40 136h320M40 182h320M40 228h320M150 40v230M260 40v230') +
      line('M178 112l14 14 26-30') +
      line('M178 158l14 14 26-30') +
      `<path d="M180 200l34 22M214 200l-34 22" fill="none" stroke="#ed1c24" stroke-width="9" stroke-linecap="round"/>`,
    pages: () =>
      `<rect x="110" y="60" width="190" height="230" transform="rotate(-10 205 175)" ${f('white')}/>` +
      `<rect x="110" y="50" width="190" height="230" transform="rotate(6 205 165)" ${f('white')}/>` +
      `<rect x="105" y="40" width="190" height="230" ${f('white')}/>` +
      txt(200, 185, '?', 110, '#c3c3c3'),
    brochure: () =>
      `<path d="M60 70l100-24v220l-100 24z" ${f('pink')}/><path d="M160 46l90 24v220l-90-24z" ${f('white')}/><path d="M250 70l100-24v220l-100 24z" ${f('pink')}/>` +
      `<circle cx="205" cy="120" r="26" ${f('yellow')}/>` +
      line('M180 210l25-30 25 30M175 240h60'),
    robot: () =>
      line('M200 50v-24') +
      `<circle cx="200" cy="22" r="14" ${f('red')}/>` +
      `<rect x="110" y="50" width="180" height="130" rx="18" ${f('gray')}/>` +
      `<circle cx="160" cy="105" r="18" ${f('blue')}/><circle cx="240" cy="105" r="18" ${f('blue')}/>` +
      line('M160 148h80M180 140v16M200 140v16M220 140v16') +
      `<rect x="130" y="190" width="140" height="95" rx="14" ${f('blue')}/>` +
      line('M130 220l-46 30M270 220l46 30'),
    camera: () =>
      `<rect x="60" y="100" width="280" height="170" rx="22" ${f('gray')}/><rect x="120" y="70" width="80" height="34" rx="6" ${f('gray')}/>` +
      `<circle cx="200" cy="185" r="60" ${f('white')}/><circle cx="200" cy="185" r="34" ${f('blue')}/><rect x="280" y="120" width="34" height="22" ${f('yellow')}/>` +
      line('M60 30l30 30M340 30l-30 30M200 10v34'),
    checklist: () =>
      `<rect x="90" y="40" width="220" height="250" rx="16" ${f('brown')}/><rect x="112" y="68" width="176" height="204" ${f('white')}/><rect x="160" y="26" width="80" height="34" rx="10" ${f('gray')}/>` +
      line('M130 110l14 14 24-28M190 112h80M130 170l14 14 24-28M190 172h80') +
      `<path d="M132 220l30 30M162 220l-30 30" fill="none" stroke="#ed1c24" stroke-width="9" stroke-linecap="round"/>` +
      line('M190 236h80'),
    magnifier: () =>
      `<circle cx="170" cy="140" r="90" ${f('blue')}/><circle cx="170" cy="140" r="58" ${f('white')}/>` +
      `<path d="M236 206l80 80" stroke="#111" stroke-width="40" stroke-linecap="round"/><path d="M236 206l80 80" stroke="#b97a57" stroke-width="22" stroke-linecap="round"/>`,
    question: () =>
      `<path d="M60 60h280a20 20 0 0 1 20 20v130a20 20 0 0 1-20 20H170l-60 50v-50H60a20 20 0 0 1-20-20V80a20 20 0 0 1 20-20z" ${f('yellow')}/>` +
      txt(200, 190, '?', 130),
    button: () =>
      `<rect x="50" y="90" width="300" height="100" rx="40" ${f('green')}/>` +
      txt(200, 158, 'Advanced?', 44, '#fff') +
      `<path d="M250 170l0 100 26-24 20 44 22-10-20-44 34-2z" ${f('white')}/>`,
    browser: () =>
      `<rect x="40" y="40" width="320" height="230" rx="14" ${f('white')}/>` +
      line('M40 92h320') +
      `<circle cx="78" cy="66" r="11" ${f('red')}/><circle cx="112" cy="66" r="11" ${f('yellow')}/><circle cx="146" cy="66" r="11" ${f('green')}/>` +
      `<rect x="80" y="130" width="130" height="40" rx="10" ${f('blue')}/>` +
      line('M80 210h220M80 240h160') +
      `<path d="M190 160l0 80 22-20 16 36 18-8-16-36 28-2z" ${f('white')}/>`,
    person: () =>
      `<circle cx="200" cy="70" r="42" ${f('pink')}/>` +
      line('M200 112v100M200 140l-60 40M200 140l60 40M200 212l-50 70M200 212l50 70') +
      line('M184 66h1M216 66h1M186 86q14 12 28 0'),
    trash: () =>
      `<path d="M110 100h180l-20 180H130z" ${f('gray')}/><rect x="90" y="76" width="220" height="30" rx="8" ${f('gray')}/>` +
      line('M170 60h60M160 130l10 120M200 130v120M240 130l-10 120'),
    clock: () =>
      `<circle cx="200" cy="155" r="120" ${f('white')}/>` +
      line('M200 155V80M200 155l55 30') +
      `<circle cx="200" cy="155" r="10" fill="#111"/>` +
      line('M200 46v14M200 250v14M92 155h14M294 155h14'),
    warning: () => `<path d="M200 30l170 260H30z" ${f('yellow')}/>` + txt(200, 255, '!', 150),
    bulb: () =>
      `<path d="M200 30a100 100 0 0 0-60 180v30h120v-30a100 100 0 0 0-60-180z" ${f('yellow')}/>` +
      `<rect x="150" y="240" width="100" height="40" rx="10" ${f('gray')}/>` +
      line('M60 80l30 16M340 80l-30 16M200 0v14'),
    book: () =>
      `<path d="M200 70c-50-30-110-30-160-10v210c50-20 110-20 160 10z" ${f('purple')}/><path d="M200 70c50-30 110-30 160-10v210c-50-20-110-20-160 10z" ${f('white')}/>` +
      line('M230 110h100M230 150h100M230 190h80'),
    score: () =>
      `<circle cx="200" cy="150" r="125" ${f('green')}/>` + txt(200, 185, '100', 110, '#fff'),
    refresh: () =>
      line('M300 120a110 110 0 0 0-200-10M100 190a110 110 0 0 0 200 10') +
      `<path d="M86 60l14 54 52-18z" ${f('green')}/><path d="M314 250l-14-54-52 18z" ${f('green')}/>`,
    tag: () =>
      `<path d="M60 110h220l70 50-70 50H60z" ${f('orange')}/>` +
      txt(170, 182, 'worker', 56) +
      `<path d="M70 160h200" stroke="#ed1c24" stroke-width="12" stroke-linecap="round"/>`,
    inbox: () =>
      `<path d="M60 150l50-90h180l50 90v120H60z" ${f('blue')}/><path d="M60 150h90l20 40h60l20-40h90" fill="none" ${ink}/>` +
      `<rect x="140" y="20" width="120" height="90" ${f('white')}/>` +
      line('M160 48h80M160 76h60')
  }
  const doodle = (name) =>
    `<svg class="doodle" viewBox="0 -20 400 330">${(DOODLES[name] || DOODLES.question)()}</svg>`
  window.doodle = doodle
  window.DOODLE_NAMES = Object.keys(DOODLES)
})()
