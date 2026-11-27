/* units.js — datos de todas las clases de soldados (originales) y la tabla de daño.
   Todo número del juego sale de aquí, así se equilibra en un solo sitio. */

// Tipos de armadura: ligera, pesada, grande. Tipos de daño: filo, perforante, contundente, magico.
export const DAMAGE_MULT = {
  filo:        { ligera: 1.30, pesada: 0.70, grande: 1.00 },
  perforante:  { ligera: 0.90, pesada: 1.00, grande: 1.45 },
  contundente: { ligera: 1.00, pesada: 1.35, grande: 1.00 },
  magico:      { ligera: 1.10, pesada: 1.20, grande: 1.00 },
};

// Duración del clip de ataque de cada estilo y fracción donde cae el impacto (viene de los .glb: ver tools/fw_clips.py)
export const STYLE_ATTACK = {
  sword: { dur: 0.85, hit: 0.46 }, great: { dur: 1.15, hit: 0.46 }, spear: { dur: 0.90, hit: 0.45 }, bow: { dur: 1.10, hit: 0.60 },
  staff: { dur: 1.25, hit: 0.55 }, club: { dur: 1.60, hit: 0.55 }, dagger: { dur: 0.55, hit: 0.32 },
};

/* Campos:
   hp vida · dmg daño por golpe · def defensa · speed m/s · range alcance (m) · atk segundos entre ataques · cost monedas · recruit segundos de entrenamiento
   pop población · armor/dtype tipos · style estilo de animación · scale tamaño del modelo · ranged 'arrow'|'fire'|null · splash radio de área
   siege multiplicador de daño contra bases · prefer 'back' = prioriza arqueros y magos · tier oleada mínima para que la IA lo use */
export const UNITS = {
  recluta:   { id: 'recluta',   name: 'Recluta',            role: 'Infantería básica',  desc: 'Barato y rápido de entrenar. Cae pronto, pero hace bulto y paga su costo.',
               hp: 100, dmg: 9,  def: 1, speed: 3.2, range: 1.5, atk: 0.90, cost: 50,  recruit: 1.8, pop: 1, armor: 'ligera', dtype: 'filo',        style: 'sword',  scale: 1.25, siege: 1.0, tier: 1, color: '#c9a24a' },
  escudero:  { id: 'escudero',  name: 'Escudero',           role: 'Espadachín',         desc: 'Espada y escudo. Recibe 35 % menos daño de flechas y magia y aguanta la primera línea.',
               hp: 170, dmg: 13, def: 5, speed: 2.9, range: 1.6, atk: 1.00, cost: 110, recruit: 3.0, pop: 1, armor: 'ligera', dtype: 'filo',        style: 'sword',  scale: 1.3,  siege: 1.0, tier: 1, color: '#4a78c2', shielded: true },
  caballero: { id: 'caballero', name: 'Caballero de Acero', role: 'Caballero pesado',   desc: 'Armadura completa. Su hoja destroza a los ligeros y cada 3.er golpe cae con más fuerza.',
               hp: 330, dmg: 24, def: 9, speed: 2.4, range: 1.7, atk: 1.30, cost: 240, recruit: 5.0, pop: 2, armor: 'pesada', dtype: 'filo',        style: 'great',  scale: 1.45,  siege: 1.3, tier: 2, color: '#9aa4b4', heavyHit: 3 },
  arquero:   { id: 'arquero',   name: 'Cazador',            role: 'Arquero',            desc: 'Dispara flechas desde lejos. Frágil: protégelo con tropas delante.',
               hp: 70,  dmg: 11, def: 0, speed: 3.0, range: 13,  atk: 1.10, cost: 90,  recruit: 2.5, pop: 1, armor: 'ligera', dtype: 'perforante',  style: 'bow',    scale: 1.25, siege: 0.8, tier: 1, color: '#58b060', ranged: 'arrow' },
  lancero:   { id: 'lancero',   name: 'Lancero',            role: 'Lancero',            desc: 'Su pica atraviesa a gigantes y blindados: +45 % de daño contra tamaño grande.',
               hp: 130, dmg: 14, def: 2, speed: 3.0, range: 2.5, atk: 1.00, cost: 100, recruit: 2.6, pop: 1, armor: 'ligera', dtype: 'perforante',  style: 'spear',  scale: 1.3,  siege: 0.9, tier: 1, color: '#c8754a' },
  asesino:   { id: 'asesino',   name: 'Sombra',             role: 'Asesino',            desc: 'Veloz. Corre hacia arqueros y magos y los elimina con dos dagas.',
               hp: 85,  dmg: 18, def: 1, speed: 5.2, range: 1.4, atk: 0.55, cost: 130, recruit: 3.0, pop: 1, armor: 'ligera', dtype: 'filo',        style: 'dagger', scale: 1.25, siege: 0.7, tier: 2, color: '#8a5cd0', prefer: 'back' },
  ballestero:{ id: 'ballestero',name: 'Ballestero',        role: 'Ballestero',         desc: 'Virotes pesados que perforan armaduras. Dispara más lento que el cazador, pero golpea mucho más fuerte.',
               hp: 90,  dmg: 22, def: 1, speed: 2.8, range: 11,  atk: 1.90, cost: 150, recruit: 3.5, pop: 1, armor: 'ligera', dtype: 'perforante',  style: 'bow',    scale: 1.28, siege: 0.8, tier: 2, color: '#b8503a', ranged: 'arrow' },
  samurai:   { id: 'samurai',   name: 'Samurái',            role: 'Espadachín de élite', desc: 'Katana veloz y armadura laqueada. Rápido y letal contra tropas ligeras.',
               hp: 210, dmg: 22, def: 4, speed: 3.6, range: 1.7, atk: 1.00, cost: 200, recruit: 4.0, pop: 2, armor: 'ligera', dtype: 'filo',        style: 'sword',  scale: 1.3,  siege: 1.0, tier: 2, color: '#2e3a56' },
  barbaro:   { id: 'barbaro',   name: 'Bárbaro',            role: 'Guerrero de hacha',  desc: 'Hacha doble. Cuando le queda menos de la mitad de la vida entra en furia: +40 % de daño.',
               hp: 240, dmg: 30, def: 1, speed: 3.3, range: 1.8, atk: 1.40, cost: 170, recruit: 3.5, pop: 2, armor: 'ligera', dtype: 'filo',        style: 'great',  scale: 1.45, siege: 1.1, tier: 2, color: '#a86a3a', rage: true },
  sacerdote: { id: 'sacerdote', name: 'Sacerdote',          role: 'Sanador',            desc: 'No ataca: cura al aliado más herido cerca de él. Mantenlo detrás de tu línea.',
               hp: 90,  dmg: 0,  def: 0, speed: 2.6, range: 9,   atk: 2.00, cost: 180, recruit: 4.0, pop: 2, armor: 'ligera', dtype: 'magico',      style: 'staff',  scale: 1.3,  siege: 0,   tier: 3, color: '#e9e3d3', heal: 26 },
  mago:      { id: 'mago',      name: 'Mago de Ember',      role: 'Mago',               desc: 'Bola de fuego en área. Muy buen daño en grupos; muy débil de cerca.',
               hp: 80,  dmg: 26, def: 0, speed: 2.6, range: 11,  atk: 2.20, cost: 200, recruit: 4.5, pop: 2, armor: 'ligera', dtype: 'magico',      style: 'staff',  scale: 1.3,  siege: 0.8, tier: 2, color: '#ff8a3a', ranged: 'fire', splash: 2.6 },
  gigante:   { id: 'gigante',   name: 'Coloso',             role: 'Gigante',            desc: 'Enorme. Su garrote golpea en área y derriba bases. Lento y caro.',
               hp: 760, dmg: 40, def: 6, speed: 1.9, range: 2.4, atk: 1.80, cost: 420, recruit: 8.0, pop: 4, armor: 'grande', dtype: 'contundente', style: 'club',   scale: 2.1, siege: 2.0, tier: 4, color: '#a07a50', splash: 2.4 },
};
export const ORDER = ['recluta', 'escudero', 'lancero', 'arquero', 'ballestero', 'asesino', 'samurai', 'barbaro', 'caballero', 'sacerdote', 'mago', 'gigante'];

export function attackTimes(def) {
  const clip = STYLE_ATTACK[def.style], dur = Math.min(clip.dur, def.atk);
  return { clipDur: clip.dur, dur, windup: clip.hit * dur };
}
// Daño base de un tipo de arma contra una armadura (sin defensa)
export const typeMult = (dtype, armor) => DAMAGE_MULT[dtype][armor];
// La defensa reduce el daño: 12/(12+def). Con def 9 → 57 %.
export const defenseFactor = (def) => 12 / (12 + def);
