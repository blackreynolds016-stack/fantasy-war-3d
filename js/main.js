/* main.js — arranque, cámara, bucle y unión de simulación + dibujo + interfaz. */
import * as THREE from 'three';
import { Game } from './game.js';
import { UNITS } from './units.js';
import { MAPS, ARMIES } from './maps.js';
import { DIFFICULTY } from './ai.js';
import { loadModels, setTeamColors, UnitView } from './animations.js';
import { buildWorld, wireFlags } from './world.js';
import { Effects } from './effects.js';
import { initAudio, setVolume, setEnabled, sfx } from './audio.js';
import { UI } from './ui.js';

const QUAL = { low: { dpr: 1, shadow: 0, parts: 90 }, mid: { dpr: 1.25, shadow: 1024, parts: 200 }, high: { dpr: 2, shadow: 2048, parts: 380 } };
const $ = (id) => document.getElementById(id);
const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3;

let renderer, scene, camera, game, W, fx, ui, views = new Map(), selCfg = null;
let qual = 'mid', res = 1, perfAcc = 0, perfN = 0, perfCool = 0, running = false, paused = false, endT = 0, last = 0;
const cam = { x: 0, dist: 24, auto: true, vx: 0 };
const fps = { n: 0, t: 0 };

function setQuality(q) {
  qual = q; const Q = QUAL[q];
  if (renderer) { applyRes(); renderer.shadowMap.enabled = Q.shadow > 0; if (W) W.setShadows(Q.shadow); if (fx) fx.setCap(Q.parts); for (const v of views.values()) v.root.traverse(o => { if (o.isMesh) o.castShadow = Q.shadow > 0; }); }
}
function applyRes() { const Q = QUAL[qual]; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.dpr) * res); renderer.setSize(innerWidth, innerHeight, false); }
function perfTick(raw) {
  perfAcc += raw; perfN++; if (perfN < 45) return; const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
  if (perfCool > 0) { perfCool--; return; }
  if (avg > 1 / 40 && res > 0.55) { res = Math.max(0.55, res - 0.15); applyRes(); perfCool = 2; }
  else if (avg < 1 / 56 && res < 1) { res = Math.min(1, res + 0.1); applyRes(); perfCool = 3; }
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('game').appendChild(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 260);
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyRes(); });
  bindCamera();
  ui = new UI({
    onClick: () => { initAudio(); sfx('click'); },
    onPlay: (c) => { initAudio(); selCfg = c; startBattle(c); },
    onPause: () => pause(true), onResume: () => pause(false),
    onRestart: () => startBattle(selCfg), onMenu: () => toMenu(),
    onRecruit: (id) => { if (!game || paused) return; const r = game.recruit(0, id); if (!r.ok) { ui.denied(r.reason); sfx('deny'); } else sfx('click'); },
    onUpgrade: (k) => { if (!game || paused) return; if (!game.upgrade(0, k)) { ui.toast('No disponible'); sfx('deny'); } },
    onSpeed: () => { if (!game) return; game.speed = game.speed === 1 ? 2 : 1; $('h-speed').textContent = 'x' + game.speed; },
    onCenter: () => { cam.auto = true; },
    onSettings: applySettings,
  });
  applySettings(ui.set);
  requestAnimationFrame(loop);
}
function applySettings(s) {
  setEnabled(!!s.sound); setVolume(s.vol / 100); $('fps').classList.toggle('hidden', !s.fps);
  const q = s.quality === 'auto' ? (weak ? 'low' : 'mid') : s.quality; setQuality(q);
}

// ---------------------------------------------------------------- cámara: arrastrar, rueda y pellizco
function bindCamera() {
  const el = renderer.domElement, P = new Map(); let pd = 0, lx = 0;
  const lim = () => (game ? game.map.length / 2 - 10 : 50);
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); P.set(e.pointerId, e); lx = e.clientX; pd = P.size === 2 ? dist2() : 0; });
  el.addEventListener('pointermove', (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, e);
    if (P.size === 2) { const d = dist2(); if (pd) cam.dist = Math.min(40, Math.max(14, cam.dist * pd / d)); pd = d; return; }
    const dx = e.clientX - lx; lx = e.clientX; if (Math.abs(dx) > 0) { cam.auto = false; cam.x = Math.max(-lim(), Math.min(lim(), cam.x - dx * cam.dist * 0.0021)); }
  });
  const up = (e) => { P.delete(e.pointerId); pd = 0; if (P.size === 1) lx = [...P.values()][0].clientX; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.min(40, Math.max(14, cam.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  function dist2() { const [a, b] = [...P.values()]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
  addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { cam.auto = false; cam.x -= 3; } if (e.key === 'ArrowRight') { cam.auto = false; cam.x += 3; } });
}
function frontLine() {
  if (!game) return 0; let s = 0, n = 0;
  for (const t of [0, 1]) { const a = game.alive[t]; if (!a.length) continue; let m = t === 0 ? -1e9 : 1e9; for (const u of a) m = t === 0 ? Math.max(m, u.x) : Math.min(m, u.x); s += m; n++; }
  return n === 2 ? s / 2 : (n === 1 ? s : 0);
}
function placeCamera(dt) {
  const lim = game ? game.map.length / 2 - 10 : 50;
  if (cam.auto && game) { const f = frontLine(); cam.x += (Math.max(-lim, Math.min(lim, f)) - cam.x) * Math.min(1, dt * 1.6); }
  const d = cam.dist; camera.position.set(cam.x, 5 + d * 0.2, d); camera.lookAt(cam.x, 1.6, 0);
}
const halfView = () => cam.dist * 0.5 * Math.tan(38 * Math.PI / 360) * 2 * camera.aspect + 8;

// ---------------------------------------------------------------- batalla
function clearBattle() {
  for (const v of views.values()) { scene.remove(v.root); v.dispose(); } views.clear();
  if (fx) { fx.clear(); } if (W) { W.dispose(); W = null; }
}
function startBattle(c) {
  clearBattle(); const map = MAPS[c.map], army0 = c.army;
  const armies = [ARMIES[army0], ARMIES[1 - army0]];
  setTeamColors([armies[0].color, armies[1].color]);
  game = new Game({ map: { length: map.length, zHalf: map.zHalf }, difficulty: c.diff, army: army0, seed: (Math.random() * 1e9) | 0, ai: {} });
  W = buildWorld(scene, map, armies, qual); if (!W.flags.length) wireFlags(W); W.setShadows(QUAL[qual].shadow);
  if (!fx) fx = new Effects(scene, QUAL[qual].parts); fx.setCap(QUAL[qual].parts); fx.clear();
  cam.x = game.bases[0].x + 14; cam.auto = true; cam.dist = 24; endT = 0; paused = false; res = 1; applyRes();
  ui.attach(game); ui.hud(true); ui.show('none'); running = true; sfx('horn');
}
function toMenu() { running = false; paused = false; game = null; clearBattle(); ui.game = null; ui.hud(false); ui.show('menu'); scene.background = new THREE.Color(0x14110f); scene.fog = null; }
function pause(on) {
  if (!game || game.over) return; paused = on; ui.show(on ? 'pause' : 'none'); if (on) ui.hud(true);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && running && game && !game.over && !paused) pause(true); });

let sfxT = {};
function snd(name, gap = 0.08) { const t = performance.now() / 1000; if ((sfxT[name] || 0) + gap > t) return; sfxT[name] = t; sfx(name); }
const near = (x) => Math.abs(x - cam.x) < halfView();

function handle(ev) {
  switch (ev.t) {
    case 'spawn': { const v = new UnitView(ev.u, QUAL[qual].shadow > 0); views.set(ev.u.uid, v); scene.add(v.root); fx.dust(ev.u.x, ev.u.z, 4); if (near(ev.u.x)) snd('spawn', 0.12); break; }
    case 'remove': { const v = views.get(ev.u.uid); if (v) { scene.remove(v.root); v.dispose(); views.delete(ev.u.uid); } break; }
    case 'attack': break;
    case 'hit': {
      const v = views.get(ev.u.uid); if (v) v.onHit(ev.dmg);
      if (near(ev.x)) { fx.blood(ev.x, 1.2, ev.z); fx.slash(ev.x, 1.3, ev.z, ev.u.dir, ev.heavy); snd(ev.heavy ? 'heavy' : 'hit', 0.06); } break;
    }
    case 'proj': if (near(ev.p.x ?? cam.x)) snd(ev.p.kind === 'fire' || ev.p.type === 'fire' ? 'magic' : 'arrow', 0.1); break;
    case 'death': if (near(ev.u.x)) snd('death', 0.1); break;
    case 'coin': if (ev.team === 0) { fx.coin(ev.x, 1.6, ev.z); snd('coin', 0.15); } break;
    case 'explode': fx.explosion(ev.x, ev.z, ev.r, ev.kind); if (near(ev.x)) snd(ev.kind === 'fire' ? 'boom' : 'heavy', 0.1); break;
    case 'baseHit': { const c = W && W.castles[ev.team]; if (c) { c.userData.shake = 0.25; } fx.smoke(ev.x, 3 + Math.random() * 2, ev.z); snd('heavy', 0.15); break; }
    case 'baseDown': { const c = W && W.castles[ev.team]; if (c) c.userData.fall = 0.001; fx.castleBoom(game.bases[ev.team].x); snd('boom', 0); break; }
    case 'wave': ui.toast('¡OLEADA ' + ev.n + '!'); snd('horn', 1); break;
    case 'upgrade': if (ev.team === 0) snd('upgrade', 0.1); break;
    case 'over': endT = 2.4; snd(ev.winner === 0 ? 'victory' : 'defeat', 0); break;
  }
}
function castleAnim(dt) {
  if (!W) return;
  W.castles.forEach((c, i) => {
    const u = c.userData; if (c.userData.x0 === undefined) { u.x0 = c.position.x; u.y0 = c.position.y; }
    if (u.shake > 0) { u.shake -= dt; c.position.x = u.x0 + (Math.random() - .5) * 0.12; } else c.position.x = u.x0;
    if (u.fall > 0) { u.fall = Math.min(1, u.fall + dt * 0.35); c.position.y = u.y0 - u.fall * 3.5; c.rotation.z = (i === 0 ? 1 : -1) * u.fall * 0.12; c.scale.y = 1 - u.fall * 0.35; if (Math.random() < 0.3) fx.smoke(u.x0 + (Math.random() - .5) * 5, 2 + Math.random() * 2, (Math.random() - .5) * 3); }
  });
}

function loop(now) {
  requestAnimationFrame(loop);
  const raw = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
  if (running && game) {
    if (!paused) {
      if (!game.over) game.update(raw * game.speed); else if (endT > 0) { endT -= raw; if (endT <= 0) ui.end(game); }
      for (const ev of game.drain()) handle(ev);
      for (const v of views.values()) v.update(raw * (game.speed), game.over, cam.x, halfView());
      fx.syncProjectiles(game.projectiles); fx.update(raw, camera); fx.bars(game.units, cam.x, halfView());
      W.update(raw, cam.x); castleAnim(raw); ui.tick(raw); perfTick(raw);
    }
    placeCamera(raw);
  } else { cam.x += raw * 0.6; camera.position.set(cam.x % 20, 6, 26); camera.lookAt(cam.x % 20, 2, 0); }
  renderer.render(scene, camera);
  if (ui.set.fps) { fps.n++; fps.t += raw; if (fps.t > 0.5) { $('fps').textContent = Math.round(fps.n / fps.t) + ' FPS'; fps.n = 0; fps.t = 0; } }
}

// ---------------------------------------------------------------- arranque
(async () => {
  try {
    init(); scene.background = new THREE.Color(0x14110f);
    const failed = await loadModels((f) => ui.progress(f, 'Cargando ejércitos… ' + Math.round(f * 100) + '%'));
    if (failed.length) console.warn('Modelos sin cargar (se usan siluetas):', failed.join(', '));
    ui.progress(1); setTimeout(() => ui.show('menu'), 250);
    if (failed.length) setTimeout(() => ui.toast('Faltan ' + failed.length + ' modelos .glb'), 900);
  } catch (e) { document.getElementById('load-txt').textContent = 'Error: ' + (e && e.message || e); console.error(e); }
})();
