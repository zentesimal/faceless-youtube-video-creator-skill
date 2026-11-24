// Product screens for slide.html, inlined by render-video.mjs.
//
// Two layouts share one engine:
//   screen  a real screenshot (captured by scripts/capture-screens.mjs, or a picture you have) in a browser,
//           window or phone frame, in the look's colours; counts as proof.
//   mock    a UI recreated in the look's own style from real labels (a small kit: sidebar, breadcrumb, cards,
//           rows, toggles, fields, tables, buttons, a dialog, a toast). Always labelled "Recreated from <app>";
//           never proof.
//
// Both take `move`: one step or a list of steps. A step's parts run in this order:
//   zoom   "<target>" | [x, y, w, h] | "out"   the camera frames that box (image pixels)
//   spot   "<target>" | [x, y, w, h] | false   dims the rest, outlines the box
//   cursor "<target>" | [x, y, w, h] | [x, y]  the cursor travels there on an arc
//   click  true                                 it presses, a ripple opens
//   then   "<state>"                            the next real state (after the click) fades in
// Consecutive cues on the same shot or mock continue: the renderer passes the earlier cues as S._history, and
// the camera, the state, the spotlight and the cursor start where the previous cue left them.
//
// window.screens.build(S, box, ctx) draws the slide in its end state (what a still frame shows);
// window.screens.anim(S, sp) returns paused Web Animations from the start state to that end state.
;(function () {
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    )
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  const el = (tag, cls, parent, html) => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (html != null) e.innerHTML = html
    if (parent) parent.appendChild(e)
    return e
  }
  const TXT = {
    en: { shot: 'Screenshot', recreated: 'Recreated from', illustrative: 'illustrative UI' },
    es: { shot: 'Captura', recreated: 'Recreado de', illustrative: 'interfaz ilustrativa' }
  }
  const CURSOR =
    '<svg viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.6-4.4 2.9 6.6 2.9-1.3-2.9-6.5H19z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>'
  // durations of each part of a step, ms
  const D = { zoom: 1300, spot: 520, cursor: 900, press: 260, ripple: 620, swap: 480, gap: 120 }
  const MAX_ZOOM = 3.2

  let issues = []
  let cur = null // what anim() needs from build(): the plan, the elements, the start and end states

  const stepsOf = (S) =>
    (S.move == null ? [] : Array.isArray(S.move) ? S.move : [S.move]).filter(
      (m) => m && typeof m === 'object'
    )

  // ---------- geometry (image pixels) ----------
  // a view is the rect of the picture that fills the viewport; its aspect is always the viewport's
  const geo = (w, h, A) => {
    const full = (() => {
      let vw = w
      let vh = w / A
      if (vh > h) {
        vh = h
        vw = h * A
      }
      return { x: (w - vw) / 2, y: (h - vh) / 2, w: vw, h: vh }
    })()
    const clamp = (v) => {
      const r = { ...v }
      r.w = Math.min(r.w, full.w)
      r.h = r.w / A
      r.x = Math.min(Math.max(0, r.x), w - r.w)
      r.y = Math.min(Math.max(0, r.y), h - r.h)
      return r
    }
    // frame a box: padded, the viewport's aspect, no closer than MAX_ZOOM
    const around = (b) => {
      // padding from the box's short side, so a wide row still gets a real zoom
      const pad = Math.min(b[2], b[3]) * 0.6 + Math.min(w, h) * 0.03
      let vw = b[2] + pad * 2
      let vh = b[3] + pad * 2
      if (vw / vh < A) vw = vh * A
      else vh = vw / A
      vw = Math.max(vw, full.w / MAX_ZOOM)
      vh = vw / A
      return clamp({ x: b[0] + b[2] / 2 - vw / 2, y: b[1] + b[3] / 2 - vh / 2, w: vw, h: vh })
    }
    // the whole picture, or (a portrait viewport on a landscape picture) the part around a focus box
    const start = (focus) =>
      focus ? clamp({ ...full, x: focus[0] + focus[2] / 2 - full.w / 2 }) : full
    return { full, around, start }
  }
  const same = (a, b) =>
    !!a && !!b && ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 0.5)

  // ---------- the plan: replay the earlier cues, then this one's steps ----------
  function plan(S, model) {
    const { states, boxOf, g } = model
    const firstState = states[0].name
    const focusOf = (s) => (S.focus ? boxOf(S.focus, s) : null)
    let st = { state: firstState, view: g.start(focusOf(firstState)), spot: null, cursor: null }
    const cut = (cue) => {
      if (cue.state && cue.state !== st.state) {
        if (!states.some((x) => x.name === cue.state)) issues.push(`unknown state "${cue.state}"`)
        else st = { ...st, state: cue.state, spot: null }
      }
    }
    const apply = (cue, ops) => {
      let t = 0
      for (const step of stepsOf(cue)) {
        if (step.zoom != null) {
          const b = step.zoom === 'out' || step.zoom === 'fit' ? null : boxOf(step.zoom, st.state)
          const to = b ? g.around(b) : g.start(focusOf(st.state))
          if (!same(to, st.view)) {
            if (st.spot || st.cursor) {
              ops?.push({ k: 'clear', t, spot: st.spot, cursor: st.cursor, view: st.view })
              t += 200
            }
            ops?.push({ k: 'cam', t, from: st.view, to })
            t += D.zoom + D.gap
            st = { ...st, view: to, spot: null, cursor: null }
          }
        }
        if (step.spot !== undefined) {
          const b = step.spot === false || step.spot === null ? null : boxOf(step.spot, st.state)
          if (b || st.spot) {
            ops?.push({ k: 'spot', t, from: st.spot, to: b, view: st.view })
            t += D.spot + D.gap
          }
          st = { ...st, spot: b }
        }
        if (step.cursor != null) {
          const b = boxOf(step.cursor, st.state)
          if (b) {
            const pt = [b[0] + b[2] / 2, b[1] + b[3] / 2]
            ops?.push({ k: 'cursor', t, from: st.cursor, to: pt, view: st.view })
            t += D.cursor + D.gap
            st = { ...st, cursor: pt }
          }
        }
        if (step.click) {
          if (!st.cursor)
            issues.push('`click` needs a `cursor` target first (in this step or before)')
          else {
            ops?.push({ k: 'click', t, at: st.cursor, view: st.view })
            t += D.press + 140
          }
        }
        if (step.then) {
          if (!states.some((x) => x.name === step.then))
            issues.push(
              `\`then\`: unknown state "${step.then}" (states: ${states.map((x) => x.name).join(', ')})`
            )
          else if (step.then !== st.state) {
            // the next state is another picture: unless the step says `"keep": true` (a menu opening in
            // place), the camera eases back out to it while it fades in
            const back = step.keep ? st.view : g.start(focusOf(step.then))
            ops?.push({ k: 'swap', t, from: st.state, to: step.then, spot: st.spot, view: st.view })
            if (!same(back, st.view)) {
              ops?.push({ k: 'cam', t: t + 120, from: st.view, to: back, d: D.zoom })
              t += 120 + D.zoom + D.gap
              st = { ...st, view: back, cursor: null }
            } else t += D.swap + D.gap
            st = { ...st, state: step.then, spot: null }
          }
        }
      }
      return t
    }
    for (const h of S._history || []) {
      cut(h)
      apply(h, null)
    }
    // a cue with its own `state` cuts to it: that's where this slide starts
    cut(S)
    const start = { ...st }
    const ops = []
    const length = apply(S, ops)
    return { start, end: st, ops, length }
  }

  // ---------- frame ----------
  // .scr (the window: a bar, the viewport) + .scr-foot (source credit or the "recreated" label, caption)
  function frame(S, box, ctx, model) {
    const kind = S.frame || model.frame
    const wrap = el('div', 'scr-area', box)
    const win = el('div', 'scr frame-' + kind + (S.layout === 'mock' ? ' is-mock' : ''), wrap)
    let bar = null
    if (kind === 'browser' || kind === 'window') {
      bar = el('div', 'scr-bar', win, '<i></i><i></i><i></i>')
      if (kind === 'browser' && model.url) el('span', 'scr-url', bar, esc(model.url))
      else if (S.windowTitle) el('span', 'scr-wt', bar, esc(S.windowTitle))
    }
    const view = el('div', 'scr-view', win)
    const foot = el('div', 'scr-foot', box)
    const L = TXT[ctx.lang] || TXT.en
    if (S.layout === 'mock')
      el(
        'span',
        'scr-recreated',
        foot,
        '✎ ' + esc(L.recreated) + ' ' + esc(S.app || 'the app') + ' · ' + esc(L.illustrative)
      )
    else if (model.source) el('span', 'scr-src', foot, esc(L.shot) + ' · ' + esc(model.source))
    if (S.caption) el('span', 'scr-cap', foot, rich(S.caption))
    // size the window: the largest box of the viewport's aspect that fits the area
    const ar = wrap.getBoundingClientRect()
    const barH = bar ? bar.getBoundingClientRect().height : 0
    const pad = kind === 'phone' ? 28 : 0
    const availW = ar.width - pad * 2
    const availH = ar.height - barH - pad * 2
    const imgA = model.w / model.h
    // a portrait viewport (a Short) crops a landscape picture instead of shrinking it to a strip
    const A = ctx.vertical ? Math.min(imgA, Math.max(0.72, availW / availH)) : imgA
    let vw = availW
    let vh = vw / A
    if (vh > availH) {
      vh = availH
      vw = vh * A
    }
    vw = Math.floor(vw)
    vh = Math.floor(vw / A)
    view.style.width = vw + 'px'
    view.style.height = vh + 'px'
    if (!bar && kind !== 'phone' && kind !== 'none') win.style.borderRadius = '18px'
    return { win, view, A, vw, vh }
  }

  // ---------- recreated UI (mock) ----------
  // a 1120×660 page; page: {app, url, nav, active, crumbs, heading, tabs, tab, blocks, cols, dialog, toast}; S.states: {name:
  // partial page}. Every element can take an `id`: the moves target it, like a screenshot's targets.
  const MOCK_W = 1120
  const MOCK_H = 660
  const btn = (b, parent) => {
    const o = typeof b === 'string' ? { text: b } : b || {}
    const e = el(
      'span',
      'mk-btn' + (o.primary ? ' primary' : '') + (o.danger ? ' danger' : ''),
      parent
    )
    e.innerHTML = esc(o.text || '')
    if (o.id) e.dataset.id = o.id
    return e
  }
  const pill = (t, parent) => {
    const s = String(t)
    const tone = /^(on|active|live|done|approved|published|enabled|activo|publicado)$/i.test(s)
      ? ' good'
      : /^(off|failed|error|rejected|paused|inactivo|pausado)$/i.test(s)
        ? ' bad'
        : ''
    return el('span', 'mk-chip' + tone, parent, esc(s))
  }
  const toggle = (on, parent) => el('span', 'mk-toggle' + (on ? ' on' : ''), parent, '<i></i>')
  const withId = (e, o) => {
    if (o && o.id) e.dataset.id = o.id
    return e
  }
  function blocks(list, parent) {
    for (const b of list || []) {
      if (b == null) continue
      if (typeof b === 'string') {
        el('p', 'mk-text', parent, rich(b))
        continue
      }
      if (b.card != null || b.rows) {
        const c = withId(el('div', 'mk-card card', parent), b)
        if (b.card) {
          const hd = el('div', 'mk-card-h', c)
          el('span', 'mk-card-t', hd, esc(b.card))
          if (b.chip) pill(b.chip, hd)
          if (b.button) btn(b.button, hd).classList.add('right')
        }
        if (b.sub) el('div', 'mk-sub', c, rich(b.sub))
        for (const r of b.rows || []) {
          const o = typeof r === 'string' ? { text: r } : r
          const row = withId(el('div', 'mk-row', c), o)
          const tx = el('div', 'mk-row-t', row, rich(o.text || ''))
          if (o.sub) el('div', 'mk-sub', tx, rich(o.sub))
          // a row's controls are targets of their own: <id>-chip, <id>-toggle, <id>-button
          const sub = (e, k) => {
            if (o.id) e.dataset.id = o.id + '-' + k
          }
          if (o.chip) sub(pill(o.chip, row), 'chip')
          if (o.toggle != null) sub(toggle(o.toggle, row), 'toggle')
          if (o.button) sub(btn(o.button, row), 'button')
        }
        if (b.buttons) {
          const bs = el('div', 'mk-buttons', c)
          for (const x of b.buttons) btn(x, bs)
        }
      } else if (b.toggle != null) {
        const row = withId(el('div', 'mk-row solo', parent), b)
        const tx = el('div', 'mk-row-t', row, rich(b.toggle))
        if (b.sub) el('div', 'mk-sub', tx, rich(b.sub))
        const tg = toggle(b.on, row)
        if (b.id) tg.dataset.id = b.id + '-toggle'
      } else if (b.field != null) {
        const f = withId(el('label', 'mk-field', parent), b)
        el('span', 'mk-k', f, esc(b.field))
        el(
          'span',
          'mk-input' + (b.area ? ' area' : '') + (b.value ? '' : ' empty'),
          f,
          rich(b.value || b.placeholder || '')
        )
      } else if (b.select != null) {
        const f = withId(el('label', 'mk-field', parent), b)
        el('span', 'mk-k', f, esc(b.select))
        el('span', 'mk-input select', f, rich(b.value || ''))
      } else if (b.table) {
        const t = withId(el('div', 'mk-card card mk-tablecard', parent), b)
        const tb = el('table', 'mk-table', t)
        const hr = el('tr', '', el('thead', '', tb))
        for (const c of b.table.columns || []) el('th', '', hr, esc(c))
        const body = el('tbody', '', tb)
        ;(b.table.rows || []).forEach((r, i) => {
          const tr = el('tr', (b.table.mark || []).includes(i) ? 'mark' : '', body)
          if (b.table.ids && b.table.ids[i]) tr.dataset.id = b.table.ids[i]
          for (const cell of r) {
            const td = el('td', '', tr)
            const m = String(cell).match(/^\[(.+)\]$/)
            if (m) pill(m[1], td)
            else td.innerHTML = rich(cell)
          }
        })
      } else if (b.stats) {
        const row = withId(el('div', 'mk-stats', parent), b)
        for (const s of b.stats) {
          const c = withId(el('div', 'mk-card card mk-stat', row), s)
          el('div', 'mk-stat-v', c, esc(s.value))
          el('div', 'mk-stat-k', c, esc(s.label || ''))
        }
      } else if (b.buttons) {
        const bs = withId(el('div', 'mk-buttons', parent), b)
        for (const x of b.buttons) btn(x, bs)
      } else if (b.chat) {
        const c = withId(el('div', 'mk-card card mk-chat', parent), b)
        for (const m of b.chat)
          el('div', 'mk-bubble ' + (m.role === 'user' ? 'user' : 'ai'), c, rich(m.text))
      } else if (b.text != null) withId(el('p', 'mk-text', parent, rich(b.text)), b)
    }
  }
  function mockPage(P, holder) {
    const page = el('div', 'mk-page', holder)
    page.style.width = MOCK_W + 'px'
    page.style.height = MOCK_H + 'px'
    if (P.nav) {
      const side = el('div', 'mk-side', page)
      const brand = el('div', 'mk-brand', side)
      el('span', 'mk-logo', brand, esc((P.app || '?').trim().charAt(0).toUpperCase()))
      el('span', '', brand, esc(P.app || ''))
      for (const n of P.nav) {
        const o = typeof n === 'string' ? { text: n } : n
        withId(el('div', 'mk-nav' + (o.text === P.active ? ' on' : ''), side, esc(o.text)), o)
      }
    }
    const main = el('div', 'mk-main', page)
    if (P.crumbs) {
      const top = el('div', 'mk-top', main)
      el('span', 'mk-crumbs', top, P.crumbs.map(esc).join(' <i>›</i> '))
      el('span', 'mk-avatar', top)
    }
    if (P.heading || P.tabs) {
      const hd = el('div', 'mk-head', main)
      if (P.heading) el('h2', '', hd, rich(P.heading))
      if (P.tabs) {
        const tabs = el('div', 'mk-tabs', hd)
        for (const t of P.tabs) {
          const o = typeof t === 'string' ? { text: t } : t
          withId(el('span', 'mk-tab' + (o.text === P.tab ? ' on' : ''), tabs, esc(o.text)), o)
        }
      }
    }
    const body = el('div', 'mk-body' + (P.cols === 2 ? ' two' : ''), main)
    blocks(P.blocks, body)
    if (P.dialog) {
      const dim = el('div', 'mk-dim', page)
      const d = withId(el('div', 'mk-dialog card', dim), P.dialog)
      if (P.dialog.title) el('div', 'mk-dialog-t', d, rich(P.dialog.title))
      blocks(P.dialog.blocks, d)
      if (P.dialog.buttons) {
        const bs = el('div', 'mk-buttons right', d)
        for (const x of P.dialog.buttons) btn(x, bs)
      }
    }
    if (P.toast) {
      const o = typeof P.toast === 'string' ? { text: P.toast } : P.toast
      withId(el('div', 'mk-toast', page, '<b>✓</b> ' + esc(o.text)), o)
    }
    return page
  }

  // ---------- build: the end state, drawn still ----------
  window.screens = {
    build(S, box, ctx) {
      issues = []
      cur = null
      let model
      if (S.layout === 'mock') {
        const base = S.page || {}
        const names = ['main', ...Object.keys(S.states || {})]
        model = {
          w: MOCK_W,
          h: MOCK_H,
          url: base.url || S.url || '',
          frame: 'browser',
          states: names.map((n) => ({
            name: n,
            page: n === 'main' ? base : { ...base, ...S.states[n] }
          }))
        }
      } else {
        const M = S._scr
        if (!M || !M.states || !M.states.length) {
          el(
            'div',
            'illus-ph',
            box,
            '<div><b>Screen not captured yet</b><br>' +
              esc(S.shot || S.src || '') +
              ': run scripts/capture-screens.mjs</div>'
          )
          issues.push(
            `screen "${S.shot || S.src || '?'}" not found: capture it (scripts/capture-screens.mjs) or check \`shot\` / \`src\``
          )
          return
        }
        model = {
          w: M.w,
          h: M.h,
          url: S.url || M.url || '',
          source: S.source || M.source || '',
          frame: M.url ? 'browser' : 'window',
          states: M.states
        }
        if (!model.source && !S.own)
          issues.push(
            'screen has no source credit: capture it with capture-screens.mjs (it records one), or set `source` ("docs.example.com, Nov 2026"), or `"own": true` for your own picture'
          )
      }
      const fr = frame(S, box, ctx, model)
      const cam = el('div', 'scr-cam', fr.view)
      cam.style.width = model.w + 'px'
      cam.style.height = model.h + 'px'
      const pics = {}
      for (const s of model.states) {
        const p = el('div', 'scr-pic', cam)
        p.style.width = model.w + 'px'
        p.style.height = model.h + 'px'
        if (S.layout === 'mock') mockPage(s.page, p)
        else {
          const img = el('img', 'scr-img', p)
          img.src = s.src
          img.width = model.w
          img.height = model.h
        }
        pics[s.name] = p
      }
      // a mock's targets are its elements with an `id`, measured now (the camera has no transform yet)
      if (S.layout === 'mock')
        for (const s of model.states) {
          const p = pics[s.name]
          const pr = p.getBoundingClientRect()
          const k = pr.width / model.w || 1
          s.boxes = {}
          p.querySelectorAll('[data-id]').forEach((e) => {
            const r = e.getBoundingClientRect()
            s.boxes[e.dataset.id] = [
              (r.left - pr.left) / k,
              (r.top - pr.top) / k,
              r.width / k,
              r.height / k
            ]
          })
          // a mock is taller than its frame when it has too much on it
          const pg = p.firstChild
          if (pg && pg.scrollHeight > MOCK_H + 2)
            issues.push(
              `mock state "${s.name}" is ${pg.scrollHeight - MOCK_H}px too tall: drop rows or blocks`
            )
        }
      // treatments: tint · duotone · sketch (filters on the picture, never on the spotlight or cursor)
      const treat = S.treat || ctx.treat
      if (treat && treat !== 'none' && S.layout !== 'mock') {
        cam.classList.add('treat-' + treat)
        if (treat === 'duotone') duotone(ctx)
      }
      const boxOf = (ref, state) => {
        if (Array.isArray(ref)) {
          if (ref.length === 2) return [ref[0] - 1, ref[1] - 1, 2, 2]
          if (ref.length === 4) return ref
        }
        const s = model.states.find((x) => x.name === state)
        const hit =
          (s && s.boxes && s.boxes[ref]) ||
          model.states.map((x) => x.boxes && x.boxes[ref]).find(Boolean)
        if (!hit) {
          const known = [...new Set(model.states.flatMap((x) => Object.keys(x.boxes || {})))].join(
            ', '
          )
          issues.push(`unknown target "${ref}"${known ? ` (targets: ${known})` : ''}`)
          return null
        }
        return hit
      }
      const g = geo(model.w, model.h, fr.A)
      const P = plan(S, { states: model.states, boxOf, g })
      const k = (v) => fr.vw / v.w
      const camT = (v) =>
        `translate(${(-v.x * k(v)).toFixed(2)}px, ${(-v.y * k(v)).toFixed(2)}px) scale(${k(v).toFixed(5)})`
      const proj = (v, b) => [(b[0] - v.x) * k(v), (b[1] - v.y) * k(v), b[2] * k(v), b[3] * k(v)]
      const spot = el('div', 'scr-spot', fr.view)
      const ripple = el('div', 'scr-ripple', fr.view)
      const cursor = el('div', 'scr-cursor', fr.view, CURSOR)
      const placeSpot = (v, b) => {
        if (!b) return (spot.style.opacity = 0)
        const r = proj(v, b)
        const p = 10
        Object.assign(spot.style, {
          left: r[0] - p + 'px',
          top: r[1] - p + 'px',
          width: r[2] + p * 2 + 'px',
          height: r[3] + p * 2 + 'px',
          opacity: 1
        })
      }
      const placeCursor = (v, pt) => {
        if (!pt) return (cursor.style.opacity = 0)
        const r = proj(v, [pt[0], pt[1], 0, 0])
        Object.assign(cursor.style, { left: r[0] + 'px', top: r[1] + 'px', opacity: 1 })
      }
      // the end state
      cam.style.transform = camT(P.end.view)
      for (const s of model.states) pics[s.name].style.opacity = s.name === P.end.state ? 1 : 0
      placeSpot(P.end.view, P.end.spot)
      placeCursor(P.end.view, P.end.cursor)
      ripple.style.opacity = 0
      // readability: what the moves point at should be big enough to read on a phone
      const minPx = ctx.vertical ? 30 : 22
      const lastTarget = P.end.spot
      if (lastTarget && proj(P.end.view, lastTarget)[3] < minPx)
        issues.push(
          `the spotlit target is ${Math.round(proj(P.end.view, lastTarget)[3])}px tall on screen: zoom to it first (a \`zoom\` step before the \`spot\`)`
        )
      cur = { S, P, pics, cam, spot, cursor, ripple, camT, proj, view: fr.view, win: fr.win }
    },
    issues: () => issues,
    // ---------- anim: paused animations from the start state to the end state ----------
    anim(S, sp = 1, entrance = true) {
      if (!cur) return { anims: [], end: 0 }
      const { P, pics, cam, spot, cursor, ripple, camT, proj, win } = cur
      const anims = []
      let end = 0
      // only the first animation of an element's property holds before it starts (fill: both); later ones
      // fill forwards, so they take over at their own start instead of hiding the earlier ones
      const seen = new Map()
      const add = (e, kf, d, delay, easing = 'cubic-bezier(.45,.05,.55,.95)') => {
        const props = Object.keys(kf[0]).filter((k) => k !== 'offset')
        const had = seen.get(e) || new Set()
        const fill = props.some((p) => had.has(p)) ? 'forwards' : 'both'
        props.forEach((p) => had.add(p))
        seen.set(e, had)
        const a = e.animate(kf, { duration: d / sp, delay: delay / sp, fill, easing })
        a.pause()
        anims.push(a)
        end = Math.max(end, (delay + d) / sp)
      }
      const fresh = entrance && !(S._history && S._history.length)
      const t0 = fresh ? 520 : 0
      if (fresh)
        add(
          win,
          [
            { opacity: 0, transform: 'translateY(30px) scale(.97)' },
            { opacity: 1, transform: 'none' }
          ],
          560,
          0,
          'cubic-bezier(.2,.8,.2,1)'
        )
      const spotKf = (v, b, p = 10) => {
        const r = proj(v, b)
        return {
          left: r[0] - p + 'px',
          top: r[1] - p + 'px',
          width: r[2] + p * 2 + 'px',
          height: r[3] + p * 2 + 'px'
        }
      }
      const curKf = (v, pt) => {
        const r = proj(v, [pt[0], pt[1], 0, 0])
        return { left: r[0] + 'px', top: r[1] + 'px' }
      }
      const hold = (e, kf) => add(e, [kf, kf], 1, 0)
      // the start pose: the camera and picture where the previous cue left them, its spotlight and cursor
      hold(cam, { transform: camT(P.start.view) })
      for (const name of Object.keys(pics))
        hold(pics[name], { opacity: name === P.start.state ? 1 : 0 })
      hold(
        spot,
        P.start.spot ? { ...spotKf(P.start.view, P.start.spot), opacity: 1 } : { opacity: 0 }
      )
      hold(
        cursor,
        P.start.cursor ? { ...curKf(P.start.view, P.start.cursor), opacity: 1 } : { opacity: 0 }
      )
      hold(ripple, { opacity: 0 })
      for (const op of P.ops) {
        const t = t0 + op.t
        if (op.k === 'cam') {
          add(cam, [{ transform: camT(op.from) }, { transform: camT(op.to) }], D.zoom, t)
          if (P.ops.some((o) => o.k === 'swap' && o.t === op.t - 120))
            add(cursor, [{ opacity: 1 }, { opacity: 0 }], 260, t)
        } else if (op.k === 'clear') {
          if (op.spot) add(spot, [{ opacity: 1 }, { opacity: 0 }], 200, t)
          if (op.cursor) add(cursor, [{ opacity: 1 }, { opacity: 0 }], 200, t)
        } else if (op.k === 'spot') {
          const a = op.from && spotKf(op.view, op.from)
          const b = op.to && spotKf(op.view, op.to)
          if (a && b)
            add(
              spot,
              [
                { ...a, opacity: 1 },
                { ...b, opacity: 1 }
              ],
              D.spot,
              t,
              'cubic-bezier(.3,.7,.2,1)'
            )
          else if (b) {
            add(spot, [{ ...b }, { ...b }], 1, t)
            add(spot, [{ opacity: 0 }, { opacity: 1 }], D.spot, t, 'cubic-bezier(.2,.8,.2,1)')
          } else if (a) add(spot, [{ opacity: 1 }, { opacity: 0 }], 260, t)
        } else if (op.k === 'cursor') {
          const to = curKf(op.view, op.to)
          const from = op.from
            ? curKf(op.view, op.from)
            : { left: parseFloat(to.left) + 230 + 'px', top: parseFloat(to.top) + 170 + 'px' }
          // an arc: the middle of the path lifts a little
          const mid = {
            left: (parseFloat(from.left) + parseFloat(to.left)) / 2 + 'px',
            top: Math.min(parseFloat(from.top), parseFloat(to.top)) - 60 + 'px'
          }
          add(
            cursor,
            [
              { ...from, opacity: op.from ? 1 : 0, offset: 0 },
              { ...mid, opacity: 1, offset: 0.5 },
              { ...to, opacity: 1, offset: 1 }
            ],
            D.cursor,
            t
          )
        } else if (op.k === 'click') {
          add(
            cursor,
            [{ transform: 'none' }, { transform: 'scale(.8)' }, { transform: 'none' }],
            D.press,
            t,
            'ease-in-out'
          )
          const r = proj(op.view, [op.at[0], op.at[1], 0, 0])
          const at = { left: r[0] + 'px', top: r[1] + 'px' }
          add(
            ripple,
            [
              { ...at, opacity: 0.9, transform: 'translate(-50%,-50%) scale(.2)' },
              { ...at, opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }
            ],
            D.ripple,
            t + 120,
            'cubic-bezier(.2,.8,.2,1)'
          )
        } else if (op.k === 'swap') {
          add(pics[op.from], [{ opacity: 1 }, { opacity: 0 }], D.swap, t)
          add(pics[op.to], [{ opacity: 0 }, { opacity: 1 }], D.swap, t)
          if (op.spot) add(spot, [{ opacity: 1 }, { opacity: 0 }], 220, t)
        }
      }
      return { anims, end }
    }
  }

  // duotone: the picture in two of the look's colours (ink → ground), via an SVG filter built once per slide
  function duotone(ctx) {
    const hex = (c, d) => {
      const m = String(c || '')
        .trim()
        .match(/^#?([0-9a-f]{6})$/i)
      const h = m ? m[1] : d
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    }
    const a = hex(ctx.second, '1a2347')
    const b = hex(ctx.ground, 'f1eefb')
    let svg = document.getElementById('scr-filters')
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.id = 'scr-filters'
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.style.position = 'absolute'
      document.body.appendChild(svg)
    }
    svg.innerHTML =
      '<filter id="scr-duotone" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer>' +
      ['R', 'G', 'B']
        .map(
          (c, i) => `<feFunc${c} type="table" tableValues="${a[i].toFixed(3)} ${b[i].toFixed(3)}"/>`
        )
        .join('') +
      '</feComponentTransfer></filter>'
  }
})()
