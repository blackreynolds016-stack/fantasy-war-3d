/* heroes.js — héroes con una habilidad activa. Todos comparten reglas: recarga, radio fijo y objetivo automático
   (las de daño caen sobre el grupo enemigo más denso; las de apoyo, sobre tu línea de frente). Así ninguna cubre medio mapa. */
export const HEROES = {
  valeria: { id: 'valeria', name: 'Valeria', title: 'Lanza del Alba', skill: 'Lluvia de flechas', kind: 'rain', cd: 40, r: 7, power: 42, color: '#e8c24a',
             desc: 'Una lluvia de flechas cae sobre el grupo enemigo más numeroso y hiere a todos en 7 m.' },
  ignis:   { id: 'ignis',   name: 'Ignis',   title: 'Archimago',      skill: 'Tormenta de fuego', kind: 'fire', cd: 50, r: 4.2, power: 40, color: '#ff7a2a',
             desc: 'Tres bolas de fuego caen en fila (a 5 m una de otra) sobre el grupo enemigo; cada una daña en 4 m.' },
  aldric:  { id: 'aldric',  name: 'Aldric',  title: 'Señor de la guerra', skill: 'Grito de guerra', kind: 'buff', cd: 50, r: 16, power: 0.35, dur: 8, color: '#d24a3a',
             desc: 'Tus soldados cerca del frente hacen +35 % de daño y andan +25 % más rápido durante 8 s.' },
  sora:    { id: 'sora',    name: 'Sora',    title: 'Sanadora',       skill: 'Bendición', kind: 'heal', cd: 55, r: 14, power: 0.4, color: '#7bff9a',
             desc: 'Cura el 40 % de la vida máxima de tus soldados cerca del frente.' },
};
export const HERO_ORDER = ['valeria', 'ignis', 'aldric', 'sora'];
export const HERO_START_CD = 15;       // la habilidad está lista a los 15 s
export const BUFF = { dmg: 1.35, speed: 1.25 };
