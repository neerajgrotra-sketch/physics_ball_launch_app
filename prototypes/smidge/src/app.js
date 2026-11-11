// Smidge: the splash, the home screen and moving between games.
const App = (() => {
  const $ = id => document.getElementById(id);
  const VIEWS = ['splash', 'home', 'pop', 'match'];
  let cur = 'splash', splashReady = false;
  function go(v) {
    if (cur === 'pop' && v !== 'pop') Popshot.leave();
    if (cur === 'match' && v !== 'match') Stickler.leave();
    for (const id of VIEWS) $(id).hidden = id !== v;
    cur = v; document.body.dataset.view = v;
    if (v === 'home') renderHome();
    if (v === 'pop') Popshot.enter();
    if (v === 'match') Stickler.enter();
    Sound.paintButtons();
  }
  function renderHome() {
    let best = {}; try { best = JSON.parse(localStorage.getItem('popshot/best') || '{}') || {}; } catch (e) {}
    const stars = Object.values(best).reduce((a, b) => a + (b.stars || 0), 0), played = Object.keys(best).length;
    $('progPop').innerHTML = played ? `<span>★ ${stars} of 24</span><span>${played} of 8 levels played</span>` : '<span>New · 8 levels</span>';
    const st = Stickler.stats();
    $('progMatch').innerHTML = st.solved ? `<span>${st.solved} of ${st.total} solved</span><span>★ ${st.stars}</span>` : `<span>New · ${st.total} puzzles</span>`;
  }
  function popSound() { Sound.noise(.06, .55, 2600, .8); Sound.tone(660, .22, 'triangle', .3); Sound.tone(990, .3, 'triangle', .18, .08); }
  function finishSplash() { $('splash').classList.add('done'); splashReady = true; }
  $('splash').addEventListener('click', () => { if (!splashReady) finishSplash(); else { Sound.audio(); popSound(); go('home'); } });
  $('spGo').addEventListener('click', e => { e.stopPropagation(); Sound.audio(); popSound(); go('home'); });
  setTimeout(() => { splashReady = true; }, 2000);
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Sound.audio(); Sound.tone(740, .05, 'square', .04); go(b.dataset.go); }));
  document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => { Sound.audio(); Sound.setMuted(!Sound.isMuted()); }));
  document.body.dataset.view = 'splash';
  Sound.paintButtons();
  return { go };
})();
