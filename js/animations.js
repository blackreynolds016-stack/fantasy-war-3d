/* animations.js — carga de los modelos .glb y control de sus animaciones según el estado de cada soldado.
   Cada clase tiene un .glb con esqueleto y 7 clips: idle, walk, run, attack, hit, die, win. Si un .glb falta, se usa un soldado de reserva (cápsula). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { UNITS, ORDER, attackTimes } from './units.js';

export const templates = {};   // id -> { scene, clips:Map } | { fallback:true }
export async function loadModels(onProgress, base = './models/') {
  const loader = new GLTFLoader(); let done = 0; const failed = [];
  await Promise.all(ORDER.map(id => new Promise(res => {
    loader.load(base + id + '.glb', g => {
      const clips = new Map(g.animations.map(a => [a.name, a]));
      const ok = ['idle', 'walk', 'run', 'attack', 'hit', 'die', 'win'].every(n => clips.has(n));
      let skinned = false; g.scene.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
      if (ok && skinned) templates[id] = { scene: g.scene, clips }; else { templates[id] = { fallback: true }; failed.push(id); }
      onProgress && onProgress(++done / ORDER.length); res();
    }, undefined, () => { templates[id] = { fallback: true }; failed.push(id); onProgress && onProgress(++done / ORDER.length); res(); });
  })));
  return failed;
}

const fbGeo = new THREE.CapsuleGeometry(0.28, 0.9, 4, 8);
const teamMats = {};   // `${id}:${team}` y 'fb:team' -> material con el color del ejército
export function setTeamColors(colors) {
  for (const k of Object.keys(teamMats)) delete teamMats[k]; teamMats.colors = colors;
}
function teamMat(base, team) {
  const key = base.uuid + ':' + team; if (!teamMats[key]) { const m = base.clone(); m.color.setHex(teamMats.colors[team]); teamMats[key] = m; } return teamMats[key];
}

const FADE = 0.15;
export class UnitView {
  constructor(u, shadows) {
    this.u = u; this.def = u.def; const t = templates[u.id];
    this.root = new THREE.Group(); this.root.scale.setScalar(u.def.scale);
    this.fallback = !!t.fallback; this.hitLeft = 0; this.prev = ''; this.cur = null; this.curName = ''; this.skip = 0; this.fade = 0;
    if (this.fallback) {
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.def.color), roughness: .7 }); this.body = new THREE.Mesh(fbGeo, mat); this.body.position.y = 0.75; this.body.castShadow = shadows; this.root.add(this.body);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: teamMats.colors[u.team] })); flag.position.set(-.25, 1.2, 0); this.root.add(flag);
    } else {
      this.model = cloneSkinned(t.scene); this.root.add(this.model);
      this.model.traverse(o => { if (o.isMesh) { o.castShadow = shadows; o.frustumCulled = false; if (o.material && o.material.name === 'team') o.material = teamMat(o.material, u.team); } });
      this.mixer = new THREE.AnimationMixer(this.model); this.actions = {};
      for (const [n, c] of t.clips) { const a = this.mixer.clipAction(c); this.actions[n] = a; }
      for (const n of ['die']) { this.actions[n].setLoop(THREE.LoopOnce, 1); this.actions[n].clampWhenFinished = true; }
      for (const n of ['attack', 'hit']) { this.actions[n].setLoop(THREE.LoopOnce, 1); this.actions[n].clampWhenFinished = true; }
      this.attackT = attackTimes(this.def);
    }
    this.root.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.play('idle', 0, 1, false);
  }
  play(name, fade = FADE, ts = 1, once = false) {
    if (this.fallback) { this.curName = name; return; }
    const a = this.actions[name]; if (!a) return;
    if (this.cur === a && !once) { a.timeScale = ts; return; }
    a.reset(); a.timeScale = ts; a.enabled = true; a.setEffectiveWeight(1); if (this.cur && this.cur !== a) { a.fadeIn(fade); this.cur.fadeOut(fade); } a.play(); this.cur = a; this.curName = name;
  }
  /** Reacción a un golpe: solo si fue fuerte y no está atacando. */
  onHit(dmg) { if (this.u.state === 'dead' || this.u.state === 'attack' || this.fallback) return; if (dmg >= this.u.maxHp * 0.07 && this.hitLeft <= 0) { this.hitLeft = 0.45; this.play('hit', 0.06, 1, true); } }
  update(dt, over, camX, half) {
    const u = this.u, r = this.root, vis = Math.abs(u.x - camX) < half + 6;
    r.visible = vis; r.position.set(u.x, 0, u.z);
    // estado → animación
    if (u.state === 'dead') {
      if (this.curName !== 'die') this.play('die', 0.08, 1, true);
      if (u.deadT > 2.0) r.position.y = -(u.deadT - 2.0) * 0.9;
    } else if (over && over.winner === u.team) { this.play('win', 0.25, 1, false); }
    else if (u.state === 'attack') {
      if (this.prev !== 'attack') { const at = this.attackT || attackTimes(this.def); this.play('attack', 0.08, at.clipDur / at.dur, true); this.hitLeft = 0; }
    } else if (this.hitLeft > 0) { this.hitLeft -= dt; }
    else if (u.moving) { const sp = this.def.speed, s = this.def.scale; if (sp > 3.5) this.play('run', FADE, sp / (4.6 * s)); else this.play('walk', FADE, sp / (2.1 * s)); }
    else this.play('idle', 0.2, 1);
    this.prev = u.state;
    if (this.fallback) { this.body.position.y = 0.75 + (u.moving ? Math.abs(Math.sin(performance.now() / 150 + u.uid)) * 0.08 : 0); if (u.state === 'dead') { this.body.rotation.z = Math.min(1.5, u.deadT * 3); } if (u.state === 'attack') this.body.position.x = u.dir * 0.2 * Math.sin(u.animLeft * 12); return; }
    // animación: fuera de pantalla se actualiza a menor ritmo
    if (vis) { this.mixer.update(dt + this.skip); this.skip = 0; } else { this.skip += dt; if (this.skip > 0.3) { this.mixer.update(this.skip); this.skip = 0; } }
  }
  dispose() { if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); } }
}
