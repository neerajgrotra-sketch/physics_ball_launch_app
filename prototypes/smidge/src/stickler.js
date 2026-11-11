// Stickler: matchstick puzzles. Rules live in matchcore.js (MC); puzzles in puzzles.gen.js (PUZZLES), each with a verified answer.
const Stickler = (() => {
  const $ = id => document.getElementById(id);
  const U = 100;
  const PACKS = [
    { id: 'take', name: 'Take away', short: 'Remove sticks', blurb: 'Take sticks away to leave the squares asked for. Squares of any size count, and every stick that is left must be part of a square.' },
    { id: 'shift', name: 'Shift', short: 'Move sticks', blurb: 'Move sticks to new spots to make the squares asked for. Drag a stick onto a dotted spot, or tap it and then tap the spot.' },
    { id: 'sum', name: 'Fix the sum', short: 'Move digits', blurb: 'Every sum here is wrong. Move sticks between the digits and signs to make it true. Every digit has to stay a real digit.' },
  ];
  let prog = {};
  prog = storeObj('smidge/stickler', {});
  const save = () => store('smidge/stickler', prog);
  let pack = 'take';

  // ---------- geometry ----------
  function prep(p) {
    if (p._g) return p;
    const slots = new Map(), fixed = new Set();
    if (p.kind === 'eq') {
      p.glyphs = MC.glyphsFor(p.eq);
      const DW = 64, DH = 128, OW = 64, GAP = 34; let ox = 0;
      p.glyphs.forEach((g, i) => {
        const S = (n, x1, y1, x2, y2) => slots.set('g' + i + ':' + n, { x1, y1, x2, y2, L: 48, T: 9 });
        if (g.kind === 'd') {
          S('a', ox, 0, ox + DW, 0); S('b', ox + DW, 0, ox + DW, DH / 2); S('c', ox + DW, DH / 2, ox + DW, DH); S('d', ox, DH, ox + DW, DH);
          S('e', ox, DH / 2, ox, DH); S('f', ox, 0, ox, DH / 2); S('g', ox, DH / 2, ox + DW, DH / 2); ox += DW + GAP;
        } else if (g.kind === 'o') { S('h', ox, DH / 2, ox + OW, DH / 2); S('v', ox + OW / 2, DH / 2 - OW / 2, ox + OW / 2, DH / 2 + OW / 2); ox += OW + GAP; }
        else { S('t', ox, DH / 2 - 16, ox + OW, DH / 2 - 16); S('b', ox, DH / 2 + 16, ox + OW, DH / 2 + 16); fixed.add('g' + i + ':t'); fixed.add('g' + i + ':b'); ox += OW + GAP; }
      });
      p._view = [-36, -36, ox - GAP + 72, DH + 72];
      p._start = new Set([...MC.eqStart(p)]);
    } else {
      for (const k of MC.slotsFor(p.W, p.H)) {
        const [x, y] = k.slice(1).split(',').map(Number);
        slots.set(k, k[0] === 'h' ? { x1: x * U, y1: y * U, x2: (x + 1) * U, y2: y * U, L: 80, T: 11 } : { x1: x * U, y1: y * U, x2: x * U, y2: (y + 1) * U, L: 80, T: 11 });
      }
      p._view = [-34, -34, p.W * U + 68, p.H * U + 68];
      p._start = new Set(p.sticks);
    }
    p._g = slots; p._fixed = fixed;
    return p;
  }
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
  function stickMarkup(k, g, cls = '', extra = '') {
    const cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2, ang = g.y1 === g.y2 ? 0 : 90, L = g.L, T = g.T, side = (hash(k) & 1) ? 1 : -1;
    return `<g class="stick ${cls}" transform="translate(${cx} ${cy}) rotate(${ang})" ${extra}>` +
      `<rect class="halo" x="${-L / 2 - 5}" y="${-T / 2 - 5}" width="${L + 10}" height="${T + 10}" rx="${(T + 10) / 2}"/>` +
      `<rect x="${-L / 2}" y="${-T / 2}" width="${L}" height="${T}" rx="${T / 2}" fill="url(#mWood)" stroke="#5a3a17" stroke-width="1.6"/>` +
      `<ellipse cx="${side * (L / 2 - 4)}" cy="0" rx="${T * .62}" ry="${T / 2 + 1.5}" fill="url(#mHead)" stroke="#4a1410" stroke-width="1.4"/></g>`;
  }
  function headPos(k, g) {
    const cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2, side = (hash(k) & 1) ? 1 : -1, d = side * (g.L / 2 - 4);
    return g.y1 === g.y2 ? [cx + d, cy] : [cx, cy + d];
  }
  const lineMarkup = (g, cls) => { const sh = (g.L - 6) / 2, cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2, hz = g.y1 === g.y2;
    return `<line class="slot-ghost ${cls}" x1="${hz ? cx - sh : cx}" y1="${hz ? cy : cy - sh}" x2="${hz ? cx + sh : cx}" y2="${hz ? cy : cy + sh}"/>`; };
  const hitMarkup = (k, g) => { const cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2, ang = g.y1 === g.y2 ? 0 : 90;
    return `<rect class="hitbox" data-key="${k}" transform="translate(${cx} ${cy}) rotate(${ang})" x="${-g.L / 2}" y="-24" width="${g.L}" height="48"/>`; };

  function svgFor(p, set, opt = {}) {
    prep(p);
    const [vx, vy, vw, vh] = p._view;
    let s = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" aria-hidden="${opt.mini ? 'true' : 'false'}">`;
    if (p.kind !== 'eq') { for (let y = 0; y <= p.H; y++) for (let x = 0; x <= p.W; x++) s += `<circle class="lattice" cx="${x * U}" cy="${y * U}" r="${opt.mini ? 5 : 3.5}"/>`; }
    if (opt.squares) for (const q of opt.squares) s += `<rect class="sqfill on" x="${q.x * U + 6}" y="${q.y * U + 6}" width="${q.s * U - 12}" height="${q.s * U - 12}" rx="8"/>`;
    if (!opt.mini) for (const [k, g] of p._g) {
      if (set.has(k)) continue;
      const removedGhost = p.kind === 'remove' && p._start.has(k);
      if (p.kind === 'remove' && !removedGhost) continue;
      const cls = (opt.hintSlot === k ? 'target' : '') + (removedGhost ? ' removed' : '');
      s += lineMarkup(g, cls);
    }
    for (const [k, g] of p._g) if (set.has(k)) {
      const cls = [opt.sel === k ? 'sel' : '', opt.hintStick === k ? 'hint' : '', opt.loose && opt.loose.has(k) ? 'loose' : ''].join(' ');
      s += stickMarkup(k, g, cls, opt.dragging === k ? 'opacity=".25"' : '');
    }
    if (opt.flames) for (const [k, g] of p._g) if (set.has(k)) {
      const [hx, hy] = headPos(k, g), d = (hash(k) % 7 + 7) % 7 * 40;
      s += `<g transform="translate(${hx} ${hy - 4})"><path class="flameg" style="animation-delay:-${d}ms" d="M0 0 C -10 -8 -8 -24 0 -36 C 8 -24 10 -8 0 0 Z" fill="url(#mFlame)"/></g>`;
    }
    if (!opt.mini) {
      s += `<g id="stHover"></g><g id="stFloat" pointer-events="none"></g>`;
      for (const [k, g] of p._g) {
        if (p._fixed.has(k)) continue;
        if (set.has(k) || p.kind !== 'remove' || p._start.has(k)) s += hitMarkup(k, g);
      }
    }
    return s + '</svg>';
  }

  // ---------- list ----------
  function tag(p) {
    if (p.kind === 'remove') return p.goal === 'none' ? `Take ${p.n} · no squares` : `Take ${p.n} · leave ${p.target}`;
    if (p.kind === 'move') return `Move ${p.n} · make ${p.target}`;
    return `${p.eq.replace('-', '−')} · move ${p.n}`;
  }
  function renderList() {
    const solved = PUZZLES.filter(p => prog[p.id]).length;
    $('stTotal').textContent = `${solved} of ${PUZZLES.length} solved`;
    $('stTabs').innerHTML = PACKS.map(k => {
      const list = PUZZLES.filter(p => p.pack === k.id), done = list.filter(p => prog[p.id]).length;
      return `<button class="tab" role="tab" aria-selected="${k.id === pack}" data-pack="${k.id}">${k.name}<small>${done}/${list.length} solved</small></button>`;
    }).join('');
    $('stTabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { Sound.audio(); pack = b.dataset.pack; tick(); renderList(); });
    $('stBlurb').textContent = PACKS.find(k => k.id === pack).blurb;
    const list = PUZZLES.filter(p => p.pack === pack);
    $('stTiles').innerHTML = list.map((p, i) => {
      const st = prog[p.id];
      return `<button class="tile" data-id="${p.id}" aria-label="Puzzle ${i + 1}, ${tag(p)}${st === 2 ? ', solved without hints' : st ? ', solved' : ''}">` +
        (st ? `<span class="badge ${st === 2 ? '' : 'done'}">${st === 2 ? '★' : '✓'}</span>` : '') +
        svgFor(prep(p), p._start, { mini: true }) + `<span class="tn">${i + 1}</span><span class="tg">${tag(p)}</span></button>`;
    }).join('');
    $('stTiles').querySelectorAll('.tile').forEach(b => b.onclick = () => { Sound.audio(); tick(); open(b.dataset.id); });
  }

  // ---------- play ----------
  let P = null, cur = null, hist = [], sel = null, hints = 0, hint = null, solved = false, loose = null, drag = null, hover = null, flames = false;
  const removedCount = set => [...P._start].filter(k => !set.has(k)).length;
  const qGoal = () => ({ W: P.W, H: P.H, goal: P.goal, target: P.target });
  function open(id) {
    P = prep(PUZZLES.find(p => p.id === id)); pack = P.pack;
    cur = new Set(P._start); hist = []; sel = null; hints = 0; hint = null; solved = false; loose = null; flames = false;
    $('stList').hidden = true; $('stPlay').hidden = false; $('stWin').hidden = true; reviewMode(false);
    const list = PUZZLES.filter(p => p.pack === P.pack), idx = list.indexOf(P);
    $('stTitle').textContent = `${PACKS.find(k => k.id === P.pack).name} ${idx + 1}`;
    $('stSub').textContent = `Puzzle ${idx + 1} of ${list.length}`;
    const s = P.n > 1 ? 's' : '';
    if (P.kind === 'remove') {
      $('stPrompt').textContent = P.goal === 'none' ? `Take away ${P.n} sticks so that no square of any size is left.` : `Take away ${P.n} stick${s} to leave exactly ${P.target} square${P.target > 1 ? 's' : ''}.`;
      $('stRule').textContent = P.goal === 'none' ? 'Tap a stick to take it away. Tap a faded one to put it back.' : 'Squares of any size count. Every stick left must be part of a square. Tap a stick to take it away.';
    } else if (P.kind === 'move') {
      $('stPrompt').textContent = `Move ${P.n} stick${s} to make exactly ${P.target} squares.`;
      $('stRule').textContent = 'Squares of any size count, and every stick must be part of a square. Drag a stick onto a dotted spot.';
    } else {
      $('stPrompt').textContent = `Move ${P.n} stick${s} to make this sum true.`;
      $('stRule').textContent = 'Drag sticks between digits and signs. Every digit must stay a real digit. The equals sign stays put.';
    }
    msg('');
    render(); evaluate(true);
  }
  function msg(t, bad) { const el = $('stMsg'); el.textContent = t; el.classList.toggle('bad', !!bad); }
  function chips() {
    const out = [];
    if (P.kind === 'remove') { const r = removedCount(cur); out.push(`<span class="chip ${r === P.n ? 'full' : ''}">Taken ${r}/${P.n}</span>`); }
    else { const m = removedCount(cur); out.push(`<span class="chip ${m === P.n ? 'full' : ''}">Moved ${m}/${P.n}</span>`); }
    if (P.kind !== 'eq') { const c = MC.squares(cur, P.W, P.H).length; out.push(`<span class="chip">${c} square${c === 1 ? '' : 's'}</span>`); }
    $('stChips').innerHTML = out.join('');
    $('stUndo').disabled = !hist.length || solved;
  }
  function render() {
    const squares = flames && P.kind !== 'eq' ? MC.squares(cur, P.W, P.H) : null;
    $('stBoard').innerHTML = svgFor(P, cur, { sel, hintStick: hint && hint.stick, hintSlot: hint && hint.slot, loose, flames, squares, dragging: drag && drag.moved ? drag.key : null });
    chips();
  }
  function looseSet() {
    const used = new Set(); for (const q of MC.squares(cur, P.W, P.H)) for (const e of MC.squareEdges(q)) used.add(e);
    return new Set([...cur].filter(k => !used.has(k)));
  }
  function evaluate(quiet) {
    if (solved) return;
    const n = removedCount(cur);
    if (P.kind === 'eq') {
      if (n >= 1 && MC.eqTrue(P, cur)) return win();
      if (n === P.n && !quiet) {
        const t = MC.eqText(P, cur);
        fail(t ? `That reads ${t.replace(/-/g, ' − ').replace(/\+/g, ' + ').replace('=', ' = ')}, which isn't true. Drag a stick back, or Reset.` : `One of those isn't a real digit any more. Drag a stick back, or Reset.`);
      }
      return;
    }
    const j = MC.judge(qGoal(), cur);
    if (P.kind === 'move' && n >= 1 && j.ok) return win();
    if (P.kind === 'remove' && n === P.n && j.ok) return win();
    if (n === P.n && !quiet) {
      const parts = [];
      if (P.goal === 'none') parts.push(`That still leaves ${j.count} square${j.count === 1 ? '' : 's'}.`);
      else {
        if (j.count !== P.target) parts.push(`That makes ${j.count} square${j.count === 1 ? '' : 's'}, not ${P.target}.`);
        if (j.loose) { parts.push(`${j.loose} stick${j.loose === 1 ? " isn't" : "s aren't"} part of any square.`); loose = looseSet(); }
      }
      parts.push(P.kind === 'remove' ? 'Tap a faded stick to put it back.' : 'Drag a stick back, or Reset.');
      fail(parts.join(' '));
    }
  }
  function fail(t) { msg(t, true); Sound.tone(190, .22, 'sawtooth', .07); Sound.tone(150, .3, 'sawtooth', .06, .08); haptic(30); render(); const b = $('stBoard'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  function commit(next, how) {
    hist.push(cur); cur = next; sel = null; hint = null; loose = null;
    if (how === 'take') { Sound.noise(.12, .3, 1400, .9); Sound.tone(520, .1, 'triangle', .08, 0, 300); haptic(8); }
    else if (how === 'back') { Sound.tone(420, .07, 'triangle', .12); Sound.noise(.04, .3, 2500, 2); haptic(6); }
    else { Sound.noise(.05, .35, 2200, 2); Sound.tone(330, .09, 'triangle', .14); haptic(10); }
    msg(''); render(); evaluate(false);
  }
  function tryMove(a, b) {
    const next = new Set(cur); next.delete(a); next.add(b);
    if (removedCount(next) > P.n) {
      sel = null; render();
      return fail(`That would be move ${removedCount(next)}, and you only get ${P.n}. Move a stick back to where it started, or Reset.`);
    }
    commit(next, 'move');
  }
  function win() {
    solved = true; flames = true; sel = null; hint = null; loose = null;
    const val = hints ? 1 : 2; prog[P.id] = Math.max(prog[P.id] || 0, val); save();
    Sound.noise(.28, .45, 3200, .7, 'highpass'); Sound.noise(.5, .15, 900, .5, 'bandpass', .12);
    [0, 4, 7, 12].forEach((s, i) => Sound.tone(523 * Math.pow(2, s / 12), .35, 'triangle', .16, .2 + i * .09));
    haptic(40);
    msg(''); render();
    const list = PUZZLES.filter(p => p.pack === P.pack), idx = list.indexOf(P);
    $('stWinT').textContent = val === 2 ? ['Solved!', 'Lit it!', 'Nailed it!', 'Spot on!'][idx % 4] : 'Solved!';
    $('stWinS').textContent = val === 2 ? '★' : '✓';
    $('stWinP').textContent = val === 2 ? 'No hints needed, so you earn the star.' : `You used ${hints} hint${hints > 1 ? 's' : ''}. Solve it again without one to earn the star.`;
    const nxt = nextPuzzle();
    $('stWinNext').textContent = nxt ? (nxt.pack !== P.pack ? 'Next pack' : 'Next puzzle') : 'All done';
    $('stDone').innerHTML = `<b>${val === 2 ? '★' : '✓'}</b> Solved · see the result`;
    setTimeout(() => { if (solved && P && !reviewing) $('stWin').hidden = false; }, 1100);
  }
  // close the card and look at the solved board: Reset becomes Play again, Hint becomes Next
  let reviewing = false;
  function reviewMode(on) {
    reviewing = on;
    $('stDone').hidden = !on;
    $('stReset').textContent = on ? 'Play again' : 'Reset';
    $('stHint').textContent = on ? (nextPuzzle() ? 'Next ›' : 'All puzzles') : '💡 Hint';
    if (on) msg('Your answer stays on the board. Play again to solve it once more, or move on.');
  }
  function closeWin() { if (!solved) return; $('stWin').hidden = true; reviewMode(true); Sound.tone(520, .05, 'triangle', .06); }
  function nextPuzzle() { const i = PUZZLES.indexOf(P); return PUZZLES[i + 1] || null; }
  function showHint() {
    if (solved || !P) return;
    Sound.audio();
    const T = new Set(P._start);
    if (P.kind === 'remove') P.sol.remove.forEach(k => T.delete(k)); else { P.sol.from.forEach(k => T.delete(k)); P.sol.to.forEach(k => T.add(k)); }
    const excess = [...cur].filter(k => !T.has(k) && !P._fixed.has(k)), missing = [...T].filter(k => !cur.has(k));
    if (P.kind === 'remove') {
      if (missing.length) { hint = { slot: missing[0] }; msg('Put the glowing stick back: the answer keeps it.'); }
      else if (excess.length) { hint = { stick: excess[0] }; msg('Try taking the glowing stick away.'); }
      else return;
    } else {
      if (!excess.length || !missing.length) return;
      hint = { stick: excess[0], slot: missing[0] }; msg('Move the glowing stick to the glowing spot.');
    }
    hints++; sel = null; loose = null;
    Sound.tone(880, .12, 'sine', .1); Sound.tone(1320, .18, 'sine', .08, .06);
    render();
  }
  function tick() { Sound.tone(700, .04, 'square', .03); }

  // ---------- touch ----------
  function svgPoint(svg, e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
  function nearestSlot(pt, from) {
    let best = null, bd = 62;
    for (const [k, g] of P._g) {
      if (P._fixed.has(k) || (cur.has(k) && k !== from)) continue;
      const d = Math.hypot((g.x1 + g.x2) / 2 - pt.x, (g.y1 + g.y2) / 2 - pt.y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function showDrag(svg, pt) {
    const hov = svg.querySelector('#stHover'), flt = svg.querySelector('#stFloat');
    hover = nearestSlot(pt, drag.key);
    hov.innerHTML = hover && hover !== drag.key ? lineMarkup(P._g.get(hover), 'hover') : '';
    const g0 = P._g.get(drag.key), half = g0.L / 2, hz = g0.y1 === g0.y2;
    const g = hover ? P._g.get(hover) : (hz ? { ...g0, x1: pt.x - half, x2: pt.x + half, y1: pt.y, y2: pt.y } : { ...g0, x1: pt.x, x2: pt.x, y1: pt.y - half, y2: pt.y + half });
    flt.innerHTML = stickMarkup(drag.key, g, 'sel');
  }
  const board = () => $('stBoard');
  function onDown(e) {
    if (!P || solved) return;
    const svg = board().querySelector('svg'); if (!svg) return;
    const k = e.target && e.target.dataset ? e.target.dataset.key : null;
    Sound.audio();
    if (!k) { if (sel) { sel = null; render(); } return; }
    e.preventDefault();
    if (P.kind === 'remove') { drag = { key: k, x0: e.clientX, y0: e.clientY, moved: false, tapOnly: true }; return; }
    if (cur.has(k)) {
      drag = { key: k, x0: e.clientX, y0: e.clientY, moved: false };
      try { board().setPointerCapture(e.pointerId); } catch (err) {}
      Sound.tone(600, .03, 'triangle', .05);
    } else if (sel) tryMove(sel, k);
  }
  function onMove(e) {
    if (!drag || drag.tapOnly) return;
    const svg = board().querySelector('svg'); if (!svg) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; sel = null; hint = hint && hint.slot ? { slot: hint.slot } : null; render(); }
    if (drag.moved) showDrag(board().querySelector('svg'), svgPoint(board().querySelector('svg'), e));
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.tapOnly) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 14) return;
      const next = new Set(cur);
      if (cur.has(d.key)) {
        if (removedCount(cur) >= P.n) return fail(`You've taken ${P.n} already. Tap a faded stick to put one back first.`);
        next.delete(d.key); commit(next, 'take');
      } else { next.add(d.key); commit(next, 'back'); }
      return;
    }
    if (d.moved) { const h = hover; hover = null; if (h && h !== d.key) tryMove(d.key, h); else render(); }
    else { sel = sel === d.key ? null : d.key; render(); }
  }

  // ---------- wiring ----------
  function wire() {
    const b = board();
    b.addEventListener('pointerdown', onDown);
    b.addEventListener('pointermove', onMove);
    b.addEventListener('pointerup', onUp);
    b.addEventListener('pointercancel', () => { drag = null; hover = null; if (P) render(); });
    $('stHome').onclick = () => { Sound.audio(); App.go('home'); };
    $('stBack').onclick = () => { Sound.audio(); tick(); toList(); };
    $('stUndo').onclick = () => { if (!hist.length || solved) return; cur = hist.pop(); sel = null; hint = null; loose = null; msg(''); Sound.tone(360, .06, 'triangle', .08); render(); };
    $('stReset').onclick = () => { if (!P) return; Sound.audio(); if (solved) return open(P.id); if (removedCount(cur)) { hist.push(cur); cur = new Set(P._start); } sel = null; hint = null; loose = null; msg(''); Sound.noise(.2, .25, 900, .6); render(); };
    $('stHint').onclick = () => { if (solved && reviewing) { Sound.audio(); tick(); const n = nextPuzzle(); if (n) open(n.id); else toList(); } else showHint(); };
    $('stWinClose').onclick = closeWin;
    $('stWin').addEventListener('click', e => { if (e.target === $('stWin')) closeWin(); });
    $('stDone').onclick = () => { Sound.audio(); $('stWin').hidden = false; $('stDone').hidden = true; reviewing = false; };
    addEventListener('keydown', e => { if (e.key === 'Escape' && !$('stWin').hidden) closeWin(); });
    $('stWinList').onclick = () => { Sound.audio(); tick(); toList(); };
    $('stWinNext').onclick = () => { Sound.audio(); tick(); const n = nextPuzzle(); if (n) open(n.id); else toList(); };
  }
  function toList() { P = null; $('stPlay').hidden = true; $('stList').hidden = false; $('stWin').hidden = true; renderList(); }
  function homeArt() {
    const sticks = [['h0,0', { x1: 0, y1: 0, x2: 100, y2: 0, L: 80, T: 11 }], ['v0,0', { x1: 0, y1: 0, x2: 0, y2: 100, L: 80, T: 11 }], ['v1,0', { x1: 100, y1: 0, x2: 100, y2: 100, L: 80, T: 11 }],
      ['h0,1', { x1: 0, y1: 100, x2: 100, y2: 100, L: 80, T: 11 }], ['h1,1', { x1: 100, y1: 100, x2: 200, y2: 100, L: 80, T: 11 }], ['v2,1x', { x1: 200, y1: 100, x2: 200, y2: 200, L: 80, T: 11 }]];
    let s = `<defs><radialGradient id="hfelt" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#4f9a74"/><stop offset="1" stop-color="#2f6f50"/></radialGradient></defs><rect width="400" height="150" fill="url(#hfelt)"/><g transform="translate(110 22) scale(.58)">`;
    for (const [k, g] of sticks) s += stickMarkup(k, g);
    const [hx, hy] = headPos('h1,1', sticks[4][1]);
    s += `<g transform="translate(${hx} ${hy - 4})"><path class="flameg" d="M0 0 C -10 -8 -8 -24 0 -36 C 8 -24 10 -8 0 0 Z" fill="url(#mFlame)"/></g></g>`;
    s += `<g transform="translate(250 30) rotate(-18) scale(.58)">${stickMarkup('loose', { x1: 0, y1: 0, x2: 100, y2: 0, L: 80, T: 11 })}</g>`;
    s += `<g transform="translate(300 100) rotate(64) scale(.58)">${stickMarkup('loose2', { x1: 0, y1: 0, x2: 100, y2: 0, L: 80, T: 11 })}</g>`;
    $('artMatch').innerHTML = s;
  }
  wire(); homeArt();
  return {
    enter() { toList(); },
    leave() { drag = null; },
    stats() { const vals = PUZZLES.map(p => prog[p.id] || 0); return { solved: vals.filter(Boolean).length, stars: vals.filter(v => v === 2).length, total: PUZZLES.length }; }
  };
})();
