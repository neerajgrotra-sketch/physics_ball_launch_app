// Crack the Code: a padlock and a few clue lines about guesses at its code. Exactly one code fits every clue
// (the generator keeps adding clues until only one is left, then drops any it can spare). Codes use different digits.
const CodeGen = (() => {
  const NUM = ['No', 'One', 'Two', 'Three', 'Four'];
  function score(g, c) { let a = 0, b = 0; for (let i = 0; i < g.length; i++) { if (g[i] === c[i]) a++; else if (c.includes(g[i])) b++; } return [a, b]; }
  const cache = {};
  function allCodes(n) {
    if (cache[n]) return cache[n];
    const out = [], rec = (pre) => { if (pre.length === n) { out.push(pre); return; } for (let d = 0; d < 10; d++) if (!pre.includes(d)) rec([...pre, d]); };
    rec([]); return (cache[n] = out);
  }
  function clueText(a, b) {
    if (!a && !b) return 'Nothing is right';
    if (a && !b) return a === 1 ? 'One digit is right and in the right place' : `${NUM[a]} digits are right and in the right places`;
    if (b && !a) return b === 1 ? 'One digit is right but in the wrong place' : `${NUM[b]} digits are right but in the wrong places`;
    return `${NUM[a]} digit${a > 1 ? 's' : ''} in the right place, and ${NUM[b].toLowerCase()} more right but in the wrong place`;
  }
  // styles: which clue results are allowed, and how many clues
  const STYLES = {
    easy: { n: 3, ok: (a, b) => a + b <= 2, min: 4, max: 6, cut: .4 },
    four: { n: 4, ok: (a, b) => a <= 1 && a + b <= 2, min: 5, max: 8, cut: .35 },
    tight: { n: 4, ok: (a, b) => a <= 1 && b <= 1, min: 5, max: 9, cut: .35 },
    tricky3: { n: 3, ok: (a, b) => a === 0, min: 4, max: 7, cut: .45 },
    tricky4: { n: 4, ok: (a, b) => a === 0 && b <= 2, min: 5, max: 9, cut: .4 },
  };
  function generate(seed, style) {
    const S = STYLES[style], r = rng(seed), codes = allCodes(S.n);
    for (let attempt = 0; attempt < 200; attempt++) {
      const code = codes[Math.floor(r() * codes.length)];
      let cand = codes, clues = [];
      while (cand.length > 1 && clues.length < S.max + 3) {
        let best = null;
        for (let k = 0; k < 60; k++) {
          const g = codes[Math.floor(r() * codes.length)]; if (g.join() === code.join()) continue;
          const [a, b] = score(g, code); if (!S.ok(a, b)) continue;
          const left = cand.filter(c => { const [x, y] = score(g, c); return x === a && y === b; });
          if (left.length === cand.length) continue;
          // aim to rule out about half of what's left each time, so a puzzle takes several small steps
          const val = Math.abs(left.length / cand.length - S.cut) + (left.length === 1 && cand.length > 4 ? 1 : 0);
          if (!best || val < best.val) best = { g, a, b, left, val };
        }
        if (!best) break;
        clues.push({ guess: best.g, a: best.a, b: best.b }); cand = best.left;
      }
      if (cand.length !== 1) continue;
      // drop clues that aren't needed
      for (let i = clues.length - 1; i >= 0; i--) {
        const rest = clues.filter((_, j) => j !== i);
        if (solutions(rest, S.n).length === 1) clues = rest;
      }
      if (clues.length < S.min || clues.length > S.max) continue;
      // shuffle the order so the most telling clue isn't always last
      for (let i = clues.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [clues[i], clues[j]] = [clues[j], clues[i]]; }
      return { n: S.n, code, clues, style };
    }
    throw new Error('no puzzle for seed ' + seed);
  }
  function solutions(clues, n) { return allCodes(n).filter(c => clues.every(cl => { const [a, b] = score(cl.guess, c); return a === cl.a && b === cl.b; })); }
  return { score, allCodes, clueText, generate, solutions, STYLES };
})();

const CrackCode = (() => {
  const $ = id => document.getElementById(id);
  const G = CodeGen;
  const LEVELS = [...Array(5)].map((_, i) => ({ style: 'easy', seed: 7001 + i * 13 })).concat([...Array(5)].map((_, i) => ({ style: 'four', seed: 8101 + i * 17 })), [...Array(3)].map((_, i) => ({ style: 'tricky3', seed: 9201 + i * 19 })), [...Array(2)].map((_, i) => ({ style: 'tricky4', seed: 9301 + i * 23 })));
  const DAILY = ['tight', 'easy', 'easy', 'four', 'four', 'tight', 'tricky3']; // Sunday .. Saturday
  const STYLE_NAME = { easy: 'Three digits', four: 'Four digits', tight: 'Four digits, few hints', tricky3: 'Tricky: nothing is ever in place', tricky4: 'Tricky, four digits' };
  let data = store('smidge/code') || { levels: {}, daily: {} };
  let P = null, which = null, wheels = [], marks = {}, tries = 0, hints = 0, startT = 0, solved = false, timer = 0;

  function dailyPuzzle() { const day = dayNumber(), wd = new Date().getDay(); return { p: G.generate(day * 9973 + 1, DAILY[wd]), label: `Daily #${day}`, day }; }
  function open(w) {
    which = w; solved = false; tries = 0; hints = 0; startT = 0; marks = {};
    if (w === 'daily') { const d = dailyPuzzle(); P = d.p; $('ccSub').textContent = `${d.label} · ${STYLE_NAME[P.style]}`; }
    else { const lv = LEVELS[w]; P = G.generate(lv.seed, lv.style); $('ccSub').textContent = `Level ${w + 1} of ${LEVELS.length} · ${STYLE_NAME[P.style]}`; }
    wheels = Array(P.n).fill(0); $('code').scrollTop = 0;
    $('ccMenu').hidden = true; $('ccEnd').hidden = true; $('ccLock').classList.remove('open');
    $('ccMsg').textContent = which === 0 ? 'Every clue is about a guess at the code. Tap a digit on a clue to mark it out (✗) or in (✓).' : '';
    buildWheels(); renderClues(); stats(); clearInterval(timer); timer = setInterval(stats, 500);
  }
  function buildWheels() {
    $('ccWheels').innerHTML = wheels.map((d, i) => `<div class="cc-wheel" data-i="${i}"><button class="cc-up" aria-label="Digit ${i + 1} up">▲</button><div class="cc-digit" aria-live="polite">${d}</div><button class="cc-down" aria-label="Digit ${i + 1} down">▼</button></div>`).join('');
    $('ccWheels').querySelectorAll('.cc-wheel').forEach(w => {
      const i = +w.dataset.i;
      w.querySelector('.cc-up').onclick = () => turn(i, 1);
      w.querySelector('.cc-down').onclick = () => turn(i, -1);
      const dg = w.querySelector('.cc-digit'); let y0 = null, acc = 0;
      dg.addEventListener('pointerdown', e => { y0 = e.clientY; acc = 0; try { dg.setPointerCapture(e.pointerId); } catch (err) {} });
      dg.addEventListener('pointermove', e => { if (y0 == null) return; const d = e.clientY - y0; if (Math.abs(d - acc) > 22) { const st = d - acc > 0 ? -1 : 1; acc += -st * 22; turn(i, st); } });
      dg.addEventListener('pointerup', e => { if (y0 != null && Math.abs(e.clientY - y0) < 6) turn(i, e.offsetY < dg.clientHeight / 2 ? 1 : -1); y0 = null; });
    });
  }
  function turn(i, st) {
    if (solved) return; Sound.audio(); if (!startT) startT = performance.now();
    wheels[i] = (wheels[i] + st + 10) % 10;
    const el = $('ccWheels').children[i].querySelector('.cc-digit'); el.textContent = wheels[i];
    el.classList.remove('roll-up', 'roll-down'); void el.offsetWidth; el.classList.add(st > 0 ? 'roll-up' : 'roll-down');
    Sound.tone(1400 + wheels[i] * 40, .015, 'square', .05); Sound.noise(.02, .2, 4000, 3); haptic(3);
  }
  function renderClues() {
    $('ccClues').innerHTML = P.clues.map((c, k) => `<div class="cc-clue"><div class="cc-tiles">${c.guess.map(d => `<button class="cc-tile ${marks[d] || ''}" data-d="${d}" aria-label="Digit ${d}${marks[d] === 'out' ? ', marked not in the code' : marks[d] === 'in' ? ', marked in the code' : ''}">${d}</button>`).join('')}</div><div class="cc-text">${G.clueText(c.a, c.b)}</div></div>`).join('');
    $('ccClues').querySelectorAll('.cc-tile').forEach(t => t.onclick = () => { if (solved) return; Sound.audio(); const d = +t.dataset.d; marks[d] = marks[d] === undefined || marks[d] === '' ? 'out' : marks[d] === 'out' ? 'in' : ''; Sound.tone(marks[d] === 'in' ? 880 : marks[d] === 'out' ? 300 : 600, .05, 'triangle', .07); renderClues(); });
  }
  const secs = () => startT ? (performance.now() - startT) / 1000 : 0;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function stats() { if (!P) return; $('ccTime').textContent = fmt(solved ? solved : secs()); $('ccTries').textContent = tries ? `${tries} wrong tr${tries === 1 ? 'y' : 'ies'}` : 'No wrong tries'; }
  function tryOpen() {
    if (!P || solved) return; Sound.audio(); if (!startT) startT = performance.now();
    if (wheels.join() === P.code.join()) return win();
    tries++; stats();
    const lock = $('ccLock'); lock.classList.remove('shake'); void lock.offsetWidth; lock.classList.add('shake');
    Sound.noise(.12, .5, 300, 1, 'lowpass'); Sound.tone(120, .18, 'square', .08); haptic(40);
    const fits = P.clues.filter(c => { const [a, b] = G.score(c.guess, wheels); return a !== c.a || b !== c.b; });
    $('ccMsg').textContent = fits.length ? `Locked. ${wheels.join('')} doesn't fit ${fits.length === 1 ? 'one of the clues' : fits.length + ' of the clues'}: check them again.` : 'Locked.';
  }
  function win() {
    solved = secs() || .01; clearInterval(timer); stats();
    $('ccLock').classList.add('open'); $('ccMsg').textContent = '';
    Sound.tone(900, .03, 'square', .1); Sound.noise(.08, .5, 2500, 2, 'bandpass', .05); [0, 4, 7, 12].forEach((s, i) => Sound.tone(587 * Math.pow(2, s / 12), .3, 'triangle', .15, .15 + i * .08)); haptic(40);
    const stars = Math.max(1, Math.min(tries === 0 ? 3 : tries === 1 ? 2 : 1, hints ? 3 - Math.min(2, hints) : 3));
    if (which === 'daily') { const day = dayNumber(); if (!data.daily[day]) data.daily[day] = { tries, time: solved, hints }; }
    else { const prev = data.levels[which] || {}; data.levels[which] = { stars: Math.max(prev.stars || 0, stars), time: Math.min(prev.time || 1e9, solved) }; }
    store('smidge/code', data);
    $('ccEndT').textContent = tries === 0 && !hints ? 'Cracked it first time!' : 'Cracked!';
    $('ccEndS').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('ccEndP').textContent = `The code was ${P.code.join('')}. ${fmt(solved)}, ${tries ? tries + ' wrong tr' + (tries === 1 ? 'y' : 'ies') : 'no wrong tries'}${hints ? `, ${hints} hint${hints > 1 ? 's' : ''}` : ''}.`;
    const isDaily = which === 'daily';
    $('ccEndShare').hidden = !isDaily; $('ccCopy').hidden = !isDaily;
    if (isDaily) $('ccEndShare').textContent = `Smidge Code #${dayNumber()} · cracked in ${fmt(solved)}\n${'🔒'.repeat(tries)}🔓${hints ? ' 💡'.repeat(hints) : ''}`;
    $('ccNext').textContent = isDaily ? 'Levels' : which + 1 < LEVELS.length ? 'Next level' : 'All levels';
    setTimeout(() => { if (solved) $('ccEnd').hidden = false; }, 900);
  }
  function hint() {
    if (!P || solved) return; Sound.audio();
    const inClues = [...new Set(P.clues.flatMap(c => c.guess))];
    const wrong = inClues.find(d => (marks[d] || '') !== (P.code.includes(d) ? 'in' : 'out'));
    if (wrong !== undefined) { marks[wrong] = P.code.includes(wrong) ? 'in' : 'out'; $('ccMsg').textContent = `${wrong} is ${P.code.includes(wrong) ? '' : 'not '}in the code. It's marked on the clues.`; }
    else { const i = wheels.findIndex((d, k) => d !== P.code[k]); if (i < 0) return; $('ccMsg').textContent = `Digit ${i + 1} is ${P.code[i]}.`; }
    hints++; Sound.tone(880, .12, 'sine', .1); renderClues();
  }
  function showMenu() {
    P = null; clearInterval(timer);
    const day = dayNumber(), d = data.daily[day];
    $('ccDailyBtn').textContent = d ? `Daily #${day} again` : `Crack daily #${day}`;
    $('ccMenuNote').textContent = d ? `Today: cracked in ${fmt(d.time)} with ${d.tries ? d.tries + ' wrong tr' + (d.tries === 1 ? 'y' : 'ies') : 'no wrong tries'}.` : `Today: ${STYLE_NAME[DAILY[new Date().getDay()]].toLowerCase()}. Monday is gentlest, Saturday trickiest.`;
    const firstOpen = (() => { const i = LEVELS.findIndex((_, k) => !data.levels[k]); return i < 0 ? 0 : i; })();
    $('ccGrid').innerHTML = LEVELS.map((lv, i) => `<button data-i="${i}" class="${i === firstOpen ? 'cur' : ''}">${i + 1}<small>${data.levels[i] ? '★'.repeat(data.levels[i].stars) : lv.style.startsWith('tricky') ? '?' : ''}</small></button>`).join('');
    $('ccGrid').querySelectorAll('button').forEach(b => b.onclick = () => { Sound.audio(); open(+b.dataset.i); });
    $('ccMenu').hidden = false; $('ccEnd').hidden = true; $('ccSub').textContent = 'Find the one code that fits';
  }
  $('ccOpen').onclick = tryOpen;
  $('ccHint').onclick = hint;
  $('ccDailyBtn').onclick = () => { Sound.audio(); open('daily'); };
  $('ccLevels').onclick = () => { Sound.audio(); showMenu(); };
  $('ccEndList').onclick = () => { Sound.audio(); showMenu(); };
  $('ccNext').onclick = () => { Sound.audio(); if (which !== 'daily' && which + 1 < LEVELS.length) open(which + 1); else showMenu(); };
  $('ccCopy').onclick = e => { Sound.audio(); copyText($('ccEndShare').textContent, e.currentTarget); };
  return {
    enter() { showMenu(); },
    leave() { clearInterval(timer); },
    stats() { const v = LEVELS.map((_, i) => data.levels[i]); return { done: v.filter(Boolean).length, stars: v.reduce((a, x) => a + (x ? x.stars : 0), 0), total: LEVELS.length, today: data.daily[dayNumber()] }; },
    LEVELS, DAILY,
  };
})();
