// Smidge: the splash, the home screen and moving between games.
const App = (() => {
  const $ = id => document.getElementById(id);
  const VIEWS = ['splash', 'home', 'pop', 'match', 'slice', 'skim', 'untangle', 'pour', 'eyeball', 'switchboard', 'code'];
  const GAMES = { pop: () => Popshot, match: () => Stickler, slice: () => Slice, skim: () => Skim, untangle: () => Untangle, pour: () => Pour, eyeball: () => Eyeball, switchboard: () => Switchboard, code: () => CrackCode };
  let cur = 'splash', splashReady = false;
  function go(v) {
    if (GAMES[cur] && cur !== v) GAMES[cur]().leave();
    for (const id of VIEWS) $(id).hidden = id !== v;
    cur = v; document.body.dataset.view = v;
    if (v === 'home') renderHome();
    if (GAMES[v]) GAMES[v]().enter();
    Sound.paintButtons();
  }
  function renderHome() {
    const best = storeObj('popshot/best', {});
    const stars = Object.values(best).reduce((a, b) => a + (b.stars || 0), 0), played = Object.keys(best).length;
    $('progPop').innerHTML = played ? `<span>★ ${stars} of 24</span><span>${played} of 8 levels played</span>` : '<span>New · 8 levels</span>';
    const st = Stickler.stats();
    const sl = Slice.stats(), sk = Skim.stats(), un = Untangle.stats();
    $('progSlice').innerHTML = (sl.today != null ? `<span>Today ${sl.today}/500</span>` : '<span>Daily shapes ready</span>') + `<span>${sl.levels ? sl.levels + ' of ' + sl.total + ' levels' : sl.total + ' levels'}</span>`;
    $('progSkim').innerHTML = sk.today != null ? `<span>Today ${sk.today} points</span><span>Best ${sk.best}</span>` : sk.best ? `<span>Today's lake is ready</span><span>Best ${sk.best}</span>` : '<span>New · daily lake</span>';
    $('progUn').innerHTML = un.done ? `<span>${un.done} of ${un.total} untangled</span><span>★ ${un.stars}</span>` : `<span>New · ${un.total} levels</span>`;
    const po = Pour.stats(), ey = Eyeball.stats(), sw = Switchboard.stats();
    $('progPour').innerHTML = po.today != null ? `<span>Today ${po.today}/500</span><span>Best ${po.best}</span>` : po.best ? `<span>Today's glasses are ready</span><span>Best ${po.best}</span>` : '<span>New · daily glasses</span>';
    $('progEye').innerHTML = ey.today != null ? `<span>Today ${ey.today}/600</span><span>Best ${ey.best}</span>` : ey.best ? `<span>Today's tests are ready</span><span>Best ${ey.best}</span>` : '<span>New · daily tests</span>';
    $('progSw').innerHTML = sw.done ? `<span>${sw.done} of ${sw.total} switched off</span><span>★ ${sw.stars}</span>` : `<span>New · ${sw.total} boards</span>`;
    const cc = CrackCode.stats();
    $('progCode').innerHTML = (cc.today ? '<span>Today cracked</span>' : '<span>Daily code ready</span>') + (cc.done ? `<span>${cc.done} of ${cc.total} levels · ★ ${cc.stars}</span>` : `<span>${cc.total} levels</span>`);
    $('progMatch').innerHTML = st.solved ? `<span>${st.solved} of ${st.total} solved</span><span>★ ${st.stars}</span>` : `<span>New · ${st.total} puzzles</span>`;
  }
  function popSound() { Sound.noise(.06, .55, 2600, .8); Sound.tone(660, .22, 'triangle', .3); Sound.tone(990, .3, 'triangle', .18, .08); }
  function finishSplash() { $('splash').classList.add('done'); splashReady = true; }
  $('splash').addEventListener('click', () => { if (!splashReady) finishSplash(); else { Sound.audio(); popSound(); go('home'); } });
  $('spGo').addEventListener('click', e => { e.stopPropagation(); Sound.audio(); popSound(); go('home'); });
  setTimeout(() => { splashReady = true; }, 2000);
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sound.audio(); Sound.tone(740, .05, 'square', .04); go(b.dataset.go); }));
  document.querySelectorAll('[data-home]').forEach(b => b.addEventListener('click', () => { Sound.audio(); go('home'); }));
  document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => { Sound.audio(); Sound.setMuted(!Sound.isMuted()); }));
  function paintReport() { const r = Sound.report(); $('sndReport').textContent = `Web Audio: ${r.webAudio}\nPlayback mode: ${r.session}\nAudio elements: ${r.media}\nPlaying through: ${r.using}\nEmbedded viewer: ${r.frame}\nMuted in Smidge: ${r.muted}\nLast error: ${r.error}\n${navigator.userAgent}`; }
  let reportTimer = 0;
  $('sndCheck').onclick = () => { Sound.audio(); $('sndPanel').hidden = false; paintReport(); clearInterval(reportTimer); reportTimer = setInterval(paintReport, 500); };
  $('sndClose').onclick = () => { $('sndPanel').hidden = true; clearInterval(reportTimer); };
  $('sndWeb').onclick = () => { Sound.testWeb(); setTimeout(paintReport, 300); };
  $('sndMedia').onclick = () => { Sound.testMedia(); setTimeout(paintReport, 300); };
  const SAVE_TEXT = { synced: 'Progress is saved to your Claude account', connecting: 'Loading your saved progress…', offline: 'Progress saved in this browser; your account copy will catch up', local: 'Progress is saved in this browser only' };
  function paintSave() { const el = $('saveState'); if (el) el.textContent = SAVE_TEXT[Cloud.status()] || ''; }
  Cloud.onChange(() => {
    paintSave();
    if (cur === 'home') renderHome();
    else if (cur === 'match' && !$('stList').hidden) Stickler.enter();
    else { const menus = { slice: 'slMenu', skim: 'skMenu', pour: 'poMenu', eyeball: 'eyMenu', untangle: 'unMenu', switchboard: 'swMenu', code: 'ccMenu', pop: 'menu' }; if (menus[cur] && !$(menus[cur]).hidden && GAMES[cur]) GAMES[cur]().enter(); }
  });
  paintSave(); Cloud.init();
  document.body.dataset.view = 'splash';
  Sound.paintButtons();
  return { go };
})();
