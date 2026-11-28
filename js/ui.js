/* ui.js — menús, HUD y botones de reclutamiento. No toca Three.js: solo DOM y el estado de `game`. */
import { UNITS, ORDER, DAMAGE_MULT, counters } from './units.js';
import { UPGRADES } from './economy.js';
import { MAPS, MAP_ORDER, ARMIES } from './maps.js';
import { HEROES, HERO_ORDER } from './heroes.js';
import { LEVELS, FORGE, UNIT_UNLOCK, HERO_UNLOCK } from './campaign.js';

const $ = (id) => document.getElementById(id);
const DIFFS = [['facil', 'Fácil', 'Enemigo lento y torpe'], ['normal', 'Normal', 'Pelea pareja'], ['dificil', 'Difícil', 'Enemigo rápido y listo']];
const ARM = { ligera: 'LIG', pesada: 'PES', grande: 'GRA' }, DT = { filo: 'filo', perforante: 'perforante', contundente: 'contundente', magico: 'mágico' };
const REASON = { monedas: 'Faltan monedas', poblacion: 'Población llena', cola: 'Cola llena (máx. 4)', bloqueada: 'Se desbloquea en la campaña', fin: '' };
const fmtTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export class UI {
  constructor(h, prog) {
    this.h = h; this.prog = prog; this.mode = 'quick'; this.game = null; this.acc = 0; this.btns = {}; this.ups = {}; this.toastT = 0; this.miniT = 0; this.longFlag = false;
    let sel = {}; try { sel = JSON.parse(localStorage.getItem('fw-sel') || '{}'); } catch (e) {}
    this.sel = { diff: 'normal', army: 0, map: 'valle', hero: 'valeria', ...sel }; if (!HEROES[this.sel.hero]) this.sel.hero = 'valeria';
    let set = {}; try { set = JSON.parse(localStorage.getItem('fw-set') || '{}'); } catch (e) {}
    this.set = { quality: 'auto', sound: 1, vol: 70, fps: 0, ...set };
    this.buildSetup(); this.buildCards(); this.buildBar(); this.buildUpgrades(); this.bind();
  }
  save() { try { localStorage.setItem('fw-sel', JSON.stringify(this.sel)); localStorage.setItem('fw-set', JSON.stringify(this.set)); } catch (e) {} }
  show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); }
  hud(on) { $('hud').classList.toggle('hidden', !on); }
  progress(f, txt) { $('load-bar').style.width = Math.round(f * 100) + '%'; if (txt) $('load-txt').textContent = txt; }

  opts(box, list, key) {
    box.innerHTML = '';
    for (const [v, name, sub, locked] of list) {
      const b = document.createElement('button'); b.className = 'opt' + (this.sel[key] === v ? ' on' : '') + (locked ? ' lock' : ''); b.innerHTML = (locked ? '🔒 ' : '') + name + (sub ? '<small>' + sub + '</small>' : '');
      b.onclick = () => { if (locked) { this.toast(sub); return; } this.sel[key] = v; this.save(); for (const o of box.children) o.classList.remove('on'); b.classList.add('on'); this.h.onClick && this.h.onClick(); };
      box.appendChild(b);
    }
  }
  buildSetup() {
    this.opts($('s-diff'), DIFFS, 'diff');
    this.opts($('s-army'), ARMIES.map(a => [a.id, a.name, a.perk]), 'army');
    this.heroOpts($('s-hero'));
    this.opts($('s-map'), MAP_ORDER.map(m => [m, MAPS[m].name, '']), 'map');
  }
  /** Héroes: los bloqueados se ven pero no se pueden elegir. */
  heroOpts(box) {
    if (!this.prog.isHeroOpen(this.sel.hero)) this.sel.hero = 'valeria';
    this.opts(box, HERO_ORDER.map(h => { const lk = !this.prog.isHeroOpen(h); return [h, HEROES[h].name, lk ? 'Gana el nivel ' + HERO_UNLOCK[h] : HEROES[h].skill, lk]; }), 'hero');
  }
  openModes() {
    $('md-info').textContent = 'Gloria: ' + this.prog.glory + '  ·  Estrellas: ' + this.prog.totalStars() + '/' + LEVELS.length * 3;
    $('md-abyss').textContent = 'ABISMO' + (this.prog.abyssBest() ? ' · récord piso ' + this.prog.abyssBest() : '');
    this.show('modes');
  }
  openSetup(mode) {
    this.mode = mode; $('s-title').textContent = mode === 'abyss' ? 'ABISMO: ¿hasta qué piso llegas?' : 'BATALLA RÁPIDA';
    $('s-diff-g').classList.toggle('hidden', mode === 'abyss'); this.heroOpts($('s-hero')); this.show('setup');
  }
  openCampaign() {
    const box = $('c-levels'); box.innerHTML = ''; $('c-info').textContent = 'Estrellas: ' + this.prog.totalStars() + '/' + LEVELS.length * 3 + '  ·  Gloria: ' + this.prog.glory;
    for (const lv of LEVELS) {
      const open = this.prog.levelOpen(lv.n), st = this.prog.stars(lv.n), b = document.createElement('button'); b.className = 'lvl' + (open ? '' : ' lock') + (st ? ' done' : '');
      b.innerHTML = `<span class="n">${lv.n}</span><b>${lv.name}</b><small>${MAPS[lv.map].name} · ${DIFFS.find(d => d[0] === lv.diff)[1]}</small><span class="s">${open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'}</span>`;
      b.onclick = () => { this.h.onClick && this.h.onClick(); if (!open) { this.toast('Gana el nivel ' + (lv.n - 1)); return; } this.openBrief(lv.n); };
      box.appendChild(b);
    }
    this.show('campaign');
  }
  openBrief(n) {
    const lv = LEVELS[n - 1]; this.briefN = n; $('b-title').textContent = 'NIVEL ' + n + ': ' + lv.name.toUpperCase(); $('b-desc').textContent = lv.desc;
    const unl = Object.keys(UNIT_UNLOCK).filter(u => UNIT_UNLOCK[u] === n).map(u => UNITS[u].name), hu = Object.keys(HERO_UNLOCK).filter(h => HERO_UNLOCK[h] === n).map(h => HEROES[h].name);
    const first = !this.prog.cleared(n);
    $('b-info').innerHTML = `<div><b>${MAPS[lv.map].name}</b>Mapa</div><div><b>${DIFFS.find(d => d[0] === lv.diff)[1]}</b>Dificultad</div><div><b>${lv.aiHero === false ? 'Ninguno' : lv.aiHero ? HEROES[lv.aiHero].name : 'Al azar'}</b>Héroe enemigo</div><div><b>${first ? 30 + 12 * n : 10 + 3 * n}</b>Gloria</div>`
      + (first && (unl.length || hu.length) ? `<div><b>${[...unl, ...hu].join(', ')}</b>Desbloqueas</div>` : '');
    this.heroOpts($('b-hero')); this.opts($('b-army'), ARMIES.map(a => [a.id, a.name, a.perk]), 'army'); this.show('brief');
  }
  openForge() {
    $('f-glory').textContent = this.prog.glory; const box = $('f-list'); box.innerHTML = '';
    for (const k of Object.keys(FORGE)) {
      const f = FORGE[k], lv = this.prog.perm()[k], c = this.prog.forgeCost(k), r = document.createElement('div'); r.className = 'frow';
      r.innerHTML = `<div><b>${f.name}</b><small>${f.desc}</small><div class="pips">${'■'.repeat(lv)}${'□'.repeat(f.max - lv)}</div></div><button>${c == null ? 'MÁX' : c}</button>`;
      const bt = r.querySelector('button'); bt.disabled = c == null || this.prog.glory < c;
      bt.onclick = () => { if (this.prog.buy(k)) { this.h.onClick && this.h.onClick(); this.openForge(); } };
      box.appendChild(r);
    }
    this.show('forge');
  }
  buildCards() {
    const box = $('u-cards'); box.innerHTML = '';
    for (const id of ORDER) {
      const d = UNITS[id], c = document.createElement('div'); c.className = 'card';
      c.innerHTML = `<div class="ic" style="background:${d.color}">${d.name[0]}</div><div><b>${d.name}</b><small>${d.role}</small><p>${d.desc}</p>
        <div class="stat"><span>Vida <b>${d.hp}</b></span><span>Daño <b>${d.dmg}</b></span><span>Defensa <b>${d.def}</b></span><span>Veloc. <b>${d.speed}</b></span><span>Alcance <b>${d.range}</b></span><span>Precio <b>${d.cost}</b></span><span>Pob. <b>${d.pop}</b></span></div></div>`;
      box.appendChild(c);
    }
    for (const id of HERO_ORDER) {
      const h = HEROES[id], c = document.createElement('div'); c.className = 'card hero2';
      c.innerHTML = `<div class="ic" style="background:${h.color}">${h.name[0]}</div><div><b>${h.name} <small>${h.title}</small></b><small>Héroe · recarga ${h.cd} s</small><p><b style="display:inline;color:#fff">${h.skill}.</b> ${h.desc}</p></div>`;
      box.appendChild(c);
    }
  }
  buildBar() {
    const bar = $('bar'); bar.innerHTML = '';
    ORDER.forEach((id, i) => {
      const d = UNITS[id], b = document.createElement('button'); b.className = 'rbtn';
      b.innerHTML = `<span class="k">${'1234567890-='[i]}</span><span class="q" style="display:none"></span><div class="ic" style="background:${d.color}">${d.name[0]}</div><span class="nm">${d.name}</span><span class="cs">${d.cost}</span><span class="tp">${ARM[d.armor]}</span><span class="pg"></span>`;
      let tm = 0;
      b.onpointerdown = (e) => { this.longFlag = false; clearTimeout(tm); tm = setTimeout(() => { this.longFlag = true; this.info(id); }, e.pointerType === 'mouse' ? 99999 : 380); };
      const end = () => { clearTimeout(tm); this.info(null); };
      b.onpointerup = end; b.onpointerleave = end; b.onpointercancel = end;
      b.onmouseenter = () => this.info(id); b.onmouseleave = () => this.info(null);
      b.onclick = () => { if (this.longFlag) { this.longFlag = false; return; } this.h.onRecruit(id); };
      bar.appendChild(b); this.btns[id] = { b, q: b.querySelector('.q'), cs: b.querySelector('.cs') };
    });
  }
  buildUpgrades() {
    const box = $('upgrades'); box.innerHTML = '';
    for (const k of Object.keys(UPGRADES)) {
      const u = UPGRADES[k], b = document.createElement('button'); b.className = 'up';
      b.innerHTML = `<div><b>${u.name}</b><small>${u.desc}</small><div class="pips"></div></div><span class="c"></span>`;
      b.onclick = () => this.h.onUpgrade(k); box.appendChild(b); this.ups[k] = { b, pips: b.querySelector('.pips'), c: b.querySelector('.c') };
    }
  }
  bind() {
    const go = (id, f) => { $(id).onclick = () => { this.h.onClick && this.h.onClick(); f(); }; };
    go('m-play', () => this.openModes()); go('m-units', () => this.show('units')); go('m-settings', () => { this.from = 'menu'; this.show('settings'); });
    go('md-back', () => this.show('menu')); go('md-quick', () => this.openSetup('quick')); go('md-abyss', () => this.openSetup('abyss')); go('md-camp', () => this.openCampaign()); go('md-forge', () => this.openForge());
    go('c-back', () => this.openModes()); go('f-back', () => this.openModes()); go('b-back', () => this.openCampaign());
    go('s-back', () => this.openModes()); go('s-go', () => this.h.onPlay({ ...this.sel, mode: this.mode })); go('b-go', () => this.h.onPlay({ mode: 'campaign', level: this.briefN, army: this.sel.army, hero: this.sel.hero }));
    go('e-next', () => this.h.onNext()); go('u-back', () => this.show('menu'));
    go('o-back', () => { this.show(this.from === 'pause' ? 'pause' : 'menu'); });
    go('h-pause', () => this.h.onPause()); go('p-resume', () => this.h.onResume()); go('p-restart', () => this.h.onRestart());
    go('p-settings', () => { this.from = 'pause'; this.show('settings'); }); go('p-menu', () => this.h.onMenu());
    go('e-again', () => this.h.onRestart()); go('e-menu', () => this.h.onMenu());
    go('h-all', () => this.h.onAll()); go('h-hero', () => this.h.onHero()); go('h-speed', () => this.h.onSpeed()); go('h-center', () => this.h.onCenter());
    go('h-up', () => { $('upgrades').classList.toggle('hidden'); $('h-up').classList.toggle('on'); });
    const mc = $('mini'); let drag = false; const mv = (e) => { const r = mc.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; if (this.game) this.h.onMini(((f * mc.width - 6) / (mc.width - 12) - 0.5) * this.game.map.length); };
    mc.onpointerdown = (e) => { drag = true; mc.setPointerCapture(e.pointerId); mv(e); }; mc.onpointermove = (e) => { if (drag) mv(e); }; mc.onpointerup = mc.onpointercancel = () => { drag = false; };
    const q = $('o-quality'), s = $('o-sound'), v = $('o-vol'), f = $('o-fps');
    q.value = this.set.quality === 'auto' ? 'mid' : this.set.quality; s.value = this.set.sound; v.value = this.set.vol; f.value = this.set.fps;
    const ch = () => { this.set = { quality: q.value, sound: +s.value, vol: +v.value, fps: +f.value }; this.save(); this.h.onSettings(this.set); };
    q.onchange = s.onchange = v.oninput = f.onchange = ch;
    addEventListener('keydown', (e) => {
      if (!this.game || e.repeat) return; const i = '1234567890-='.indexOf(e.key);
      if (i >= 0) this.h.onRecruit(ORDER[i]); else if (e.key === 'q' || e.key === 'Q') this.h.onHero(); else if (e.key === 'Escape' || e.key === 'p') this.h.onPause();
    });
  }
  /** Ficha de una tropa: estadísticas, a qué armaduras daña más, quién la vence y a quién vence. */
  info(id) {
    const box = $('info'); if (!id) { box.classList.add('hidden'); return; }
    const d = UNITS[id], c = counters(id), M = DAMAGE_MULT[d.dtype];
    const good = Object.keys(M).filter(k => M[k] >= 1.2).map(k => k + 's'), bad = Object.keys(M).filter(k => M[k] <= 0.8).map(k => k + 's');
    const nm = (l) => l.map(u => u.name).join(', ') || '—';
    box.innerHTML = `<b class="t">${d.name} <small>${d.role}</small></b><div class="st"><span>Vida ${d.hp}</span><span>Daño ${d.dmg}</span><span>Def ${d.def}</span><span>Alcance ${d.range}</span><span>Armadura ${d.armor}</span><span>Ingresos +${d.inc}/s</span></div>`
      + (d.heal ? `<div class="g">Cura ${d.heal} de vida al aliado más herido.</div>` : `<div>Daño ${DT[d.dtype]}: <span class="g">fuerte contra ${good.join(', ') || '—'}</span>${bad.length ? ', <span class="r">débil contra ' + bad.join(', ') + '</span>' : ''}</div><div><span class="r">La vencen:</span> ${nm(c.beatenBy)}</div><div><span class="g">Vence a:</span> ${nm(c.beats)}</div>`);
    box.classList.remove('hidden');
  }
  /** Minimapa: muestra tu ejército y solo los enemigos que tus tropas o tu base ven de cerca (no regala dónde salen). Arrastrar mueve la cámara. */
  drawMini(camX, halfW) {
    const g = this.game, cv = $('mini'); if (!g || !cv) return; const now = performance.now(); if (now - this.miniT < 110) return; this.miniT = now;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, L = g.map.length, X = (x) => 6 + (x + L / 2) / L * (W - 12);
    const c0 = ARMIES[g.army].css, c1 = ARMIES[1 - g.army].css;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#2b3a22'; ctx.fillRect(4, H / 2 - 3, W - 8, 6);
    const fr = [g.bases[0], g.towers[0], ...g.alive[0]];
    for (const [b, col] of [[g.bases[0], c0], [g.bases[1], c1]]) { ctx.fillStyle = col; ctx.fillRect(X(b.x) - 5, H / 2 - 10, 10, 20); }
    for (const [t, col] of [[g.towers[0], c0], [g.towers[1], c1]]) if (!t.dead) { ctx.fillStyle = '#f0c850'; ctx.fillRect(X(t.x) - 2, H / 2 - 8, 4, 16); ctx.fillStyle = col; ctx.fillRect(X(t.x) - 2, H / 2 - 8, 4, 4); }
    for (const u of g.alive[0]) { ctx.fillStyle = c0; ctx.fillRect(X(u.x) - 1.5, H / 2 - 1.5 + (u.z / g.map.zHalf) * 4, 3, 3); }
    for (const u of g.alive[1]) { let seen = false; for (const f of fr) if (Math.abs(f.x - u.x) < 24) { seen = true; break; } if (!seen) continue; ctx.fillStyle = c1; ctx.fillRect(X(u.x) - 1.5, H / 2 - 1.5 + (u.z / g.map.zHalf) * 4, 3, 3); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(X(camX - halfW), 3, Math.max(8, X(camX + halfW) - X(camX - halfW)), H - 6);
  }
  toast(txt) { const t = $('toast'); t.textContent = txt; t.classList.add('on'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('on'), 1300); }
  denied(reason) { if (REASON[reason]) this.toast(REASON[reason]); }

  attach(game) {
    this.game = game; this.acc = 99; $('upgrades').classList.add('hidden'); $('h-up').classList.remove('on');
    $('h-n0').textContent = ARMIES[game.army].name.toUpperCase(); $('h-n1').textContent = ARMIES[1 - game.army].name.toUpperCase();
    document.documentElement.style.setProperty('--c0', ARMIES[game.army].css);
    $('h-b0').style.background = ARMIES[game.army].css; $('h-b1').style.background = ARMIES[1 - game.army].css;
    $('h-speed').textContent = 'x1'; this.tick(0);
  }
  /** Se llama cada fotograma; refresca el DOM como máximo ~8 veces por segundo. */
  tick(dt) {
    const g = this.game; if (!g) return; this.acc += dt; if (this.acc < 0.12) return; this.acc = 0;
    const e = g.eco[0];
    $('h-gold').textContent = Math.floor(e.gold); $('h-inc').textContent = '+' + e.income.toFixed(0) + '/s';
    $('h-pop').textContent = e.popUsed + '/' + e.popCap;
    $('h-b0').style.width = (100 * g.bases[0].hp / g.bases[0].maxHp) + '%'; $('h-b1').style.width = (100 * g.bases[1].hp / g.bases[1].maxHp) + '%';
    $('h-t0').style.width = (100 * g.towers[0].hp / g.towers[0].maxHp) + '%'; $('h-t1').style.width = (100 * g.towers[1].hp / g.towers[1].maxHp) + '%';
    const hb = $('h-hero'), hid = g.hero[0];
    if (!hid) hb.classList.add('hidden'); else {
      const H = HEROES[hid], cd = g.heroCd[0]; hb.classList.remove('hidden'); hb.classList.toggle('rdy', cd <= 0); hb.classList.toggle('cd', cd > 0);
      hb.querySelector('.hi').textContent = H.name[0]; hb.querySelector('.hi').style.background = H.color; hb.querySelector('.hn').textContent = H.skill;
      hb.querySelector('.hc').textContent = cd <= 0 ? 'LISTA' : Math.ceil(cd) + ' s'; hb.style.setProperty('--p', 1 - cd / H.cd);
    }
    $('h-wave').textContent = (g.abyss ? 'PISO ' + g.floor + ' · ' : '') + 'OLEADA ' + g.wave; $('h-time').textContent = fmtTime(g.time);
    for (const id of ORDER) {
      const w = this.btns[id], tr = g.train[0][id], why = g.canRecruit(0, id), lock = !g.unlocked.includes(id);
      w.b.classList.toggle('no', !!why); w.b.classList.toggle('lock', lock); w.cs.textContent = lock ? '🔒' : UNITS[id].cost;
      w.q.style.display = tr.queue ? '' : 'none'; w.q.textContent = tr.queue;
      w.b.style.setProperty('--p', tr.queue ? Math.min(1, tr.t / UNITS[id].recruit) : 0);
    }
    for (const k of Object.keys(UPGRADES)) {
      const w = this.ups[k], lv = e.level[k], u = UPGRADES[k], max = lv >= u.max;
      w.pips.textContent = '■'.repeat(lv) + '□'.repeat(u.max - lv); w.c.textContent = max ? 'MAX' : u.costs[lv];
      w.b.classList.toggle('no', max || e.gold < u.costs[lv]);
    }
  }
  end(g, rep = {}) {
    const win = g.over.winner === 0, t = $('e-title'), ab = g.abyss;
    t.textContent = ab ? 'PISO ' + g.floor : (win ? 'VICTORIA' : 'DERROTA'); t.className = ab || win ? '' : 'lose';
    $('e-sub').textContent = ab ? 'Tu castillo cayó en el piso ' + g.floor : (win ? 'La base enemiga ha caído' : 'Tu base ha sido destruida');
    const s = g.stats[0]; $('e-stats').innerHTML = `<div><b>${fmtTime(g.time)}</b>Duración</div><div><b>${s.kills}</b>Bajas</div><div><b>${s.lost}</b>Pérdidas</div><div><b>${s.spawned}</b>Reclutados</div><div><b>${g.wave}</b>Oleada</div>`;
    const L = [];
    if (rep.stars) L.push('<b>' + '★'.repeat(rep.stars) + '☆'.repeat(3 - rep.stars) + '</b> estrellas');
    if (rep.glory) L.push('Gloria ganada: <b>+' + rep.glory + '</b> (total ' + this.prog.glory + ')');
    if (rep.best) L.push('<b>¡Nuevo récord del Abismo: piso ' + rep.floor + '!</b>');
    if (rep.newUnits && rep.newUnits.length) L.push('Tropas desbloqueadas: <b>' + rep.newUnits.map(u => UNITS[u].name).join(', ') + '</b>');
    if (rep.newHeroes && rep.newHeroes.length) L.push('Héroes desbloqueados: <b>' + rep.newHeroes.map(h => HEROES[h].name).join(', ') + '</b>');
    if (rep.mode === 'campaign' && !win) L.push('Consejo: mejora tu economía y usa tu héroe en el momento justo.');
    $('e-reward').innerHTML = L.join('<br>');
    $('e-next').classList.toggle('hidden', !rep.next); $('e-again').textContent = rep.mode === 'campaign' ? (win ? 'REPETIR NIVEL' : 'REINTENTAR') : 'OTRA BATALLA';
    this.show('end'); this.hud(false);
  }
}
