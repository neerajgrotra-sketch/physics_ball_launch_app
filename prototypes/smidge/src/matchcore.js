// Stickler core: pure puzzle logic shared by the game and the verifier. No DOM.
const MC = (() => {
  const hk = (x, y) => 'h' + x + ',' + y, vk = (x, y) => 'v' + x + ',' + y;
  function cellEdges(x, y) { return [hk(x, y), hk(x, y + 1), vk(x, y), vk(x + 1, y)]; }
  function fromCells(cells) { const s = new Set(); for (const [x, y] of cells) for (const e of cellEdges(x, y)) s.add(e); return [...s]; }
  function slotsFor(W, H) { const out = []; for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) out.push(hk(x, y)); for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) out.push(vk(x, y)); return out; }
  function squares(set, W, H) {
    const out = [];
    for (let s = 1; s <= Math.min(W, H); s++) for (let y = 0; y + s <= H; y++) for (let x = 0; x + s <= W; x++) {
      let ok = true;
      for (let i = 0; i < s && ok; i++) ok = set.has(hk(x + i, y)) && set.has(hk(x + i, y + s)) && set.has(vk(x, y + i)) && set.has(vk(x + s, y + i));
      if (ok) out.push({ x, y, s });
    }
    return out;
  }
  function squareEdges(q) { const e = []; for (let i = 0; i < q.s; i++) e.push(hk(q.x + i, q.y), hk(q.x + i, q.y + q.s), vk(q.x, q.y + i), vk(q.x + q.s, q.y + i)); return e; }
  // Is this board a win for the puzzle's goal? Returns { ok, count, loose }.
  function judge(p, set) {
    const qs = squares(set, p.W, p.H), count = qs.length;
    if (p.goal === 'none') return { ok: count === 0, count, loose: 0 };
    const used = new Set(); for (const q of qs) for (const e of squareEdges(q)) used.add(e);
    let loose = 0; for (const e of set) if (!used.has(e)) loose++;
    return { ok: count === p.target && loose === 0, count, loose };
  }
  // ---- equations (seven segments) ----
  const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  function glyphValue(kind, segs) {
    const k = [...segs].sort().join('');
    if (kind === 'd') { const i = DIG.indexOf(k); return i < 0 ? null : String(i); }
    if (kind === 'o') return k === 'h' ? '-' : k === 'hv' ? '+' : null;
    return '=';
  }
  // eq: { glyphs: [{kind:'d'|'o'|'=', segs:'...'}] } ; board = Set of 'g<i>:<seg>'
  function eqText(p, set) {
    let txt = '';
    for (let i = 0; i < p.glyphs.length; i++) {
      const g = p.glyphs[i], segs = [];
      const names = g.kind === 'd' ? 'abcdefg' : g.kind === 'o' ? 'hv' : 'tb';
      for (const n of names) if (set.has('g' + i + ':' + n)) segs.push(n);
      const v = glyphValue(g.kind, segs); if (v == null) return null; txt += v;
    }
    return txt;
  }
  function evalSide(s) { if (!/^\d+([+-]\d+)*$/.test(s)) return null; let v = 0, sign = 1, num = ''; for (const c of s + '+') { if (c === '+' || c === '-') { v += sign * +num; num = ''; sign = c === '+' ? 1 : -1; } else num += c; } return v; }
  function eqTrue(p, set) {
    const t = eqText(p, set); if (!t) return false;
    const parts = t.split('='); if (parts.length !== 2) return false;
    const a = evalSide(parts[0]), b = evalSide(parts[1]); return a != null && b != null && a === b;
  }
  function eqSlots(p) { const out = []; p.glyphs.forEach((g, i) => { const names = g.kind === 'd' ? 'abcdefg' : g.kind === 'o' ? 'hv' : ''; for (const n of names) out.push('g' + i + ':' + n); }); return out; }
  function eqStart(p) { const s = new Set(); p.glyphs.forEach((g, i) => { for (const n of g.segs) s.add('g' + i + ':' + n); }); return s; }
  function glyphsFor(text) { return [...text].map(c => c >= '0' && c <= '9' ? { kind: 'd', segs: DIG[+c] } : c === '+' ? { kind: 'o', segs: 'hv' } : c === '-' ? { kind: 'o', segs: 'h' } : { kind: '=', segs: 'tb' }); }
  return { hk, vk, fromCells, slotsFor, squares, squareEdges, judge, eqText, eqTrue, eqSlots, eqStart, glyphsFor, DIG };
})();
if (typeof module !== 'undefined') module.exports = MC;
