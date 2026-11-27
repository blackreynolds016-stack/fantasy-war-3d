/* economy.js — monedas, ingresos, población y mejoras de cada ejército. Sin dependencias de Three.js. */
export const UPGRADES = {
  income:  { name: 'Economía', desc: '+3 monedas/s', max: 5, costs: [150, 260, 420, 650, 950] },
  attack:  { name: 'Ataque',   desc: '+8 % de daño', max: 5, costs: [200, 340, 520, 760, 1050] },
  defense: { name: 'Defensa',  desc: '-6 % de daño recibido', max: 5, costs: [200, 340, 520, 760, 1050] },
  pop:     { name: 'Población', desc: '+10 de límite', max: 5, costs: [180, 300, 480, 700, 950] },
};
export const START_GOLD = 200, BASE_INCOME = 5, BASE_POP = 30;

export class Economy {
  constructor(opts = {}) {
    this.gold = opts.gold ?? START_GOLD; this.incomeMul = opts.incomeMul ?? 1; this.popUsed = 0; this.unitInc = 0;   // ingresos que aportan los soldados vivos
    this.level = { income: 0, attack: 0, defense: 0, pop: 0 };
    Object.assign(this.level, opts.levels || {});
    this.totalEarned = 0; this.passiveDmg = opts.passiveDmg ?? 1;
  }
  get income() { return (BASE_INCOME + 3 * this.level.income + this.unitInc) * this.incomeMul; }
  get popCap() { return BASE_POP + 10 * this.level.pop; }
  get attackBonus() { return (1 + 0.08 * this.level.attack) * this.passiveDmg; }
  get defenseFactor() { return 1 - 0.06 * this.level.defense; }
  tick(dt) { const g = this.income * dt; this.gold += g; this.totalEarned += g; }
  add(n) { this.gold += n; this.totalEarned += n; }
  canAfford(n) { return this.gold >= n; }
  spend(n) { if (this.gold < n) return false; this.gold -= n; return true; }
  upgradeCost(k) { const u = UPGRADES[k], l = this.level[k]; return l >= u.max ? null : u.costs[l]; }
  upgrade(k) { const c = this.upgradeCost(k); if (c == null || !this.spend(c)) return false; this.level[k]++; return true; }
  popFree() { return this.popCap - this.popUsed; }
}
