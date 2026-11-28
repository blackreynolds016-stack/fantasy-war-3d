/* game.js — simulación completa de la batalla (sin gráficos). Los dibujos leen `game.units`, `game.projectiles` y `game.drain()` (eventos).
   Equipo 0 = jugador (avanza hacia +X), equipo 1 = IA (avanza hacia -X). */
import { UNITS, ORDER, attackTimes } from './units.js';
import { Economy, UPGRADES } from './economy.js';
import { computeDamage, pickTarget, inRange, baseEdge, Projectile, DETECT, BASE_HALF, TOWER } from './combat.js';
import { AI } from './ai.js';
import { HEROES, HERO_ORDER, HERO_START_CD, BUFF } from './heroes.js';

export const WAVE_T = 45;
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let nextUid = 1;
export class Game {
  /** opts: map {length,zHalf}, difficulty 'facil'|'normal'|'dificil', seed, army (0 Alba | 1 Ceniza), ai {hpMul,dmgMul,incomeMul} */
  constructor(opts = {}) {
    this.map = opts.map || { length: 120, zHalf: 3.2 }; this.rand = mulberry32(opts.seed ?? 12345);
    this.difficulty = opts.difficulty || 'normal'; this.army = opts.army ?? 0; this.speed = 1;
    this.time = 0; this.wave = 1; this.waveT = 0; this.over = null; this.paused = false;
    this.units = []; this.projectiles = []; this.events = []; this.alive = [[], []];
    const half = this.map.length / 2 - 8;
    const aiMods = opts.ai || {};
    const army0 = this.army === 0 ? { baseHp: 1.10, dmg: 1.0 } : { baseHp: 1.0, dmg: 1.08 };
    const army1 = this.army === 0 ? { baseHp: 1.0, dmg: 1.08 } : { baseHp: 1.10, dmg: 1.0 };
    this.eco = [new Economy({ passiveDmg: army0.dmg }), new Economy({ passiveDmg: army1.dmg * (aiMods.dmgMul ?? 1) })];
    const bhp = 6000;
    this.bases = [
      { isBase: true, team: 0, x: -half, z: 0, hp: bhp * army0.baseHp, maxHp: bhp * army0.baseHp, dead: false, r: BASE_HALF },
      { isBase: true, team: 1, x: half, z: 0, hp: bhp * army1.baseHp * (aiMods.baseHpMul ?? 1), maxHp: bhp * army1.baseHp * (aiMods.baseHpMul ?? 1), dead: false, r: BASE_HALF },
    ];
    this.towers = [0, 1].map(team => ({ isBase: true, isTower: true, team, x: this.bases[team].x + (team === 0 ? 1 : -1) * TOWER.dist, z: 0, hp: TOWER.hp, maxHp: TOWER.hp, dead: false, r: TOWER.r, ty: 3.2, cd: 1.2,
      def: { scale: 4.5, dmg: TOWER.dmg, dtype: 'perforante', siege: 1 } }));
    this.hero = opts.hero ? [opts.hero[0], opts.hero[1] ?? HERO_ORDER[Math.floor(this.rand() * HERO_ORDER.length)]] : [null, null]; this.heroCd = [HERO_START_CD, HERO_START_CD];
    this.train = [{}, {}]; for (const t of [0, 1]) for (const id of ORDER) this.train[t][id] = { queue: 0, t: 0 };
    this.stats = [{ kills: 0, lost: 0, spawned: 0, damage: 0 }, { kills: 0, lost: 0, spawned: 0, damage: 0 }];
    this.aiHpMul = aiMods.hpMul ?? 1;
    this.ai = new AI(this, 1, this.difficulty, aiMods);
    this.unlocked = opts.unlocked || ORDER.slice();
  }
  drain() { const e = this.events; this.events = []; return e; }
  emit(e) { if (this.events.length < 600) this.events.push(e); }
  /** Lo que el enemigo debe golpear primero: la torre mientras exista; después, el castillo. */
  objective(team) { const t = this.towers[team]; return t.dead ? this.bases[team] : t; }
  aliveOf(team) { return this.units.filter(u => u.team === team && u.state !== 'dead'); }
  count(team) { let n = 0; for (const u of this.units) if (u.team === team && u.state !== 'dead') n++; return n; }

  // ------------------------------------------------------------------ reclutamiento y mejoras
  canRecruit(team, id) {
    const d = UNITS[id], eco = this.eco[team], tr = this.train[team][id];
    if (this.over) return 'fin'; if (!d) return 'desconocida';
    if (team === 0 && !this.unlocked.includes(id)) return 'bloqueada';
    if (tr.queue >= 4) return 'cola'; if (eco.popFree() < d.pop) return 'poblacion'; if (!eco.canAfford(d.cost)) return 'monedas';
    return null;
  }
  recruit(team, id) {
    const why = this.canRecruit(team, id); if (why) return { ok: false, reason: why };
    const d = UNITS[id], eco = this.eco[team]; eco.spend(d.cost); eco.popUsed += d.pop; this.train[team][id].queue++;
    this.emit({ t: 'queued', team, id }); return { ok: true };
  }
  upgrade(team, k) {
    if (this.over || !UPGRADES[k]) return false; const ok = this.eco[team].upgrade(k);
    if (ok) this.emit({ t: 'upgrade', team, k, level: this.eco[team].level[k] }); return ok;
  }
  spawn(team, id) {
    const d = UNITS[id], base = this.bases[team], dir = team === 0 ? 1 : -1, zh = this.map.zHalf - 0.6;
    const lane = (this.rand() * 2 - 1) * zh;
    const hpMul = team === 1 ? this.aiHpMul : 1;
    const u = { uid: nextUid++, id, def: d, team, dir, hp: d.hp * hpMul, maxHp: d.hp * hpMul, x: base.x + dir * (BASE_HALF + 1.2 + this.rand() * 1.5), z: lane, lane, r: 0.42 * d.scale,
                state: 'walk', target: null, cd: 0.3 + this.rand() * 0.4, windup: 0, winding: false, animLeft: 0, retarget: this.rand() * 0.4, deadT: 0, hits: 0, moving: false, hurtT: 0 };
    this.units.push(u); this.eco[team].unitInc += d.inc || 0; this.stats[team].spawned++; this.emit({ t: 'spawn', u }); return u;
  }

  // ------------------------------------------------------------------ bucle principal
  update(dtReal) {
    if (this.paused) return;
    let dt = dtReal * this.speed; const STEP = 1 / 30;
    this._acc = (this._acc || 0) + Math.min(dt, 0.25);
    while (this._acc >= STEP) { this._acc -= STEP; this.step(STEP); }
  }
  step(dt) {
    if (this.over) { this.cleanup(dt); this.updateProjectiles(dt); return; }
    this.time += dt; this.waveT += dt;
    if (this.waveT >= WAVE_T) { this.waveT = 0; this.wave++; this.emit({ t: 'wave', n: this.wave }); }
    this.eco[0].tick(dt); this.eco[1].tick(dt); for (const t of [0, 1]) if (this.heroCd[t] > 0) this.heroCd[t] = Math.max(0, this.heroCd[t] - dt);
    this.ai.update(dt);
    for (const t of [0, 1]) for (const id of ORDER) {
      const tr = this.train[t][id]; if (!tr.queue) continue;
      tr.t += dt; if (tr.t >= UNITS[id].recruit) { tr.t = 0; tr.queue--; this.spawn(t, id); }
    }
    this.alive[0].length = 0; this.alive[1].length = 0; for (const u of this.units) if (u.state !== 'dead') this.alive[u.team].push(u);
    for (const u of this.units) if (u.state !== 'dead') this.updateUnit(u, dt);
    this.towerFire(dt); this.separate(dt); this.updateProjectiles(dt); this.cleanup(dt); this.checkEnd();
  }

  updateUnit(u, dt) {
    const d = u.def;
    u.cd -= dt; u.hurtT -= dt; if (u.buffT > 0) u.buffT -= dt;
    if (u.state === 'attack') {
      u.animLeft -= dt; u.moving = false;
      if (u.winding) { u.windup -= dt; if (u.windup <= 0) { u.winding = false; this.resolveAttack(u); } }
      if (u.animLeft <= 0) u.state = 'walk';
      return;
    }
    if (d.heal) { this.updateHealer(u, dt); return; }
    u.retarget -= dt;
    const tg = u.target;
    const valid = tg && (tg.isBase ? !tg.dead : tg.state !== 'dead');
    if (!valid || u.retarget <= 0 || !inRange(u, tg)) {
      u.retarget = 0.3 + this.rand() * 0.15;
      u.target = pickTarget(u, this.alive[1 - u.team], this.objective(1 - u.team));
    }
    const t = u.target;
    if (t && inRange(u, t)) {
      u.moving = false;
      if (u.cd <= 0) this.startAttack(u, t);
      return;
    }
    // avanzar: hacia el objetivo o, si no hay, hacia la base enemiga
    let tx, tz;
    if (t) { tx = t.x; tz = t.isBase ? u.z : t.z; if (t.isBase) tx = t.x - u.dir * ((t.r ?? BASE_HALF) + 0.5); } else { tx = this.bases[1 - u.team].x; tz = u.lane; }
    let vx = tx - u.x, vz = tz - u.z; const l = Math.hypot(vx, vz) || 1;
    const sp = d.speed * (u.buffT > 0 ? BUFF.speed : 1) * dt; u.x += vx / l * sp; u.z += vz / l * sp;
    u.moving = true; u.dirx = vx / l;
    const lim = this.map.length / 2 - 2; if (u.x > lim) u.x = lim; if (u.x < -lim) u.x = -lim;
    const zl = this.map.zHalf; if (u.z > zl) u.z = zl; if (u.z < -zl) u.z = -zl;
  }

  // ------------------------------------------------------------------ héroes
  heroReady(team) { return !!this.hero[team] && this.heroCd[team] <= 0 && !this.over; }
  /** Centro del grupo de `team` (enemigos si `foes`) con más tropas dentro de `r`; null si no hay. */
  densest(units, r) {
    let best = null, bn = 0;
    for (const a of units) { let n = 0; for (const b of units) if (Math.abs(a.x - b.x) < r) n++; if (n > bn) { bn = n; best = a; } }
    return best ? { x: best.x, n: bn } : null;
  }
  frontOf(team) { let f = null; for (const u of this.alive[team]) if (!u.def.heal && (f === null || (team === 0 ? u.x > f : u.x < f))) f = u.x; return f; }
  useHero(team) {
    const id = this.hero[team]; if (!id) return { ok: false, reason: 'sin héroe' }; if (this.over) return { ok: false, reason: 'fin' };
    if (this.heroCd[team] > 0) return { ok: false, reason: 'enfriamiento' };
    const H = HEROES[id], eco = this.eco[team], foes = this.alive[1 - team];
    if (H.kind === 'rain' || H.kind === 'fire') {
      const c = this.densest(foes, H.r); if (!c) return { ok: false, reason: 'sin objetivo' };
      const spots = H.kind === 'rain' ? [c.x] : [c.x, c.x - 3, c.x + 3];
      this.emit({ t: 'skill', team, id, kind: H.kind, x: c.x, r: H.r, spots });
      for (const sx of spots) for (const e of foes) if (e.state !== 'dead' && Math.abs(e.x - sx) <= H.r + e.r) this.hitUnit({ team }, e, H.power * eco.attackBonus * this.eco[1 - team].defenseFactor, false, team);
    } else if (H.kind === 'buff') {
      const f = this.frontOf(team); if (f === null) return { ok: false, reason: 'sin objetivo' };
      this.emit({ t: 'skill', team, id, kind: 'buff', x: f, r: H.r });
      for (const u of this.alive[team]) if (Math.abs(u.x - f) <= H.r) { u.buffT = H.dur; this.emit({ t: 'buffed', u }); }
    } else if (H.kind === 'heal') {
      const f = this.frontOf(team); if (f === null) return { ok: false, reason: 'sin objetivo' };
      let any = false; for (const u of this.alive[team]) if (Math.abs(u.x - f) <= H.r && u.hp < u.maxHp) any = true;
      if (!any) return { ok: false, reason: 'sin objetivo' };
      this.emit({ t: 'skill', team, id, kind: 'heal', x: f, r: H.r });
      for (const u of this.alive[team]) if (Math.abs(u.x - f) <= H.r && u.hp < u.maxHp) { const b = u.hp; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * H.power); this.emit({ t: 'heal', u, amt: u.hp - b }); }
    }
    this.heroCd[team] = H.cd; return { ok: true };
  }
  /** El sacerdote cura al aliado más herido a su alcance; si no hay heridos, acompaña a la línea aliada desde atrás. */
  updateHealer(u, dt) {
    const d = u.def; let best = null, bf = 0.97, front = null;
    for (const a of this.alive[u.team]) {
      if (a === u) continue;
      if (!a.def.heal && (front === null || (u.dir > 0 ? a.x > front : a.x < front))) front = a.x;
      const f = a.hp / a.maxHp, dd = Math.hypot(a.x - u.x, a.z - u.z);
      if (f < bf && dd <= d.range) { bf = f; best = a; }
    }
    if (best) { u.moving = false; if (u.cd <= 0) this.startAttack(u, best); return; }
    // sin heridos: avanza hasta quedar unos metros detrás del frente aliado
    let tx = front === null ? this.bases[u.team].x + u.dir * 9 : front - u.dir * 4;
    const gap = (tx - u.x) * u.dir;
    if (gap > 0.3) { u.x += u.dir * Math.min(gap, d.speed * dt); u.moving = true; u.dirx = u.dir; } else u.moving = false;
  }
  towerFire(dt) {
    for (const tw of this.towers) {
      if (tw.dead) continue; tw.cd -= dt; if (tw.cd > 0) continue;
      let best = null, bd = TOWER.range; for (const e of this.alive[1 - tw.team]) { const d = Math.hypot(e.x - tw.x, e.z - tw.z); if (d < bd) { bd = d; best = e; } }
      if (!best) { tw.cd = 0.3; continue; }
      tw.cd = TOWER.atk; const p = new Projectile('arrow', tw, best, 0, tw.team, 0, tw.def); p.srcUnit = tw; this.projectiles.push(p); this.emit({ t: 'proj', p, tower: true });
    }
  }
  startAttack(u, t) {
    const d = u.def, at = attackTimes(d);
    u.state = 'attack'; u.winding = true; u.windup = at.windup; u.animLeft = Math.max(at.dur, d.atk * 0.6); u.cd = d.atk; u.attackTarget = t;
    this.emit({ t: 'attack', u, dur: at.dur, clipDur: at.clipDur });
  }
  resolveAttack(u) {
    const d = u.def, t = u.attackTarget, eco = this.eco[u.team], teco = this.eco[1 - u.team];
    if (!t || (t.isBase ? t.dead : t.state === 'dead')) return;
    if (d.heal) { if (t.team === u.team) { const amt = d.heal * eco.attackBonus; const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt); if (t.hp > before) this.emit({ t: 'heal', u: t, amt: t.hp - before }); } return; }
    if (d.ranged) { const p = new Projectile(d.ranged, u, t, 0, u.team, d.splash || 0, d); p.srcUnit = u; p.mult = u.buffT > 0 ? BUFF.dmg : 1; this.projectiles.push(p); this.emit({ t: 'proj', p }); return; }
    if (!inRange(u, t) && Math.hypot(t.x - u.x, (t.z || 0) - u.z) > d.range * 1.5 + (t.r || 0)) return;     // el objetivo escapó: el golpe falla
    let mult = 1, heavy = false; if (d.rage && u.hp < u.maxHp * 0.5) mult = 1.4; if (u.buffT > 0) mult *= BUFF.dmg;
    if (d.heavyHit) { u.hits++; if (u.hits % d.heavyHit === 0) { mult = 1.6; heavy = true; } }
    if (t.isBase) { this.hitBase(t, d.dmg * eco.attackBonus * d.siege * mult, u); }
    else this.hitUnit(u, t, computeDamage(u, t.def, eco, teco, mult), heavy);
    if (d.splash) {
      const cx = t.isBase ? u.x + u.dir * d.range : t.x, cz = t.isBase ? u.z : t.z;
      this.emit({ t: 'explode', x: cx, z: cz, r: d.splash, kind: 'smash' });
      for (const e of this.units) if (e.team !== u.team && e.state !== 'dead' && e !== t) { const dd = Math.hypot(e.x - cx, e.z - cz); if (dd < d.splash) this.hitUnit(u, e, computeDamage(u, e.def, eco, teco, 0.6 * (1 - 0.4 * dd / d.splash)), false); }
    }
  }
  hitUnit(src, t, dmg, heavy, srcTeam = src.team) {
    if (t.state === 'dead') return;
    t.hp -= dmg; t.hurtT = 0.4; this.stats[srcTeam].damage += dmg;
    this.emit({ t: 'hit', u: t, dmg, heavy, x: t.x, z: t.z });
    if (t.hp <= 0) this.kill(t, srcTeam);
  }
  hitBase(b, dmg, src) {
    if (b.dead) return; if (!b.isTower && !this.towers[b.team].dead) return;   // el castillo está protegido por su torre
    b.hp -= dmg; this.stats[src.team].damage += dmg;
    this.emit({ t: 'baseHit', team: b.team, tower: !!b.isTower, x: b.x, z: src.z, dmg });
    if (b.hp <= 0) { b.hp = 0; b.dead = true; this.emit({ t: b.isTower ? 'towerDown' : 'baseDown', team: b.team }); }
  }
  kill(t, killerTeam) {
    t.state = 'dead'; t.deadT = 0; t.hp = 0; t.moving = false; this.eco[t.team].popUsed -= t.def.pop; this.eco[t.team].unitInc -= t.def.inc || 0; this.stats[t.team].lost++; this.stats[killerTeam].kills++;
    const bounty = Math.round(t.def.cost * 0.3); this.eco[killerTeam].add(bounty);
    this.emit({ t: 'death', u: t }); if (killerTeam === 0) this.emit({ t: 'coin', team: 0, amount: bounty, x: t.x, z: t.z });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.update(dt); if (!p.done) continue;
      const src = p.srcUnit, eco = this.eco[p.team], teco = this.eco[1 - p.team], t = p.target;
      if (p.kind === 'fire') {
        this.emit({ t: 'explode', x: p.tx, z: p.tz, r: p.splash, kind: 'fire' });
        for (const e of this.units) if (e.team !== p.team && e.state !== 'dead') { const dd = Math.hypot(e.x - p.tx, e.z - p.tz); if (dd < p.splash + e.r) this.hitUnit(src, e, computeDamage(src, e.def, eco, teco, (1 - 0.5 * Math.min(1, dd / p.splash)) * (p.mult ?? 1), true), false, p.team); }
        const b = this.objective(1 - p.team); if (!b.dead && Math.abs(b.x - p.tx) < (b.r ?? BASE_HALF) + p.splash) this.hitBase(b, p.def.dmg * eco.attackBonus * p.def.siege, { team: p.team, z: p.tz });
      } else if (t) {
        if (t.isBase) { if (!t.dead) this.hitBase(t, p.def.dmg * eco.attackBonus * p.def.siege, { team: p.team, z: p.tz }); }
        else if (t.state !== 'dead') this.hitUnit(src, t, computeDamage(src, t.def, eco, teco, p.mult ?? 1, true), false, p.team);
      }
      this.emit({ t: 'projEnd', p });
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  /** Empuja suavemente a las unidades que se solapan para que no se amontonen. */
  separate(dt) {
    const U = this.units, n = U.length;
    for (let i = 0; i < n; i++) {
      const a = U[i]; if (a.state === 'dead') continue;
      for (let j = i + 1; j < n; j++) {
        const b = U[j]; if (b.state === 'dead') continue;
        const dx = b.x - a.x; if (dx > 1.6 || dx < -1.6) continue; const dz = b.z - a.z, m = a.r + b.r;
        const d2 = dx * dx + dz * dz; if (d2 >= m * m) continue;
        const d = Math.sqrt(d2) || 0.0001, push = Math.min((m - d) * 0.5, 2.2 * dt), nx = (d2 < 1e-6 ? (this.rand() - .5) : dx) / d, nz = (d2 < 1e-6 ? (this.rand() - .5) : dz) / d;
        const wa = a.state === 'attack' ? 0.2 : 1, wb = b.state === 'attack' ? 0.2 : 1, s = wa + wb;
        a.x -= nx * push * wa / s * 2; a.z -= nz * push * wa / s * 2; b.x += nx * push * wb / s * 2; b.z += nz * push * wb / s * 2;
      }
    }
    const zl = this.map.zHalf; for (const u of U) { if (u.z > zl) u.z = zl; else if (u.z < -zl) u.z = -zl; }
  }
  cleanup(dt) {
    let any = false; for (const u of this.units) if (u.state === 'dead') { u.deadT += dt; if (u.deadT > 3.2) any = true; }
    if (any) { for (const u of this.units) if (u.state === 'dead' && u.deadT > 3.2) this.emit({ t: 'remove', u }); this.units = this.units.filter(u => !(u.state === 'dead' && u.deadT > 3.2)); }
  }
  checkEnd() {
    if (this.over) return;
    for (const b of this.bases) if (b.dead) { this.over = { winner: 1 - b.team, time: this.time }; this.emit({ t: 'over', winner: 1 - b.team }); }
  }
}
