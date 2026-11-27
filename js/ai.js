/* ai.js — el ejército enemigo. Gana monedas, elige tropas que contrarrestan a las del jugador, compra mejoras y manda oleadas. Lógica pura. */
import { UNITS, ORDER, typeMult, defenseFactor } from './units.js';
import { UPGRADES } from './economy.js';

export const DIFFICULTY = {
  facil:   { name: 'Fácil',   incomeMul: 0.80, think: 3.2, err: 0.40, upgrade: 0.25, waveGrow: 0.010, bonusPerWave: 10, tierShift: 1 },
  normal:  { name: 'Normal',  incomeMul: 1.10, think: 1.6, err: 0.12, upgrade: 0.60, waveGrow: 0.025, bonusPerWave: 25, tierShift: 0 },
  dificil: { name: 'Difícil', incomeMul: 1.32, think: 1.0, err: 0.02, upgrade: 0.95, waveGrow: 0.040, bonusPerWave: 40, tierShift: -1 },
};

export class AI {
  constructor(game, team, difficulty, mods = {}) {
    this.g = game; this.team = team; this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal; this.mods = mods;
    this.t = 1.5; this.lastWave = 1; this.saving = 0; this.baseIncomeMul = this.cfg.incomeMul * (mods.incomeMul ?? 1);
    game.eco[team].incomeMul = this.baseIncomeMul; this.upgradeOrder = ['income', 'attack', 'defense', 'pop', 'income', 'attack', 'defense'];
  }
  /** Valor de `u` contra la tropa `p`: daño que le hace menos daño que recibe, relativo a la vida de cada uno. */
  matchup(u, p) {
    const a = u.dmg * typeMult(u.dtype, p.armor) * defenseFactor(p.def) / p.hp * (1 / u.atk);
    const b = p.dmg * typeMult(p.dtype, u.armor) * defenseFactor(u.def) / u.hp * (1 / p.atk);
    return a - b * 0.8;
  }
  update(dt) {
    const g = this.g, eco = g.eco[this.team];
    if (g.wave !== this.lastWave) {   // nueva oleada: bono de monedas y la IA se vuelve un poco más fuerte
      this.lastWave = g.wave; eco.add(this.cfg.bonusPerWave * (g.wave - 1));
      eco.incomeMul = this.baseIncomeMul * (1 + this.cfg.waveGrow * (g.wave - 1)); this.burst = 3;
    }
    this.t -= dt; if (this.t > 0) return;
    this.t = this.cfg.think * (0.8 + g.rand() * 0.5) * (this.burst > 0 ? 0.45 : 1); if (this.burst > 0) this.burst--;
    // 1) mejoras
    if (g.rand() < this.cfg.upgrade * 0.25 && g.time > 25) {
      for (const k of this.upgradeOrder) { const c = eco.upgradeCost(k); if (c != null && eco.gold >= c + 60 && (k !== 'pop' || eco.popFree() < 6)) { g.upgrade(this.team, k); return; } }
    }
    // 2) tropa
    const id = this.choose(); if (!id) return;
    const why = g.canRecruit(this.team, id);
    if (!why) { g.recruit(this.team, id); this.saving = 0; return; }
    if (why === 'monedas') {                      // ahorra para la que quiere, pero no más de ~10 s: luego compra algo más barato
      this.saving += this.cfg.think; if (this.saving > 10) { const cheap = this.cheapest(); if (cheap && !g.canRecruit(this.team, cheap)) { g.recruit(this.team, cheap); this.saving = 0; } }
    }
  }
  available() {
    const w = this.g.wave + this.cfg.tierShift * -1, lim = this.g.time < 30 ? 1 : w;   // tropas pesadas más tarde
    return ORDER.filter(id => UNITS[id].tier <= Math.max(1, lim));
  }
  cheapest() { return this.available().sort((a, b) => UNITS[a].cost - UNITS[b].cost)[0]; }
  choose() {
    const g = this.g, enemy = g.aliveOf(1 - this.team), mine = g.aliveOf(this.team), cands = this.available();
    if (!cands.length) return null;
    let nr = 0; for (const u of mine) if (u.def.ranged) nr++;
    const rangedShare = mine.length ? nr / mine.length : 0;
    const scores = cands.map(id => {
      const u = UNITS[id]; let s = 0, w = 0;
      for (const p of enemy) { const ww = p.def.cost; s += this.matchup(u, p.def) * ww; w += ww; }
      s = w ? s / w : 0.2 * (u.hp * u.dmg / u.cost / 100);
      s += 0.12 * (u.hp * u.dmg / u.cost / 100);                           // rendimiento por moneda
      if (u.ranged && rangedShare < 0.25) s += 0.25; if (u.ranged && rangedShare > 0.45) s -= 0.4;   // equilibrio con tropas a distancia
      if (mine.length < 3 && u.id === 'recluta') s += 0.1;
      s += (g.rand() - 0.5) * 2 * this.cfg.err * 0.8;                        // variar decisiones
      return [id, s];
    });
    if (g.rand() < this.cfg.err) return cands[Math.floor(g.rand() * cands.length)];   // a veces decide al azar
    scores.sort((a, b) => b[1] - a[1]); return scores[0][0];
  }
}
