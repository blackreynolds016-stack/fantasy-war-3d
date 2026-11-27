/* ui.js — menús, HUD y botones de reclutamiento. No toca Three.js: solo DOM y el estado de `game`. */
import { UNITS, ORDER } from './units.js';
import { UPGRADES } from './economy.js';
import { MAPS, MAP_ORDER, ARMIES } from './maps.js';

const $ = (id) => document.getElementById(id);
const DIFFS = [['facil', 'Fácil', 'Enemigo lento y torpe'], ['normal', 'Normal', 'Pelea pareja'], ['dificil', 'Difícil', 'Enemigo rápido y listo']];
const REASON = { monedas: 'Faltan monedas', poblacion: 'Población llena', cola: 'Cola llena (máx. 4)', bloqueada: 'Bloqueada', fin: '' };
const fmtTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export class UI {
  constructor(h) {
    this.h = h; this.game = null; this.acc = 0; this.btns = {}; this.ups = {}; this.toastT = 0;
    let sel = {}; try { sel = JSON.parse(localStorage.getItem('fw-sel') || '{}'); } catch (e) {}
    this.sel = { diff: 'normal', army: 0, map: 'valle', ...sel };
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
    for (const [v, name, sub] of list) {
      const b = document.createElement('button'); b.className = 'opt' + (this.sel[key] === v ? ' on' : ''); b.innerHTML = name + (sub ? '<small>' + sub + '</small>' : '');
      b.onclick = () => { this.sel[key] = v; this.save(); for (const o of box.children) o.classList.remove('on'); b.classList.add('on'); this.h.onClick && this.h.onClick(); };
      box.appendChild(b);
    }
  }
  buildSetup() {
    this.opts($('s-diff'), DIFFS, 'diff');
    this.opts($('s-army'), ARMIES.map(a => [a.id, a.name, a.perk]), 'army');
    this.opts($('s-map'), MAP_ORDER.map(m => [m, MAPS[m].name, '']), 'map');
  }
  buildCards() {
    const box = $('u-cards'); box.innerHTML = '';
    for (const id of ORDER) {
      const d = UNITS[id], c = document.createElement('div'); c.className = 'card';
      c.innerHTML = `<div class="ic" style="background:${d.color}">${d.name[0]}</div><div><b>${d.name}</b><small>${d.role}</small><p>${d.desc}</p>
        <div class="stat"><span>Vida <b>${d.hp}</b></span><span>Daño <b>${d.dmg}</b></span><span>Defensa <b>${d.def}</b></span><span>Veloc. <b>${d.speed}</b></span><span>Alcance <b>${d.range}</b></span><span>Precio <b>${d.cost}</b></span><span>Pob. <b>${d.pop}</b></span></div></div>`;
      box.appendChild(c);
    }
  }
  buildBar() {
    const bar = $('bar'); bar.innerHTML = '';
    ORDER.forEach((id, i) => {
      const d = UNITS[id], b = document.createElement('button'); b.className = 'rbtn';
      b.innerHTML = `<span class="k">${'1234567890-='[i]}</span><span class="q" style="display:none"></span><div class="ic" style="background:${d.color}">${d.name[0]}</div><span class="nm">${d.name}</span><span class="cs">${d.cost}</span><span class="pg"></span>`;
      b.onclick = () => this.h.onRecruit(id);
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
    go('m-play', () => this.show('setup')); go('m-units', () => this.show('units')); go('m-settings', () => { this.from = 'menu'; this.show('settings'); });
    go('s-back', () => this.show('menu')); go('s-go', () => this.h.onPlay({ ...this.sel })); go('u-back', () => this.show('menu'));
    go('o-back', () => { this.show(this.from === 'pause' ? 'pause' : 'menu'); });
    go('h-pause', () => this.h.onPause()); go('p-resume', () => this.h.onResume()); go('p-restart', () => this.h.onRestart());
    go('p-settings', () => { this.from = 'pause'; this.show('settings'); }); go('p-menu', () => this.h.onMenu());
    go('e-again', () => this.h.onRestart()); go('e-menu', () => this.h.onMenu());
    go('h-all', () => this.h.onAll()); go('h-speed', () => this.h.onSpeed()); go('h-center', () => this.h.onCenter());
    go('h-up', () => { $('upgrades').classList.toggle('hidden'); $('h-up').classList.toggle('on'); });
    const q = $('o-quality'), s = $('o-sound'), v = $('o-vol'), f = $('o-fps');
    q.value = this.set.quality === 'auto' ? 'mid' : this.set.quality; s.value = this.set.sound; v.value = this.set.vol; f.value = this.set.fps;
    const ch = () => { this.set = { quality: q.value, sound: +s.value, vol: +v.value, fps: +f.value }; this.save(); this.h.onSettings(this.set); };
    q.onchange = s.onchange = v.oninput = f.onchange = ch;
    addEventListener('keydown', (e) => {
      if (!this.game || e.repeat) return; const i = '1234567890-='.indexOf(e.key);
      if (i >= 0) this.h.onRecruit(ORDER[i]); else if (e.key === 'Escape' || e.key === 'p') this.h.onPause();
    });
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
    $('h-wave').textContent = 'OLEADA ' + g.wave; $('h-time').textContent = fmtTime(g.time);
    for (const id of ORDER) {
      const w = this.btns[id], tr = g.train[0][id], why = g.canRecruit(0, id);
      w.b.classList.toggle('no', !!why);
      w.q.style.display = tr.queue ? '' : 'none'; w.q.textContent = tr.queue;
      w.b.style.setProperty('--p', tr.queue ? Math.min(1, tr.t / UNITS[id].recruit) : 0);
    }
    for (const k of Object.keys(UPGRADES)) {
      const w = this.ups[k], lv = e.level[k], u = UPGRADES[k], max = lv >= u.max;
      w.pips.textContent = '■'.repeat(lv) + '□'.repeat(u.max - lv); w.c.textContent = max ? 'MAX' : u.costs[lv];
      w.b.classList.toggle('no', max || e.gold < u.costs[lv]);
    }
  }
  end(g) {
    const win = g.over.winner === 0, t = $('e-title'); t.textContent = win ? 'VICTORIA' : 'DERROTA'; t.className = win ? '' : 'lose';
    $('e-sub').textContent = win ? 'La base enemiga ha caído' : 'Tu base ha sido destruida';
    const s = g.stats[0]; $('e-stats').innerHTML = `<div><b>${fmtTime(g.time)}</b>Duración</div><div><b>${s.kills}</b>Bajas</div><div><b>${s.lost}</b>Pérdidas</div><div><b>${s.spawned}</b>Reclutados</div><div><b>${g.wave}</b>Oleada</div>`;
    this.show('end'); this.hud(false);
  }
}
