/* combat.js — cálculo de daño, elección de objetivo y proyectiles. Lógica pura (sin Three.js) para poder probarla sin navegador. */
import { UNITS, typeMult, defenseFactor } from './units.js';

export const DETECT = 17;       // radio en el que un soldado ve enemigos
export const BASE_HALF = 3.6;   // semiancho de una base (para medir la distancia a su borde)

/** Daño final de `att` (unidad) contra una defensa con tipo `tdef`. */
export function computeDamage(att, tdef, attEco, tgtEco, mult = 1, ranged = false) {
  const d = att.def;
  let v = d.dmg * typeMult(d.dtype, tdef.armor) * attEco.attackBonus * mult * defenseFactor(tdef.def) * tgtEco.defenseFactor;
  if (ranged && tdef.shielded) v *= 0.65;
  return Math.max(1, v);
}
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Elige a quién atacar: el enemigo más cercano (los asesinos prefieren arqueros y magos) o, si no hay, la base si está cerca. */
export function pickTarget(u, enemies, base) {
  let best = null, bs = 1e9;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]; if (e.state === 'dead') continue;
    const d = Math.hypot(e.x - u.x, e.z - u.z); if (d > DETECT) continue;
    let sc = d; if (u.def.prefer === 'back' && e.def.ranged) sc -= 14;
    if (sc < bs) { bs = sc; best = e; }
  }
  if (best) return best;
  if (!base.dead && baseEdge(u, base) <= DETECT) return base;
  return null;
}
export const baseEdge = (u, base) => Math.max(0, Math.abs(base.x - u.x) - (base.r ?? BASE_HALF));
/** Torre con corona: se levanta delante de cada castillo y hay que derribarla antes de dañar el castillo. */
export const TOWER = { hp: 1500, range: 14, dmg: 12, atk: 1.7, dist: 10, r: 1.5 };

/** ¿Está el objetivo al alcance? Para unidades se mide entre centros más el radio del objetivo. */
export function inRange(u, t) {
  if (t.isBase) return baseEdge(u, t) <= u.def.range;
  return Math.hypot(t.x - u.x, t.z - u.z) <= u.def.range + t.r * 0.8;
}

export const PROJ = { arrow: { speed: 26, arc: 1.4 }, fire: { speed: 13, arc: 2.6 } };
let nextPid = 1;
export class Projectile {
  constructor(kind, from, target, dmg, team, splash, srcDef) {
    this.id = nextPid++; this.kind = kind; this.team = team; this.dmg = dmg; this.splash = splash; this.target = target; this.def = srcDef;
    this.x0 = from.x; this.z0 = from.z; this.y0 = 1.55 * from.def.scale; this.tx = target.x; this.tz = target.z; this.ty = target.isBase ? (target.ty ?? 2.2) : 1.1 * (target.def ? target.def.scale : 1);
    this.x = this.x0; this.y = this.y0; this.z = this.z0; this.t = 0;
    this.total = Math.max(0.15, Math.hypot(this.tx - this.x0, this.tz - this.z0) / PROJ[kind].speed); this.done = false;
    this.rot = 0; this.dirx = 1;
  }
  update(dt) {
    this.t += dt; const tg = this.target;
    if (tg && (tg.isBase || tg.state !== 'dead')) { this.tx = tg.x; this.tz = tg.z; }   // sigue al objetivo mientras viva
    const k = Math.min(1, this.t / this.total), a = PROJ[this.kind].arc;
    const px = this.x, py = this.y;
    this.x = this.x0 + (this.tx - this.x0) * k; this.z = this.z0 + (this.tz - this.z0) * k;
    this.y = this.y0 + (this.ty - this.y0) * k + Math.sin(Math.PI * k) * a * Math.min(1, this.total * 1.2);
    const dx = this.x - px; this.dirx = dx < 0 ? -1 : 1; this.rot = Math.atan2(this.y - py, Math.abs(dx) || 1e-6);
    if (k >= 1) this.done = true;
  }
}
