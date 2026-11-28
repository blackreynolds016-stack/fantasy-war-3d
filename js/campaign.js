/* campaign.js — campaña por niveles, desbloqueos, mejoras permanentes (Forja) y récord del Abismo. Lógica pura + guardado en localStorage. */
import { ORDER } from './units.js';
import { HERO_ORDER } from './heroes.js';

/** Nivel de campaña. `par` = segundos para la 2.ª estrella. aiHero: id de héroe enemigo, false = sin héroe, undefined = al azar. */
export const LEVELS = [
  { n: 1,  name: 'Primeras escaramuzas',  map: 'valle',   diff: 'facil',   mul: 0.85, par: 240, aiHero: false,   desc: 'El enemigo apenas se organiza. Aprende a reclutar y a derribar la torre.' },
  { n: 2,  name: 'Paso nevado',           map: 'nieve',   diff: 'facil',   mul: 1.00, par: 250, aiHero: false,   desc: 'Los exploradores enemigos ya traen asesinos. Protege a tus arqueros.' },
  { n: 3,  name: 'Llanura de ceniza',     map: 'cenizas', diff: 'facil',   mul: 1.15, par: 260, aiHero: false,   desc: 'Más tropas y más rápido. Mejora tu economía a tiempo.' },
  { n: 4,  name: 'El valle en llamas',    map: 'valle',   diff: 'normal',  mul: 0.90, par: 260, aiHero: 'ignis', desc: 'Aparece Ignis, el archimago enemigo. Cuidado con su tormenta de fuego.' },
  { n: 5,  name: 'Cumbres heladas',       map: 'nieve',   diff: 'normal',  mul: 1.00, par: 270, aiHero: 'sora',  desc: 'Una sanadora mantiene viva su línea. Elimina a los sacerdotes.' },
  { n: 6,  name: 'Campo de ceniza',       map: 'cenizas', diff: 'normal',  mul: 1.08, par: 280, aiHero: 'valeria', desc: 'Lluvia de flechas sobre tus grupos: no te amontones.' },
  { n: 7,  name: 'La gran marcha',        map: 'valle',   diff: 'normal',  mul: 1.20, par: 290, aiHero: 'aldric', desc: 'Aldric lidera una marcha enorme con gritos de guerra.' },
  { n: 8,  name: 'Ventisca de acero',     map: 'nieve',   diff: 'dificil', mul: 0.85, par: 290, aiHero: 'sora', desc: 'El enemigo ya es astuto: elige contras y ahorra para golpear fuerte.' },
  { n: 9,  name: 'Sendero de brasas',     map: 'cenizas', diff: 'dificil', mul: 0.95, par: 300, aiHero: 'aldric', desc: 'Oleadas sin descanso. Mantén tu torre en pie.' },
  { n: 10, name: 'Fortaleza del valle',   map: 'valle',   diff: 'dificil', mul: 1.05, par: 300, aiHero: 'sora',  desc: 'Defensa sólida con sanadora. Rompe la torre con gigantes y magos.' },
  { n: 11, name: 'Tormenta final',        map: 'nieve',   diff: 'dificil', mul: 1.15, par: 310, aiHero: 'valeria', desc: 'Casi sin margen de error. Usa tu héroe en el momento justo.' },
  { n: 12, name: 'El Rey de Ceniza',      map: 'cenizas', diff: 'dificil', mul: 1.25, par: 320, aiHero: 'ignis', baseHpMul: 1.3, desc: 'La batalla definitiva: el castillo del Rey tiene un 30 % más de vida.' },
];
/** Nivel cuya victoria desbloquea la tropa / el héroe (0 = desde el inicio). */
export const UNIT_UNLOCK = { recluta: 0, escudero: 0, lancero: 0, arquero: 0, asesino: 2, ballestero: 3, samurai: 4, sacerdote: 5, barbaro: 6, caballero: 7, mago: 8, gigante: 9 };
export const HERO_UNLOCK = { valeria: 0, ignis: 4, aldric: 7, sora: 10 };

/** Mejoras permanentes que se compran con Gloria. */
export const FORGE = {
  gold: { name: 'Tesoro real',   desc: '+25 monedas al empezar cada batalla', max: 5, costs: [60, 90, 130, 180, 250] },
  hp:   { name: 'Muralla',       desc: '+6 % de vida de tu castillo',         max: 5, costs: [60, 90, 130, 180, 250] },
  dmg:  { name: 'Armería',       desc: '+3 % de daño a todo tu ejército',     max: 5, costs: [80, 120, 170, 230, 300] },
  def:  { name: 'Herrería',      desc: '−3 % de daño recibido',               max: 5, costs: [80, 120, 170, 230, 300] },
  cd:   { name: 'Escuela de héroes', desc: '−4 % de recarga de tu habilidad', max: 5, costs: [50, 80, 120, 170, 230] },
};
export const ABYSS = { baseHp: 0.15, towerHp: 0.10, income: 0.08, gold: 120, goldPerFloor: 20 };

export const levelReward = (n, first) => (first ? 30 + 12 * n : 10 + 3 * n);
export const starsFor = (lv, g) => 1 + (g.over.time <= lv.par ? 1 : 0) + (g.bases[0].hp >= g.bases[0].maxHp * 0.5 ? 1 : 0);
export const quickReward = (diff, win) => (win ? { facil: 4, normal: 8, dificil: 14 }[diff] || 4 : 1);
export const abyssReward = (floor) => 10 * (floor - 1) + 5;

export class Save {
  constructor(storage) {
    this.store = storage !== undefined ? storage : (() => { try { return localStorage; } catch (e) { return null; } })();
    this.d = { v: 1, levels: {}, glory: 0, forge: { gold: 0, hp: 0, dmg: 0, def: 0, cd: 0 }, abyss: { best: 0 } };
    try { const raw = this.store && this.store.getItem('fw-save'); if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) { this.d = { ...this.d, ...o, forge: { ...this.d.forge, ...(o.forge || {}) }, abyss: { ...this.d.abyss, ...(o.abyss || {}) } }; } } } catch (e) {}
  }
  save() { try { this.store && this.store.setItem('fw-save', JSON.stringify(this.d)); } catch (e) {} }
  get glory() { return this.d.glory; }
  stars(n) { return (this.d.levels[n] || {}).stars || 0; }
  cleared(n) { return this.stars(n) > 0; }
  levelOpen(n) { return n === 1 || this.cleared(n - 1); }
  totalStars() { return Object.values(this.d.levels).reduce((a, l) => a + (l.stars || 0), 0); }
  highest() { let h = 0; for (let n = 1; n <= LEVELS.length; n++) if (this.cleared(n)) h = n; return h; }
  isUnitOpen(id) { return (UNIT_UNLOCK[id] ?? 99) <= this.highest(); }
  isHeroOpen(id) { return (HERO_UNLOCK[id] ?? 99) <= this.highest(); }
  unlockedUnits() { return ORDER.filter(id => this.isUnitOpen(id)); }
  unlockedHeroes() { return HERO_ORDER.filter(id => this.isHeroOpen(id)); }
  perm() { return { ...this.d.forge }; }
  /** Registra el resultado de una victoria de campaña. Devuelve lo ganado. */
  completeLevel(n, stars) {
    const prev = this.d.levels[n] || { stars: 0 }, first = prev.stars === 0, before = { u: this.unlockedUnits(), h: this.unlockedHeroes() };
    const newStars = Math.max(0, stars - prev.stars), glory = levelReward(n, first) + 10 * newStars;
    this.d.levels[n] = { stars: Math.max(prev.stars, stars) }; this.d.glory += glory; this.save();
    return { glory, stars, first, newUnits: this.unlockedUnits().filter(u => !before.u.includes(u)), newHeroes: this.unlockedHeroes().filter(h => !before.h.includes(h)) };
  }
  addGlory(n) { this.d.glory += n; this.save(); return n; }
  abyssBest() { return this.d.abyss.best; }
  abyssResult(floor) { const best = floor > this.d.abyss.best; if (best) this.d.abyss.best = floor; const glory = abyssReward(floor); this.d.glory += glory; this.save(); return { glory, best, floor }; }
  forgeCost(k) { const l = this.d.forge[k]; return l >= FORGE[k].max ? null : FORGE[k].costs[l]; }
  buy(k) { const c = this.forgeCost(k); if (c == null || this.d.glory < c) return false; this.d.glory -= c; this.d.forge[k]++; this.save(); return true; }
}
